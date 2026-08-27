const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const rutasProyecto = require("./configuracion/rutas");
const { crearEnrutadorApi } = require("./rutas");
const { normalizeEmail, boundedInteger, maskEmail, readCookies, safeEqual } = require("./modulos/utilidades");
const { readJsonFile, writeJsonFileAtomic, ensureOperationalFile, parseDelimitedCsv, serializeCsvUsers, loadCsvUsers, loadSqlTable, normalizeSqlText } = require("./modulos/persistencia");
const { createEmailService } = require("./modulos/correo");
const { normalizeProgramText: normalizedProgramText, canonicalProgramStatus, displayProgramLevel, validateProgramInput } = require("./dominio/programas");
const { canonicalRole, canonicalUserStatus, csvValue, registryRowFromUser } = require("./dominio/usuarios");
const { localDate, dateKey, addDays, rateFor, statusSummary, resolveDashboardRange } = require("./dominio/estadisticas");

const root = rutasProyecto.raizProyecto;
const dataDirectory = rutasProyecto.datos;
const pagesDirectory = rutasProyecto.paginas;
const publicDirectories = rutasProyecto.directoriosPublicos;
const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png"
};

function loadEnvFile() {
    const file = path.join(root, ".env");
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const separator = trimmed.indexOf("=");
        if (separator < 1) continue;
        const key = trimmed.slice(0, separator).trim();
        let value = trimmed.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
    }
}

loadEnvFile();

function sendJson(response, status, value, headers = {}) {
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ...headers
    });
    response.end(JSON.stringify(value));
}

async function readJsonBody(request, maxBytes = 128 * 1024) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        request.on("data", (chunk) => {
            size += chunk.length;
            if (size > maxBytes) {
                reject(Object.assign(new Error("Solicitud demasiado grande."), { status: 413 }));
                request.destroy();
                return;
            }
            chunks.push(chunk);
        });
        request.on("end", () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
            } catch (_error) {
                reject(Object.assign(new Error("El contenido enviado no es válido."), { status: 400 }));
            }
        });
        request.on("error", reject);
    });
}

function loadOrCreateOtpSecret(options) {
    const configured = String(options.otpSecret ?? process.env.OTP_SECRET ?? "").trim();
    if (configured) return configured;
    if (options.apprentices || options.emailSender) return crypto.randomBytes(32).toString("hex");
    const secretFile = options.otpSecretFile || path.join(dataDirectory, "clave_codigos.key");
    if (fs.existsSync(secretFile)) {
        const stored = fs.readFileSync(secretFile, "utf8").trim();
        if (/^[a-f0-9]{64,}$/i.test(stored)) return stored;
    }
    const generated = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(path.dirname(secretFile), { recursive: true });
    fs.writeFileSync(secretFile, `${generated}\n`, { encoding: "utf8", mode: 0o600 });
    return generated;
}

function createProjectServer(options = {}) {
    const config = {
        resendApiKey: options.resendApiKey ?? process.env.RESEND_API_KEY ?? "",
        emailFrom: options.emailFrom ?? process.env.EMAIL_FROM ?? "",
        emailProvider: String(options.emailProvider ?? process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase(),
        gmailUser: normalizeEmail(options.gmailUser ?? process.env.GMAIL_USER ?? ""),
        gmailAppPassword: String(options.gmailAppPassword ?? process.env.GMAIL_APP_PASSWORD ?? "").replace(/\s/g, ""),
        otpSecret: loadOrCreateOtpSecret(options),
        allowedEmails: String(options.allowedEmails ?? process.env.ALLOWED_EMAILS ?? "").split(",").map(normalizeEmail).filter(Boolean),
        allowedDomain: String(options.allowedDomain ?? process.env.ALLOWED_EMAIL_DOMAIN ?? "").trim().toLowerCase().replace(/^@/, ""),
        secureCookie: options.secureCookie ?? process.env.COOKIE_SECURE === "1",
        exposeTestCode: options.exposeTestCode === true,
        emailSender: options.emailSender,
        emailTimeoutMs: boundedInteger(options.emailTimeoutMs ?? process.env.EMAIL_TIMEOUT_MS, 10000, 2000, 30000),
        emailMaxAttempts: boundedInteger(options.emailMaxAttempts ?? process.env.EMAIL_MAX_ATTEMPTS, 3, 1, 5),
        emailRetryBaseMs: boundedInteger(options.emailRetryBaseMs ?? process.env.EMAIL_RETRY_BASE_MS, 500, 10, 5000),
        emailMinIntervalMs: options.emailSender && options.emailMinIntervalMs == null
            ? 0
            : boundedInteger(options.emailMinIntervalMs ?? process.env.EMAIL_MIN_INTERVAL_MS, 300, 100, 5000),
        emailHistoryLimit: boundedInteger(options.emailHistoryLimit ?? process.env.EMAIL_HISTORY_LIMIT, 500, 50, 5000)
    };
    const codes = new Map();
    const sessions = new Map();
    const hourlyRequests = new Map();
    const pendingCodeRequests = new Set();
    const persistentRuntime = !options.apprentices && !options.emailSender;
    const authStateFile = options.authStateFile === null
        ? null
        : (options.authStateFile || (persistentRuntime ? path.join(dataDirectory, "estado_autenticacion_correo.json") : null));
    const emailHistoryFile = options.emailHistoryFile === null
        ? null
        : (options.emailHistoryFile || (persistentRuntime ? path.join(dataDirectory, "historial_envios_correo.json") : null));
    const storedAuthState = readJsonFile(authStateFile, {});
    const nowAtStartup = Date.now();
    for (const item of Array.isArray(storedAuthState.codes) ? storedAuthState.codes : []) {
        const document = String(item.document || "").replace(/\D/g, "");
        const email = normalizeEmail(item.email);
        if (document && email && /^[a-f0-9]{64}$/i.test(String(item.hash || "")) && Number(item.expiresAt) > nowAtStartup) {
            codes.set(document, {
                hash: String(item.hash),
                email,
                expiresAt: Number(item.expiresAt),
                nextSendAt: Number(item.nextSendAt) || nowAtStartup,
                attempts: boundedInteger(item.attempts, 0, 0, 5)
            });
        }
    }
    for (const item of Array.isArray(storedAuthState.hourlyRequests) ? storedAuthState.hourlyRequests : []) {
        const key = String(item.key || "");
        if (key && Number(item.windowEndsAt) > nowAtStartup) {
            hourlyRequests.set(key, {
                count: boundedInteger(item.count, 0, 0, 5),
                windowEndsAt: Number(item.windowEndsAt)
            });
        }
    }
    let emailHistory = readJsonFile(emailHistoryFile, []);
    if (!Array.isArray(emailHistory)) emailHistory = [];
    emailHistory = emailHistory.slice(-config.emailHistoryLimit);
    const serverStartedAt = new Date().toISOString();
    const emailService = createEmailService(config, { appendHistory: appendEmailHistory });
    const selectedEmailProvider = emailService.provider;
    const resendTestMode = emailService.testMode;
    const adminCredentialsFile = options.adminCredentialsFile || path.join(dataDirectory, "credenciales_administrador.json");
    let adminCredentials = {
        salt: "sena-admin-2026",
        passwordHash: "46c3d68de34605cabf1087dc0d99ab5a435b29de13894a2f91f7e94326c96165188e6b00b455ef57158b0728a06146c881b5cf14cb25c27e7a5ee9923ab97935",
        name: "Administrador SENA",
        email: "admin@sena.edu.co"
    };
    if (typeof options.adminPassword === "string") {
        adminCredentials = {
            salt: "sena-admin-test",
            passwordHash: crypto.scryptSync(options.adminPassword, "sena-admin-test", 64).toString("hex"),
            name: "Administrador SENA",
            email: "admin@sena.edu.co"
        };
    } else if (fs.existsSync(adminCredentialsFile)) {
        try {
            const storedCredentials = JSON.parse(fs.readFileSync(adminCredentialsFile, "utf8"));
            const salt = String(storedCredentials.salt || "");
            const passwordHash = String(storedCredentials.passwordHash || "").toLowerCase();
            if (salt.length < 8 || !/^[a-f0-9]{128}$/.test(passwordHash)) throw new Error("Formato inválido");
            adminCredentials = {
                salt,
                passwordHash,
                name: String(storedCredentials.name || "Administrador SENA").trim(),
                email: normalizeEmail(storedCredentials.email || "admin@sena.edu.co")
            };
        } catch (_error) {
            throw new Error("Las credenciales administrativas guardadas no son válidas. Ejecuta npm.cmd run reset:admin.");
        }
    }
    const builtInAccounts = [
        {
            id: "admin-sena",
            username: "admin",
            email: adminCredentials.email,
            name: adminCredentials.name,
            role: "Administrador",
            salt: adminCredentials.salt,
            passwordHash: adminCredentials.passwordHash
        },
        {
            id: "instructor-sena",
            username: "instructor",
            email: "instructor@sena.edu.co",
            name: "Instructor SENA",
            role: "Instructor",
            salt: "sena-instructor-2026",
            passwordHash: "e93849e9e070c7f1f221ea858e852f2c9f168b330e370904f4c78672c4dfcfcd301a11a1c4a05e487404a8c21ac0b61172d76d3d404bf843e39b9a447a957d75"
        }
    ];
    const managedUsersFile = path.join(dataDirectory, "usuarios_gestionados.json");
    if (persistentRuntime) ensureOperationalFile(
        managedUsersFile,
        path.join(dataDirectory, "ejemplos", "usuarios_gestionados.ejemplo.json"),
        "[]\n"
    );
    const managedUsers = options.managedUsers
        ? JSON.parse(JSON.stringify(options.managedUsers))
        : options.apprentices
            ? []
            : (fs.existsSync(managedUsersFile) ? JSON.parse(fs.readFileSync(managedUsersFile, "utf8")) : []);
    const accounts = [...builtInAccounts, ...managedUsers];
    const apprenticesFile = path.join(dataDirectory, "aprendices.json");
    const attendanceFile = path.join(dataDirectory, "asistencia.json");
    if (persistentRuntime) {
        ensureOperationalFile(apprenticesFile, path.join(dataDirectory, "ejemplos", "aprendices.ejemplo.json"), "[]\n");
        ensureOperationalFile(attendanceFile, path.join(dataDirectory, "ejemplos", "asistencia.ejemplo.json"), "[]\n");
    }
    const storedApprentices = options.apprentices
        ? JSON.parse(JSON.stringify(options.apprentices))
        : JSON.parse(fs.readFileSync(apprenticesFile, "utf8"));
    const usersCsvFile = options.usersCsvFile || path.join(dataDirectory, "importaciones", "usuarios_activos.csv");
    if (persistentRuntime) ensureOperationalFile(
        usersCsvFile,
        path.join(dataDirectory, "ejemplos", "usuarios_activos.ejemplo.csv"),
        "identificacion;tipo_documento;nombre;correo;rol;estado;ficha\n"
    );
    let csvUsers = options.csvUsers
        ? JSON.parse(JSON.stringify(options.csvUsers))
        : (options.apprentices && !options.usersCsvFile ? [] : loadCsvUsers(usersCsvFile));
    const csvApprentices = csvUsers.filter((user) =>
        String(user.rol || "").trim().toLowerCase() === "aprendiz"
        && /^\d+$/.test(String(user.identificacion || "").trim())
        && normalizeEmail(user.correo)
    );
    const apprentices = options.apprentices ? storedApprentices : csvApprentices.map((user) => {
        const email = normalizeEmail(user.correo);
        const csvDocument = String(user.identificacion).trim();
        const stored = storedApprentices.find((item) => item.document === csvDocument || normalizeEmail(item.email) === email) || {};
        const document = /^\d+$/.test(String(stored.document || "")) ? String(stored.document) : csvDocument;
        return {
            ...stored,
            id: stored.id || `aprendiz-${document}`,
            document,
            name: String(user.nombre || stored.name || "Aprendiz").trim(),
            email,
            phone: stored.phone || "",
            address: stored.address || "",
            role: "Aprendiz",
            status: canonicalUserStatus(user.estado) || "Activo",
            program: {
                code: stored.program?.code || String(user.ficha || "").trim(),
                name: stored.program?.name || "Programa de formación",
                level: stored.program?.level || "Por definir",
                ficha: String(user.ficha || stored.program?.ficha || "").trim(),
                schedule: stored.program?.schedule || "Por definir",
                mode: stored.program?.mode || "Por definir",
                status: (canonicalUserStatus(user.estado) || "Activo") === "Activo" ? (stored.program?.status || "En formación") : "Inactivo"
            },
            attendance: Array.isArray(stored.attendance) ? stored.attendance : []
        };
    });
    if (!options.apprentices) {
        managedUsers.filter((user) => String(user.role || "").toLowerCase() === "aprendiz").forEach((user) => {
            if (apprentices.some((item) => item.document === user.document || normalizeEmail(item.email) === normalizeEmail(user.email))) return;
            const stored = storedApprentices.find((item) => item.document === user.document || normalizeEmail(item.email) === normalizeEmail(user.email)) || {};
            apprentices.push({
                ...stored,
                id: user.id,
                document: user.document,
                name: user.name,
                email: user.email,
                phone: user.phone || stored.phone || "",
                address: stored.address || "",
                role: "Aprendiz",
                status: canonicalUserStatus(user.status) || "Activo",
                program: {
                    code: user.ficha || stored.program?.code || "Por definir",
                    name: stored.program?.name || "Programa de formación",
                    level: stored.program?.level || "Por definir",
                    ficha: user.ficha || stored.program?.ficha || "Por definir",
                    schedule: stored.program?.schedule || "Por definir",
                    mode: stored.program?.mode || "Por definir",
                    status: (canonicalUserStatus(user.status) || "Activo") === "Activo" ? (stored.program?.status || "En formación") : "Inactivo"
                },
                attendance: Array.isArray(stored.attendance) ? stored.attendance : []
            });
        });
    }
    const attendanceRecords = options.attendanceRecords
        ? JSON.parse(JSON.stringify(options.attendanceRecords))
        : (fs.existsSync(attendanceFile) ? JSON.parse(fs.readFileSync(attendanceFile, "utf8")) : []);
    const sqlData = options.sqlData || {
        ambientes: loadSqlTable("ambientes", ["id", "codigo", "nombre", "capacidad", "tipo", "estado", "zona"]),
        fichas: loadSqlTable("fichas", ["id", "numero", "jornada", "modalidad", "estado", "programaId", "instructorId"]),
        horarios: loadSqlTable("horarios", ["id", "dia", "horaInicio", "horaFin", "fichaId", "ambienteId", "instructorId"]),
        programas: loadSqlTable("programas", ["id", "nombre", "nivel", "duracion", "estado"])
    };
    const programsFile = path.join(dataDirectory, "programas.json");
    const programRecords = options.programs
        ? JSON.parse(JSON.stringify(options.programs))
        : (!options.sqlData && fs.existsSync(programsFile)
            ? JSON.parse(fs.readFileSync(programsFile, "utf8"))
            : JSON.parse(JSON.stringify(sqlData.programas || [])));
    sqlData.programas = programRecords;

    function persistApprentices() {
        if (options.apprentices) return;
        const temporary = `${apprenticesFile}.tmp`;
        fs.writeFileSync(temporary, `${JSON.stringify(apprentices, null, 2)}\n`, "utf8");
        fs.renameSync(temporary, apprenticesFile);
    }

    function persistManagedUsers() {
        if (options.managedUsers || options.apprentices) return;
        const temporary = `${managedUsersFile}.tmp`;
        fs.writeFileSync(temporary, `${JSON.stringify(managedUsers, null, 2)}\n`, "utf8");
        fs.renameSync(temporary, managedUsersFile);
    }

    function persistAttendance() {
        if (options.attendanceRecords) return;
        const temporary = `${attendanceFile}.tmp`;
        fs.writeFileSync(temporary, `${JSON.stringify(attendanceRecords, null, 2)}\n`, "utf8");
        fs.renameSync(temporary, attendanceFile);
    }

    function persistCsvUsers() {
        if (options.csvUsers || (options.apprentices && !options.usersCsvFile)) return;
        const temporary = `${usersCsvFile}.tmp`;
        fs.writeFileSync(temporary, serializeCsvUsers(csvUsers), "utf8");
        fs.renameSync(temporary, usersCsvFile);
    }

    function persistPrograms() {
        if (options.programs || options.sqlData) return;
        const temporary = `${programsFile}.tmp`;
        fs.writeFileSync(temporary, `${JSON.stringify(programRecords, null, 2)}\n`, "utf8");
        fs.renameSync(temporary, programsFile);
    }

    function persistAuthState() {
        writeJsonFileAtomic(authStateFile, {
            version: 1,
            savedAt: new Date().toISOString(),
            codes: [...codes.entries()].map(([document, item]) => ({ document, ...item })),
            hourlyRequests: [...hourlyRequests.entries()].map(([key, item]) => ({ key, ...item }))
        });
    }

    function appendEmailHistory(entry) {
        emailHistory.push({
            timestamp: new Date().toISOString(),
            ...entry
        });
        emailHistory = emailHistory.slice(-config.emailHistoryLimit);
        writeJsonFileAtomic(emailHistoryFile, emailHistory);
    }

    function publicEmailHistory() {
        return emailHistory.slice(-100).reverse().map((entry) => ({
            timestamp: entry.timestamp,
            requestId: entry.requestId,
            recipient: entry.recipient,
            provider: entry.provider,
            status: entry.status,
            attempts: entry.attempts,
            durationMs: entry.durationMs,
            providerMessageId: entry.providerMessageId || null,
            errorCode: entry.errorCode || null,
            message: entry.message || null
        }));
    }

    function hashCode(email, code) {
        return crypto.createHmac("sha256", config.otpSecret).update(`${email}:${code}`).digest("hex");
    }

    function verifyPassword(account, password) {
        const calculated = crypto.scryptSync(String(password || ""), account.salt, 64).toString("hex");
        return safeEqual(account.passwordHash, calculated);
    }

    function publicApprentice(apprentice) {
        return {
            id: apprentice.id,
            document: apprentice.document,
            name: apprentice.name,
            email: apprentice.email,
            phone: apprentice.phone,
            address: apprentice.address,
            role: "Aprendiz",
            picture: "logo_sena.png",
            program: apprentice.program,
            attendance: apprentice.attendance
        };
    }

    function currentAcademicPeriod(reference = new Date()) {
        const quarter = Math.floor(reference.getMonth() / 3) + 1;
        return {
            value: `${reference.getFullYear()}-Q${quarter}`,
            label: `Periodo ${quarter} - ${reference.getFullYear()}`,
            from: dateKey(new Date(reference.getFullYear(), (quarter - 1) * 3, 1, 12)),
            to: dateKey(reference)
        };
    }

    function academicCommitteeCases(reference = new Date()) {
        const period = currentAcademicPeriod(reference);
        return apprentices.map((apprentice) => {
            const unjustifiedAbsences = attendanceRecords.filter((record) =>
                String(record.identificacion) === String(apprentice.document)
                && record.estado === "ausente"
                && record.fecha >= period.from
                && record.fecha <= period.to
            ).length;
            return unjustifiedAbsences > 4 ? {
                apprenticeId: apprentice.id,
                document: apprentice.document,
                name: apprentice.name,
                ficha: apprentice.program?.ficha || apprentice.program?.code || "",
                unjustifiedAbsences,
                threshold: 4,
                period: period.value,
                periodLabel: period.label
            } : null;
        }).filter(Boolean).sort((left, right) => right.unjustifiedAbsences - left.unjustifiedAbsences || left.name.localeCompare(right.name, "es"));
    }

    function academicAlertFor(apprentice) {
        const academicCase = academicCommitteeCases().find((item) => item.document === apprentice.document);
        if (!academicCase) return null;
        return {
            type: "academic-committee",
            title: "Alerta de asistencia",
            message: `Superaste el límite de ${academicCase.threshold} fallas sin justificación. Tu caso será remitido al Comité Académico para revisión.`,
            ...academicCase
        };
    }

    function createSession(response, user) {
        const token = crypto.randomBytes(32).toString("base64url");
        const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
        sessions.set(token, { user, expiresAt, academicAlertShown: false });
        const cookie = `sena_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${8 * 60 * 60}${config.secureCookie ? "; Secure" : ""}`;
        sendJson(response, 200, { ok: true, user }, { "Set-Cookie": cookie });
    }

    function currentSession(request) {
        const token = readCookies(request).sena_session;
        const session = token ? sessions.get(token) : null;
        if (!session || session.expiresAt <= Date.now()) {
            if (token) sessions.delete(token);
            return null;
        }
        return { token, ...session };
    }

    function emailIsAllowed(email) {
        if (config.allowedEmails.length && !config.allowedEmails.includes(email)) return false;
        if (config.allowedDomain && !email.endsWith(`@${config.allowedDomain}`)) return false;
        return true;
    }

    function cleanExpired() {
        const now = Date.now();
        let authStateChanged = false;
        for (const [document, item] of codes) {
            if (item.expiresAt <= now) {
                codes.delete(document);
                authStateChanged = true;
            }
        }
        for (const [token, item] of sessions) if (item.expiresAt <= now) sessions.delete(token);
        for (const [key, item] of hourlyRequests) {
            if (item.windowEndsAt <= now) {
                hourlyRequests.delete(key);
                authStateChanged = true;
            }
        }
        if (authStateChanged) persistAuthState();
    }

    async function handlePasswordLogin(request, response) {
        const body = await readJsonBody(request);
        const identifier = String(body.identifier || body.email || "").trim().toLowerCase();
        const email = normalizeEmail(identifier);
        const account = accounts.find((item) => item.username === identifier || (email && item.email === email));
        if (!account || !verifyPassword(account, body.password)) {
            return sendJson(response, 401, { ok: false, message: "Usuario, correo o contraseña incorrectos." });
        }
        if ((canonicalUserStatus(account.status) || "Activo") !== "Activo") {
            return sendJson(response, 403, { ok: false, message: "Esta cuenta se encuentra desactivada." });
        }
        return createSession(response, {
            id: account.id,
            username: account.username,
            name: account.name,
            email: account.email,
            role: account.role,
            picture: "logo_sena.png",
            method: "password"
        });
    }

    async function handleRequestCode(request, response) {
        const { document: rawDocument } = await readJsonBody(request);
        const document = String(rawDocument || "").replace(/\D/g, "");
        const user = codeAccessUser(document);
        if (!user) return sendJson(response, 404, { ok: false, message: "La identificación no corresponde a un usuario registrado." });
        if (!codeAccessUserIsEnabled(user)) return sendJson(response, 403, { ok: false, message: "La cuenta del usuario se encuentra desactivada." });
        const email = normalizeEmail(user.email);
        if (!emailIsAllowed(email)) return sendJson(response, 403, { ok: false, message: "Este correo no está autorizado para ingresar." });

        const now = Date.now();
        const existing = codes.get(document);
        if (existing && existing.nextSendAt > now) {
            const seconds = Math.ceil((existing.nextSendAt - now) / 1000);
            return sendJson(response, 429, { ok: false, message: `Espera ${seconds} segundos antes de solicitar otro código.` });
        }

        const clientKey = crypto.createHash("sha256")
            .update(`${request.socket.remoteAddress || "local"}:${document}`)
            .digest("hex");
        const rate = hourlyRequests.get(clientKey);
        if (rate && rate.windowEndsAt > now && rate.count >= 5) {
            return sendJson(response, 429, { ok: false, message: "Alcanzaste el límite de códigos por hora." });
        }
        if (pendingCodeRequests.has(document)) {
            return sendJson(response, 429, { ok: false, message: "Ya hay un código en proceso de envío. Espera un momento." });
        }

        const code = crypto.randomInt(0, 1000000).toString().padStart(6, "0");
        const requestId = crypto.randomUUID();
        pendingCodeRequests.add(document);
        try {
            await emailService.enqueueVerificationCode(user, code, requestId);
            codes.set(document, {
                hash: hashCode(email, code),
                email,
                expiresAt: now + 10 * 60 * 1000,
                nextSendAt: now + 60 * 1000,
                attempts: 0
            });
            hourlyRequests.set(clientKey, {
                count: rate && rate.windowEndsAt > now ? rate.count + 1 : 1,
                windowEndsAt: rate && rate.windowEndsAt > now ? rate.windowEndsAt : now + 60 * 60 * 1000
            });
            persistAuthState();

            const maskedEmail = maskEmail(email);
            const result = { ok: true, message: `Código enviado a ${maskedEmail}. Revisa también la carpeta de spam.` };
            if (config.exposeTestCode) result.testCode = code;
            return sendJson(response, 200, result);
        } finally {
            pendingCodeRequests.delete(document);
        }
    }

    async function handleVerifyCode(request, response) {
        const body = await readJsonBody(request);
        const document = String(body.document || "").replace(/\D/g, "");
        const code = String(body.code || "").trim();
        if (!document || !/^\d{6}$/.test(code)) {
            return sendJson(response, 400, { ok: false, message: "Ingresa la cédula y el código de seis dígitos." });
        }

        const pending = codes.get(document);
        if (!pending || pending.expiresAt <= Date.now()) {
            codes.delete(document);
            persistAuthState();
            return sendJson(response, 401, { ok: false, message: "El código venció. Solicita uno nuevo." });
        }
        pending.attempts += 1;
        if (pending.attempts > 5) {
            codes.delete(document);
            persistAuthState();
            return sendJson(response, 429, { ok: false, message: "Demasiados intentos. Solicita un código nuevo." });
        }
        if (!safeEqual(pending.hash, hashCode(pending.email, code))) {
            persistAuthState();
            return sendJson(response, 401, { ok: false, message: "El código no es correcto." });
        }

        codes.delete(document);
        persistAuthState();
        const user = codeAccessUser(document);
        if (!user || normalizeEmail(user.email) !== pending.email) return sendJson(response, 404, { ok: false, message: "No se encontró el perfil del usuario." });
        if (!codeAccessUserIsEnabled(user)) return sendJson(response, 403, { ok: false, message: "La cuenta del usuario se encuentra desactivada." });
        return createSession(response, publicCodeAccessUser(user));
    }

    function handleSession(request, response) {
        const session = currentSession(request);
        if (!session) return sendJson(response, 200, { authenticated: false });
        return sendJson(response, 200, { authenticated: true, user: session.user });
    }

    function handleEmailStatus(_request, response) {
        const emailHealth = emailService.getHealth();
        const configured = emailHealth.configured;
        const lastDelivery = emailHistory.at(-1) || null;
        const lastSuccess = [...emailHistory].reverse().find((entry) => entry.status === "accepted") || null;
        const recentFailures = emailHistory.slice(-20).filter((entry) => entry.status === "failed").length;
        const readyMessage = resendTestMode
            ? "Resend está disponible en modo de prueba. Para enviar a cualquier correo configura un dominio verificado o Gmail."
            : emailHealth.message;
        return sendJson(response, 200, {
            ok: true,
            configured,
            provider: selectedEmailProvider,
            ready: emailHealth.ready,
            checkedAt: emailHealth.checkedAt,
            mode: resendTestMode ? "test" : "production",
            lastDeliveryAt: lastDelivery?.timestamp || null,
            lastSuccessAt: lastSuccess?.timestamp || null,
            recentFailures,
            message: configured
                ? readyMessage
                : `Falta configurar el envío por ${selectedEmailProvider === "gmail" ? "Gmail" : "Resend"}.`
        });
    }

    function handleEmailHistory(request, response) {
        const session = requireAdministrator(request, response);
        if (!session) return;
        return sendJson(response, 200, {
            ok: true,
            provider: selectedEmailProvider,
            mode: resendTestMode ? "test" : "production",
            deliveries: publicEmailHistory()
        });
    }

    function handleSystemHealth(_request, response) {
        const emailHealth = emailService.getHealth();
        return sendJson(response, 200, {
            ok: true,
            service: "sistema-asistencia-sena",
            status: "ready",
            startedAt: serverStartedAt,
            uptimeSeconds: Math.floor(process.uptime()),
            email: {
                provider: selectedEmailProvider,
                configured: emailHealth.configured,
                ready: emailHealth.ready,
                checkedAt: emailHealth.checkedAt,
                mode: resendTestMode ? "test" : "production"
            }
        });
    }

    function handleLogout(request, response) {
        const token = readCookies(request).sena_session;
        if (token) sessions.delete(token);
        const cookie = `sena_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${config.secureCookie ? "; Secure" : ""}`;
        return sendJson(response, 200, { ok: true }, { "Set-Cookie": cookie });
    }

    function requireApprentice(request, response) {
        const session = currentSession(request);
        if (!session || session.user.role !== "Aprendiz") {
            sendJson(response, 403, { ok: false, message: "Acceso exclusivo para aprendices." });
            return null;
        }
        return session;
    }

    function handleApprenticeProfile(request, response) {
        const session = requireApprentice(request, response);
        if (!session) return;
        const apprentice = apprentices.find((item) => item.id === session.user.id);
        if (!apprentice) return sendJson(response, 404, { ok: false, message: "No se encontró el perfil." });
        const storedSession = sessions.get(session.token);
        const academicAlert = storedSession?.academicAlertShown ? null : academicAlertFor(apprentice);
        if (academicAlert && storedSession) storedSession.academicAlertShown = true;
        return sendJson(response, 200, { ok: true, apprentice: publicApprentice(apprentice), academicAlert });
    }

    async function handleApprenticeUpdate(request, response) {
        const session = requireApprentice(request, response);
        if (!session) return;
        const body = await readJsonBody(request);
        const apprentice = apprentices.find((item) => item.id === session.user.id);
        if (!apprentice) return sendJson(response, 404, { ok: false, message: "No se encontró el perfil." });
        apprentice.phone = String(body.phone || "").trim().slice(0, 30);
        apprentice.address = String(body.address || "").trim().slice(0, 160);
        persistApprentices();
        session.user = { ...session.user, phone: apprentice.phone, address: apprentice.address };
        return sendJson(response, 200, { ok: true, apprentice: publicApprentice(apprentice), message: "Datos actualizados correctamente." });
    }

    function requireStaff(request, response) {
        const session = currentSession(request);
        const role = String(session?.user?.role || "").trim().toLowerCase();
        if (!session || !["administrador", "instructor", "coordinador"].includes(role)) {
            sendJson(response, 403, { ok: false, message: "Acceso exclusivo para instructores, coordinadores y administradores." });
            return null;
        }
        return session;
    }

    function attendanceFichas() {
        const byCode = new Map();
        apprentices.filter(apprenticeIsEnabled).forEach((apprentice) => {
            const code = String(apprentice.program?.ficha || apprentice.program?.code || "").trim();
            if (!code || byCode.has(code)) return;
            byCode.set(code, {
                codigo: code,
                programa: String(apprentice.program?.name || "Programa de formación"),
                jornada: String(apprentice.program?.schedule || "Por definir")
            });
        });
        return [...byCode.values()].sort((left, right) => left.codigo.localeCompare(right.codigo, "es", { numeric: true }));
    }

    function handleAttendanceData(request, response, requestUrl) {
        const session = requireStaff(request, response);
        if (!session) return;
        const ficha = String(requestUrl.searchParams.get("ficha") || "").trim();
        const fecha = String(requestUrl.searchParams.get("fecha") || "").trim();
        const jornada = String(requestUrl.searchParams.get("jornada") || "").trim();
        const fichas = attendanceFichas();
        if (!ficha) {
            return sendJson(response, 200, { ok: true, usuario: session.user, fichas, aprendices: [] });
        }
        if (!fichas.some((item) => item.codigo === ficha)) {
            return sendJson(response, 404, { ok: false, message: "La ficha seleccionada no existe." });
        }
        const latestByDocument = new Map();
        attendanceRecords
            .filter((item) => item.ficha === ficha && item.fecha === fecha && item.jornada === jornada)
            .forEach((item) => latestByDocument.set(item.identificacion, item));
        const selected = apprentices
            .filter((item) => apprenticeIsEnabled(item) && String(item.program?.ficha || item.program?.code || "") === ficha)
            .map((item) => {
                const saved = latestByDocument.get(item.document);
                return {
                    identificacion: item.document,
                    nombre: item.name,
                    ficha,
                    estado: saved?.estado || "presente",
                    observacion: saved?.observacion || ""
                };
            })
            .sort((left, right) => left.nombre.localeCompare(right.nombre, "es"));
        const lastUpdated = [...latestByDocument.values()]
            .map((item) => item.hora_registro)
            .filter(Boolean)
            .sort()
            .at(-1) || null;
        return sendJson(response, 200, {
            ok: true,
            usuario: session.user,
            fichas,
            aprendices: selected,
            ultima_actualizacion: lastUpdated
        });
    }

    async function handleAttendanceSave(request, response) {
        const session = requireStaff(request, response);
        if (!session) return;
        const body = await readJsonBody(request);
        const ficha = String(body.ficha || "").trim();
        const fecha = String(body.fecha || "").trim();
        const jornada = String(body.jornada || "").trim();
        const estados = new Set(["presente", "tardanza", "ausente", "justificado"]);
        const jornadas = new Set(["Mañana", "Tarde", "Noche"]);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !jornadas.has(jornada) || !/^\d+$/.test(ficha)) {
            return sendJson(response, 400, { ok: false, message: "Revisa la ficha, la fecha y la jornada." });
        }
        if (!Array.isArray(body.aprendices) || !body.aprendices.length) {
            return sendJson(response, 400, { ok: false, message: "No hay aprendices para guardar." });
        }
        const allowed = new Map(apprentices
            .filter((item) => apprenticeIsEnabled(item) && String(item.program?.ficha || item.program?.code || "") === ficha)
            .map((item) => [item.document, item]));
        const received = new Set();
        const records = [];
        const now = new Date().toISOString();
        for (const raw of body.aprendices) {
            const identificacion = String(raw.identificacion || "").trim();
            const estado = String(raw.estado || "").trim().toLowerCase();
            const apprentice = allowed.get(identificacion);
            if (!apprentice || received.has(identificacion) || !estados.has(estado)) {
                return sendJson(response, 400, { ok: false, message: "La lista de asistencia contiene datos no válidos." });
            }
            received.add(identificacion);
            records.push({
                identificacion,
                nombre: apprentice.name,
                ficha,
                fecha,
                jornada,
                estado,
                observacion: String(raw.observacion || "").trim().slice(0, 200),
                hora_registro: now,
                registrado_por: session.user.email || session.user.name || session.user.id
            });
        }
        if (received.size !== allowed.size) {
            return sendJson(response, 400, { ok: false, message: "Debes guardar la asistencia de todos los aprendices de la ficha." });
        }
        for (let index = attendanceRecords.length - 1; index >= 0; index -= 1) {
            const item = attendanceRecords[index];
            if (item.ficha === ficha && item.fecha === fecha && item.jornada === jornada) attendanceRecords.splice(index, 1);
        }
        attendanceRecords.push(...records);
        persistAttendance();
        return sendJson(response, 200, {
            ok: true,
            guardados: records.length,
            ultima_actualizacion: now,
            message: `Asistencia guardada para ${records.length} aprendices.`
        });
    }

    function requireAdministrator(request, response) {
        const session = currentSession(request);
        const role = String(session?.user?.role || "").trim().toLowerCase();
        if (!session || !["administrador", "coordinador"].includes(role)) {
            sendJson(response, 403, { ok: false, message: "Esta función es exclusiva para administradores y coordinadores." });
            return null;
        }
        return session;
    }

    function adminProfile() {
        const account = builtInAccounts[0];
        return {
            id: account.id,
            username: account.username,
            name: account.name,
            email: account.email,
            role: account.role,
            picture: "logo_sena.png",
            method: "password"
        };
    }

    function saveAdminAccount() {
        // Durante las pruebas las credenciales viven en memoria. La instalación normal sí las conserva.
        if (!persistentRuntime && !options.adminCredentialsFile) return;
        const account = builtInAccounts[0];
        writeJsonFileAtomic(adminCredentialsFile, {
            salt: account.salt,
            passwordHash: account.passwordHash,
            name: account.name,
            email: account.email,
            updatedAt: new Date().toISOString()
        });
    }

    function refreshAdminSessions() {
        const profile = adminProfile();
        for (const session of sessions.values()) {
            if (session.user?.id === profile.id) session.user = { ...session.user, ...profile };
        }
    }

    async function handleAdminProfile(request, response) {
        const session = requireAdministrator(request, response);
        if (!session) return;
        if (session.user.id !== "admin-sena") {
            return sendJson(response, 403, { ok: false, message: "Solo la cuenta administrativa principal puede modificar este perfil." });
        }

        if (request.method === "GET") {
            return sendJson(response, 200, { ok: true, user: adminProfile() });
        }

        const body = await readJsonBody(request);
        const name = String(body.name || "").trim().replace(/\s+/g, " ");
        const email = normalizeEmail(body.email);
        if (name.length < 3 || name.length > 120) {
            return sendJson(response, 400, { ok: false, message: "Escribe un nombre válido de 3 a 120 caracteres." });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return sendJson(response, 400, { ok: false, message: "Escribe un correo electrónico válido." });
        }
        if (systemUsers().some((user) => user.id !== "admin-sena" && normalizeEmail(user.email) === email)) {
            return sendJson(response, 409, { ok: false, message: "Ese correo ya pertenece a otro usuario." });
        }

        const account = builtInAccounts[0];
        account.name = name;
        account.email = email;
        adminCredentials.name = name;
        adminCredentials.email = email;
        saveAdminAccount();
        refreshAdminSessions();
        return sendJson(response, 200, { ok: true, user: adminProfile(), message: "Perfil actualizado correctamente." });
    }

    async function handleAdminPasswordChange(request, response) {
        const session = requireAdministrator(request, response);
        if (!session) return;
        if (session.user.id !== "admin-sena") {
            return sendJson(response, 403, { ok: false, message: "Solo la cuenta administrativa principal puede cambiar esta contraseña." });
        }

        const body = await readJsonBody(request);
        const currentPassword = String(body.currentPassword || "");
        const newPassword = String(body.newPassword || "");
        const account = builtInAccounts[0];

        if (!verifyPassword(account, currentPassword)) {
            return sendJson(response, 401, { ok: false, message: "La contraseña actual no es correcta." });
        }
        if (newPassword.length < 10) {
            return sendJson(response, 400, { ok: false, message: "La nueva contraseña debe tener al menos 10 caracteres." });
        }
        if (currentPassword === newPassword) {
            return sendJson(response, 400, { ok: false, message: "La contraseña nueva debe ser diferente de la actual." });
        }

        account.salt = crypto.randomBytes(16).toString("hex");
        account.passwordHash = crypto.scryptSync(newPassword, account.salt, 64).toString("hex");
        adminCredentials.salt = account.salt;
        adminCredentials.passwordHash = account.passwordHash;
        saveAdminAccount();
        // La sesión que hizo el cambio continúa; las demás sesiones administrativas se cierran.
        for (const [token, storedSession] of sessions) {
            if (token !== session.token && storedSession.user?.id === "admin-sena") sessions.delete(token);
        }
        return sendJson(response, 200, { ok: true, message: "Contraseña actualizada correctamente." });
    }

    function publicProgram(program) {
        const linkedFichas = sqlData.fichas
            .filter((ficha) => String(ficha.programaId) === String(program.id))
            .map((ficha) => ({
                id: ficha.id,
                number: String(ficha.numero || ""),
                journey: normalizeSqlText(ficha.jornada),
                modality: String(ficha.modalidad || "Sin definir").trim(),
                status: String(ficha.estado || "Sin definir").trim(),
                instructorId: ficha.instructorId ?? null
            }))
            .sort((left, right) => left.number.localeCompare(right.number, "es", { numeric: true }));
        const modalities = [...new Set(linkedFichas.map((ficha) => ficha.modality).filter(Boolean))];
        const instructors = new Set(linkedFichas.map((ficha) => ficha.instructorId).filter((value) => value !== null && value !== ""));
        return {
            code: String(program.id),
            name: String(program.nombre || "").trim(),
            level: displayProgramLevel(program.nivel),
            duration: String(program.duracion || "").trim(),
            modality: modalities.length > 1 ? "Mixta" : (modalities[0] || "Sin fichas"),
            fichas: linkedFichas.length,
            instructors: instructors.size,
            status: canonicalProgramStatus(program.estado) || String(program.estado || "Inactivo").trim(),
            linkedFichas,
            createdAt: program.createdAt || null,
            updatedAt: program.updatedAt || null
        };
    }

    function programDirectoryPayload() {
        const programs = programRecords.map(publicProgram).sort((left, right) => left.name.localeCompare(right.name, "es"));
        const levels = [...new Set(programs.map((program) => program.level).filter(Boolean))].sort((left, right) => left.localeCompare(right, "es"));
        const states = [...new Set(programs.map((program) => program.status).filter(Boolean))].sort((left, right) => left.localeCompare(right, "es"));
        const modalities = [...new Set(programs.map((program) => program.modality).filter(Boolean))].sort((left, right) => left.localeCompare(right, "es"));
        const fichaFilters = new Map();
        programs.forEach((program) => (program.linkedFichas || []).forEach((ficha) => {
            if (!ficha.number || fichaFilters.has(ficha.number)) return;
            fichaFilters.set(ficha.number, {
                number: ficha.number,
                programCode: program.code,
                programName: program.name,
                journey: ficha.journey,
                modality: ficha.modality,
                status: ficha.status
            });
        }));
        const fichas = [...fichaFilters.values()].sort((left, right) => left.number.localeCompare(right.number, "es", { numeric: true }));
        const featured = [...programs].sort((left, right) => {
            if (right.fichas !== left.fichas) return right.fichas - left.fichas;
            const recent = String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || ""));
            return recent || right.code.localeCompare(left.code, "es", { numeric: true });
        })[0] || null;
        return {
            programs,
            summary: {
                active: programs.filter((program) => program.status === "Activo").length,
                levels: levels.length,
                levelNames: levels,
                fichas: programs.reduce((total, program) => total + program.fichas, 0),
                review: programs.filter((program) => program.status === "En revisión").length
            },
            filters: { levels, states, modalities, fichas },
            workflowStates: ["Activo", "Inactivo", "En revisión"],
            featured
        };
    }

    function handleProgramsData(request, response) {
        const session = requireStaff(request, response);
        if (!session) return;
        return sendJson(response, 200, { ok: true, ...programDirectoryPayload() });
    }

    async function handleProgramCreate(request, response) {
        const session = requireAdministrator(request, response);
        if (!session) return;
        const values = validateProgramInput(await readJsonBody(request));
        const normalizedName = normalizedProgramText(values.name);
        if (programRecords.some((program) => String(program.id) === values.code)) {
            return sendJson(response, 409, { ok: false, message: "Ya existe un programa con ese código." });
        }
        if (programRecords.some((program) => normalizedProgramText(program.nombre) === normalizedName)) {
            return sendJson(response, 409, { ok: false, message: "Ya existe un programa con ese nombre." });
        }
        const now = new Date().toISOString();
        const program = {
            id: Number(values.code),
            nombre: values.name,
            nivel: values.level,
            duracion: values.duration,
            estado: values.status,
            createdAt: now,
            updatedAt: now,
            createdBy: session.user.email || session.user.id
        };
        programRecords.push(program);
        persistPrograms();
        return sendJson(response, 201, {
            ok: true,
            message: "Programa creado correctamente.",
            program: publicProgram(program),
            ...programDirectoryPayload()
        });
    }

    async function handleProgramUpdate(request, response, code) {
        const session = requireAdministrator(request, response);
        if (!session) return;
        const program = programRecords.find((item) => String(item.id) === String(code));
        if (!program) return sendJson(response, 404, { ok: false, message: "No se encontró el programa solicitado." });
        const body = await readJsonBody(request);
        const values = validateProgramInput({
            code,
            name: body.name ?? program.nombre,
            level: body.level ?? program.nivel,
            duration: body.duration ?? program.duracion,
            status: body.status ?? program.estado
        }, code);
        if (programRecords.some((item) => item !== program && normalizedProgramText(item.nombre) === normalizedProgramText(values.name))) {
            return sendJson(response, 409, { ok: false, message: "Ya existe otro programa con ese nombre." });
        }
        program.nombre = values.name;
        program.nivel = values.level;
        program.duracion = values.duration;
        program.estado = values.status;
        program.updatedAt = new Date().toISOString();
        program.updatedBy = session.user.email || session.user.id;
        persistPrograms();
        return sendJson(response, 200, {
            ok: true,
            message: "Programa actualizado correctamente.",
            program: publicProgram(program),
            ...programDirectoryPayload()
        });
    }

    function csvIndexForTarget(target) {
        const document = String(target.document || "").trim();
        const email = normalizeEmail(target.email);
        let index = csvUsers.findIndex((user) =>
            String(user.identificacion || "").trim() === document
            && normalizeEmail(user.correo) === email
        );
        if (index < 0 && document) index = csvUsers.findIndex((user) => String(user.identificacion || "").trim() === document);
        if (index < 0 && email) index = csvUsers.findIndex((user) => normalizeEmail(user.correo) === email);
        return index;
    }

    function upsertCsvUser(user, previous = user) {
        const row = registryRowFromUser(user);
        const index = csvIndexForTarget(previous);
        if (index >= 0) csvUsers[index] = { ...csvUsers[index], ...row };
        else csvUsers.push(row);
    }

    function fichaProfile(code) {
        const ficha = sqlData.fichas.find((item) => String(item.numero || "") === String(code || ""));
        const program = sqlData.programas.find((item) => String(item.id) === String(ficha?.programaId));
        return {
            name: String(program?.nombre || "Programa de formación"),
            level: displayProgramLevel(program?.nivel || "Por definir"),
            schedule: normalizeSqlText(ficha?.jornada || "Por definir"),
            mode: String(ficha?.modalidad || "Presencial")
        };
    }

    function syncApprenticeProfile(user) {
        if (canonicalRole(user.role) !== "Aprendiz") return null;
        const document = String(user.document || "").trim();
        const email = normalizeEmail(user.email);
        const ficha = String(user.ficha || "").trim();
        let apprentice = apprentices.find((item) => item.document === document || normalizeEmail(item.email) === email);
        const metadata = fichaProfile(ficha);
        if (!apprentice) {
            apprentice = { id: user.id || `aprendiz-${document}`, address: "", attendance: [] };
            apprentices.push(apprentice);
        }
        apprentice.document = document;
        apprentice.name = String(user.name || "Aprendiz").trim();
        apprentice.email = email;
        apprentice.phone = String(user.phone || apprentice.phone || "").trim();
        apprentice.role = "Aprendiz";
        apprentice.status = canonicalUserStatus(user.status) || "Activo";
        apprentice.program = {
            code: ficha,
            name: metadata.name,
            level: metadata.level,
            ficha,
            schedule: metadata.schedule,
            mode: metadata.mode,
            status: apprentice.status === "Activo" ? "En formación" : "Inactivo"
        };
        if (!Array.isArray(apprentice.attendance)) apprentice.attendance = [];
        return apprentice;
    }

    function userIsProtected(user) {
        return builtInAccounts.some((account) => account.id === user?.id);
    }

    function invalidateUserSessions(user) {
        for (const [token, session] of sessions.entries()) {
            if (session.user?.id === user.id || (user.email && normalizeEmail(session.user?.email) === normalizeEmail(user.email))) sessions.delete(token);
        }
    }

    function apprenticeIsEnabled(apprentice) {
        const document = String(apprentice?.document || "").trim();
        const email = normalizeEmail(apprentice?.email);
        const registry = csvUsers.find((user) =>
            String(user.identificacion || "").trim() === document
            && (!email || normalizeEmail(user.correo) === email)
        );
        if (registry) return canonicalRole(registry.rol) === "Aprendiz" && canonicalUserStatus(registry.estado) === "Activo";
        const managed = managedUsers.find((user) => user.document === document || normalizeEmail(user.email) === email);
        return managed ? canonicalRole(managed.role) === "Aprendiz" && (canonicalUserStatus(managed.status) || "Activo") === "Activo" : true;
    }

    function codeAccessUser(document) {
        const normalizedDocument = String(document || "").replace(/\D/g, "");
        if (!normalizedDocument) return null;
        const registryMatches = csvUsers.filter((row) =>
            String(row.identificacion || "").trim() === normalizedDocument
            && normalizeEmail(row.correo)
        );
        if (registryMatches.length) {
            const activeMatches = registryMatches.filter((row) => (canonicalUserStatus(row.estado) || "Activo") === "Activo");
            const candidates = activeMatches.length ? activeMatches : registryMatches;
            const row = candidates.find((item) => canonicalRole(item.rol) === "Aprendiz") || candidates[0];
            return {
                id: `usuario-${normalizedDocument}`,
                document: normalizedDocument,
                documentType: String(row.tipo_documento || "Cédula de Ciudadanía").trim(),
                name: String(row.nombre || "Usuario").trim(),
                email: normalizeEmail(row.correo),
                role: canonicalRole(row.rol),
                status: canonicalUserStatus(row.estado) || "Activo",
                ficha: String(row.ficha || "").trim()
            };
        }
        return systemUsers().find((user) => user.document === normalizedDocument && normalizeEmail(user.email)) || null;
    }

    function codeAccessUserIsEnabled(user) {
        const document = String(user?.document || "").trim();
        const email = normalizeEmail(user?.email);
        const registry = csvUsers.find((row) =>
            String(row.identificacion || "").trim() === document
            && normalizeEmail(row.correo) === email
        );
        if (registry) return canonicalUserStatus(registry.estado) === "Activo" && canonicalRole(registry.rol) !== "Usuario";
        return (canonicalUserStatus(user?.status) || "Activo") === "Activo" && canonicalRole(user?.role) !== "Usuario";
    }

    function publicCodeAccessUser(user, method = "email") {
        if (canonicalRole(user.role) === "Aprendiz") {
            const apprentice = apprentices.find((item) =>
                item.document === user.document
                && normalizeEmail(item.email) === normalizeEmail(user.email)
            );
            if (apprentice) return { ...publicApprentice(apprentice), method };
        }
        return {
            id: user.id,
            document: user.document,
            documentType: user.documentType,
            name: user.name,
            email: user.email,
            role: canonicalRole(user.role),
            status: canonicalUserStatus(user.status) || "Activo",
            ficha: user.ficha || "",
            picture: "logo_sena.png",
            method
        };
    }

    function systemUsers() {
        const users = new Map();
        const add = (user) => {
            const email = normalizeEmail(user.email || user.correo);
            const document = String(user.document || user.identificacion || "").trim();
            const id = String(user.id || document || email || crypto.randomUUID());
            const key = document ? `document:${document}` : email ? `email:${email}` : `id:${id}`;
            const existing = users.get(key) || {};
            users.set(key, {
                id,
                username: String(user.username || user.usuario || existing.username || "").trim(),
                document: document || existing.document || "",
                documentType: String(user.documentType || user.tipo_documento || existing.documentType || "Cédula de Ciudadanía"),
                name: String(user.name || user.nombre || existing.name || "Usuario").trim(),
                email: email || existing.email || "",
                phone: String(user.phone || user.telefono || existing.phone || "").trim(),
                role: canonicalRole(user.role || user.rol || existing.role),
                status: canonicalUserStatus(user.status || user.estado || existing.status) || "Activo",
                ficha: String(user.ficha || user.program?.ficha || user.program?.code || existing.ficha || "").trim(),
                createdAt: user.createdAt || existing.createdAt || null,
                protected: builtInAccounts.some((account) => account.id === id) || Boolean(existing.protected)
            });
        };
        csvUsers.forEach(add);
        apprentices.forEach(add);
        accounts.forEach(add);
        return [...users.values()].sort((left, right) => {
            if (left.createdAt && right.createdAt) return String(right.createdAt).localeCompare(String(left.createdAt));
            if (left.createdAt) return -1;
            if (right.createdAt) return 1;
            return left.name.localeCompare(right.name, "es");
        });
    }

    function userDirectoryPayload() {
        const users = systemUsers();
        return {
            users,
            summary: {
                total: users.length,
                instructors: users.filter((user) => user.role === "Instructor" && user.status.toLowerCase() === "activo").length,
                students: users.filter((user) => user.role === "Aprendiz" && user.status.toLowerCase() === "activo").length,
                administrators: users.filter((user) => user.role === "Administrador" && user.status.toLowerCase() === "activo").length,
                coordinators: users.filter((user) => user.role === "Coordinador" && user.status.toLowerCase() === "activo").length
            },
            fichas: attendanceFichas()
        };
    }

    function handleUsersData(request, response) {
        const session = requireAdministrator(request, response);
        if (!session) return;
        return sendJson(response, 200, { ok: true, ...userDirectoryPayload() });
    }

    async function handleUserCreate(request, response) {
        const session = requireAdministrator(request, response);
        if (!session) return;
        const body = await readJsonBody(request);
        const username = String(body.username || "").trim().toLowerCase();
        const document = String(body.identificacion ?? body.document ?? "").replace(/\D/g, "");
        const firstName = String(body.firstName || "").trim();
        const lastName = String(body.lastName || "").trim();
        const name = String(body.nombre ?? body.name ?? `${firstName} ${lastName}`).trim();
        const email = normalizeEmail(body.correo ?? body.email);
        const phone = String(body.phone || "").trim().slice(0, 30);
        const role = canonicalRole(body.rol ?? body.role);
        const status = canonicalUserStatus(body.estado ?? body.status ?? "Activo");
        const documentType = String(body.tipo_documento ?? body.documentType ?? "Cédula de Ciudadanía").trim();
        const password = String(body.password || "");
        const ficha = String(body.ficha || "").trim();
        const allowedRoles = new Set(["Administrador", "Instructor", "Aprendiz", "Coordinador"]);
        const allowedDocumentTypes = new Set(["Cédula de Ciudadanía", "Tarjeta de Identidad", "Cédula de Extranjería", "Pasaporte", "Permiso de protección temporal"]);
        if (!/^\d{6,15}$/.test(document) || !name || name.length > 160 || !email || !allowedRoles.has(role) || !status || !allowedDocumentTypes.has(documentType)) {
            return sendJson(response, 400, { ok: false, message: "Revisa la identificación, el tipo de documento, el nombre, el correo, el rol y el estado." });
        }
        if (username && !/^[a-z0-9._-]{3,32}$/.test(username)) return sendJson(response, 400, { ok: false, message: "El nombre de usuario no es válido." });
        if ((username || password) && (!username || password.length < 8)) return sendJson(response, 400, { ok: false, message: "Las cuentas antiguas con contraseña requieren usuario y una clave de al menos 8 caracteres." });
        if (role === "Aprendiz" && !/^\d+$/.test(ficha)) return sendJson(response, 400, { ok: false, message: "Selecciona la ficha del aprendiz." });
        if (ficha && !/^\d+$/.test(ficha)) return sendJson(response, 400, { ok: false, message: "La ficha debe contener únicamente números." });
        const users = systemUsers();
        if (users.some((user) => user.document === document)) return sendJson(response, 409, { ok: false, message: "Ya existe un usuario con ese documento." });
        if (users.some((user) => normalizeEmail(user.email) === email)) return sendJson(response, 409, { ok: false, message: "Ya existe un usuario con ese correo." });
        if (csvUsers.some((user) => String(user.identificacion || "").trim() === document)) return sendJson(response, 409, { ok: false, message: "El documento ya existe en usuarios_activos.csv." });
        if (csvUsers.some((user) => normalizeEmail(user.correo) === email)) return sendJson(response, 409, { ok: false, message: "El correo ya existe en usuarios_activos.csv." });
        if (username && accounts.some((user) => String(user.username || "").toLowerCase() === username)) return sendJson(response, 409, { ok: false, message: "Ese nombre de usuario ya está en uso." });

        const id = `usuario-${crypto.randomUUID()}`;
        const createdAt = new Date().toISOString();
        const user = {
            id,
            username,
            document,
            documentType,
            firstName,
            lastName,
            name,
            email,
            phone,
            role,
            status,
            ficha,
            picture: "logo_sena.png",
            createdAt,
            createdBy: session.user.email || session.user.id
        };
        if (password) {
            user.salt = crypto.randomBytes(16).toString("hex");
            user.passwordHash = crypto.scryptSync(password, user.salt, 64).toString("hex");
            managedUsers.push(user);
            accounts.push(user);
        }
        upsertCsvUser(user);
        if (role === "Aprendiz") syncApprenticeProfile(user);
        persistManagedUsers();
        persistCsvUsers();
        if (role === "Aprendiz") persistApprentices();

        return sendJson(response, 201, {
            ok: true,
            message: `${role} creado correctamente. El código de acceso se enviará a ${email} cuando lo solicite al iniciar sesión.`,
            user: systemUsers().find((item) => item.document === document && normalizeEmail(item.email) === email),
            ...userDirectoryPayload()
        });
    }

    function findDirectoryUser(id) {
        return systemUsers().find((user) => user.id === id) || null;
    }

    function applyUserUpdate(target, values, persist = true) {
        const previous = { ...target };
        const updated = { ...target, ...values };
        upsertCsvUser(updated, previous);

        const managed = managedUsers.find((user) =>
            user.id === target.id
            || (target.document && user.document === target.document)
            || (target.email && normalizeEmail(user.email) === normalizeEmail(target.email))
        );
        if (managed) {
            managed.documentType = updated.documentType;
            managed.name = updated.name;
            managed.email = updated.email;
            managed.phone = updated.phone;
            managed.status = updated.status;
            managed.ficha = updated.role === "Aprendiz" ? updated.ficha : "";
            managed.updatedAt = new Date().toISOString();
        }

        if (updated.role === "Aprendiz") {
            syncApprenticeProfile(updated);
        }
        if (persist) {
            persistCsvUsers();
            persistManagedUsers();
            if (updated.role === "Aprendiz") persistApprentices();
        }
        return updated;
    }

    async function handleUserUpdate(request, response, id) {
        const session = requireAdministrator(request, response);
        if (!session) return;
        const target = findDirectoryUser(id);
        if (!target) return sendJson(response, 404, { ok: false, message: "No se encontró el usuario solicitado." });
        if (userIsProtected(target)) return sendJson(response, 403, { ok: false, message: "La cuenta principal del sistema está protegida." });
        const body = await readJsonBody(request);
        const documentType = String(body.tipo_documento ?? body.documentType ?? target.documentType ?? "Cédula de Ciudadanía").trim();
        const name = String(body.nombre ?? body.name ?? target.name).trim();
        const email = normalizeEmail(body.correo ?? body.email ?? target.email);
        const phone = String(body.phone ?? target.phone ?? "").trim().slice(0, 30);
        const status = canonicalUserStatus(body.estado ?? body.status ?? target.status);
        const ficha = String(body.ficha ?? target.ficha ?? "").trim();
        const allowedDocumentTypes = new Set(["Cédula de Ciudadanía", "Tarjeta de Identidad", "Cédula de Extranjería", "Pasaporte", "Permiso de protección temporal"]);
        if (!allowedDocumentTypes.has(documentType) || !name || name.length > 160 || !email || !status || (target.role === "Aprendiz" && !/^\d+$/.test(ficha)) || (ficha && !/^\d+$/.test(ficha))) {
            return sendJson(response, 400, { ok: false, message: "Revisa el tipo de documento, el nombre, el correo, el estado y la ficha del usuario." });
        }
        if ((body.rol || body.role) && canonicalRole(body.rol ?? body.role) !== target.role) {
            return sendJson(response, 400, { ok: false, message: "El rol no se modifica desde esta acción para proteger sus relaciones." });
        }
        if (systemUsers().some((user) => user.id !== target.id && normalizeEmail(user.email) === email)) {
            return sendJson(response, 409, { ok: false, message: "Ya existe otro usuario con ese correo." });
        }
        const targetCsvIndex = csvIndexForTarget(target);
        if (csvUsers.some((user, index) => index !== targetCsvIndex && normalizeEmail(user.correo) === email)) {
            return sendJson(response, 409, { ok: false, message: "El correo ya pertenece a otro registro de usuarios_activos.csv." });
        }
        if (session.user.id === target.id && status === "Inactivo") {
            return sendJson(response, 400, { ok: false, message: "No puedes desactivar la cuenta con la que tienes la sesión abierta." });
        }
        const statusChanged = status !== target.status;
        const updated = applyUserUpdate(target, { documentType, name, email, phone, status, ficha });
        if (status === "Inactivo") invalidateUserSessions(updated);
        return sendJson(response, 200, {
            ok: true,
            message: statusChanged
                ? `${updated.name} fue ${status === "Activo" ? "activado" : "desactivado"} y sincronizado correctamente.`
                : `${updated.name} fue actualizado y sincronizado correctamente.`,
            user: systemUsers().find((user) => user.document === updated.document && normalizeEmail(user.email) === updated.email),
            ...userDirectoryPayload()
        });
    }

    async function handleUserDelete(request, response, id) {
        const session = requireAdministrator(request, response);
        if (!session) return;
        const target = findDirectoryUser(id);
        if (!target) return sendJson(response, 404, { ok: false, message: "No se encontró el usuario solicitado." });
        if (userIsProtected(target)) return sendJson(response, 403, { ok: false, message: "La cuenta principal del sistema está protegida." });
        if (session.user.id === target.id) return sendJson(response, 400, { ok: false, message: "No puedes eliminar la cuenta con la que tienes la sesión abierta." });

        const csvIndex = csvIndexForTarget(target);
        if (csvIndex >= 0) csvUsers.splice(csvIndex, 1);
        const managedIndex = managedUsers.findIndex((user) => user.id === target.id || user.document === target.document || normalizeEmail(user.email) === normalizeEmail(target.email));
        if (managedIndex >= 0) {
            const [removed] = managedUsers.splice(managedIndex, 1);
            const accountIndex = accounts.findIndex((account) => account.id === removed.id);
            if (accountIndex >= 0) accounts.splice(accountIndex, 1);
        }
        const apprenticeIndex = apprentices.findIndex((user) => user.id === target.id || user.document === target.document || normalizeEmail(user.email) === normalizeEmail(target.email));
        if (apprenticeIndex >= 0) apprentices.splice(apprenticeIndex, 1);
        invalidateUserSessions(target);
        persistCsvUsers();
        persistManagedUsers();
        persistApprentices();
        return sendJson(response, 200, {
            ok: true,
            message: `${target.name} fue eliminado del sistema y de usuarios_activos.csv.`,
            ...userDirectoryPayload()
        });
    }

    function normalizeImportedUser(row, rowNumber) {
        const document = csvValue(row, "identificacion", "documento", "numero_documento").replace(/\D/g, "");
        const name = csvValue(row, "nombre", "nombre_completo") || `${csvValue(row, "nombres")} ${csvValue(row, "apellidos")}`.trim();
        const email = normalizeEmail(csvValue(row, "correo", "email", "correo_electronico"));
        const role = canonicalRole(csvValue(row, "rol", "role"));
        const status = canonicalUserStatus(csvValue(row, "estado", "status") || "Activo");
        const ficha = csvValue(row, "ficha", "numero_ficha").replace(/\D/g, "");
        const username = csvValue(row, "usuario", "username").toLowerCase();
        const password = csvValue(row, "contrasena", "password");
        const phone = csvValue(row, "telefono", "phone").slice(0, 30);
        const documentType = csvValue(row, "tipo_documento", "document_type");
        const allowedRoles = new Set(["Administrador", "Instructor", "Aprendiz", "Coordinador"]);
        const allowedDocumentTypes = new Set(["Cédula de Ciudadanía", "Tarjeta de Identidad", "Cédula de Extranjería", "Pasaporte", "Permiso de protección temporal"]);
        if (!/^\d{6,15}$/.test(document) || !allowedDocumentTypes.has(documentType) || !name || name.length > 160 || !email || !allowedRoles.has(role) || !status) {
            throw new Error(`Fila ${rowNumber}: identificación, tipo de documento, nombre, correo, rol o estado no es válido.`);
        }
        if (role === "Aprendiz" && !/^\d+$/.test(ficha)) throw new Error(`Fila ${rowNumber}: el aprendiz necesita una ficha válida.`);
        if (ficha && !/^\d+$/.test(ficha)) throw new Error(`Fila ${rowNumber}: la ficha debe contener únicamente números.`);
        if (username && !/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error(`Fila ${rowNumber}: el nombre de usuario no es válido.`);
        if (password && password.length < 8) throw new Error(`Fila ${rowNumber}: la contraseña debe tener al menos 8 caracteres.`);
        return { rowNumber, document, name, email, role, status, ficha, username, password, phone, documentType };
    }

    async function handleUserImport(request, response) {
        const session = requireAdministrator(request, response);
        if (!session) return;
        const body = await readJsonBody(request, 512 * 1024);
        const fileName = String(body.fileName || "").trim();
        const csvText = String(body.csv || "");
        if (!/\.csv$/i.test(fileName) || !csvText.trim() || Buffer.byteLength(csvText, "utf8") > 450 * 1024) {
            return sendJson(response, 400, { ok: false, message: "Selecciona un archivo .csv válido de máximo 450 KB." });
        }
        const rows = parseDelimitedCsv(csvText);
        if (!rows.length || rows.length > 1000) return sendJson(response, 400, { ok: false, message: "El CSV debe contener entre 1 y 1000 usuarios." });
        const headers = new Set(Object.keys(rows[0] || {}));
        const requiredHeaders = ["identificacion", "tipo_documento", "nombre", "correo", "rol", "estado", "ficha"];
        if (requiredHeaders.some((header) => !headers.has(header))) {
            return sendJson(response, 400, { ok: false, message: `El archivo debe contener exactamente estas columnas base: ${requiredHeaders.join(", ")}.` });
        }

        const errors = [];
        const records = [];
        const seenDocuments = new Set();
        const seenEmails = new Set();
        const seenUsernames = new Set();
        const directory = systemUsers();
        rows.forEach((row, index) => {
            try {
                const record = normalizeImportedUser(row, index + 2);
                if (seenDocuments.has(record.document)) throw new Error(`Fila ${record.rowNumber}: documento repetido dentro del archivo.`);
                if (seenEmails.has(record.email)) throw new Error(`Fila ${record.rowNumber}: correo repetido dentro del archivo.`);
                if (record.username && seenUsernames.has(record.username)) throw new Error(`Fila ${record.rowNumber}: usuario repetido dentro del archivo.`);
                seenDocuments.add(record.document);
                seenEmails.add(record.email);
                if (record.username) seenUsernames.add(record.username);
                const byDocument = directory.find((user) => user.document === record.document);
                const byEmail = directory.find((user) => normalizeEmail(user.email) === record.email);
                if (byDocument && byEmail && byDocument.id !== byEmail.id) throw new Error(`Fila ${record.rowNumber}: el documento y el correo pertenecen a usuarios diferentes.`);
                const target = byDocument || byEmail || null;
                const registryByDocument = csvUsers.filter((user) => String(user.identificacion || "").trim() === record.document);
                const registryByEmail = csvUsers.filter((user) => normalizeEmail(user.correo) === record.email);
                if (registryByDocument.some((user) => normalizeEmail(user.correo) !== record.email)) {
                    throw new Error(`Fila ${record.rowNumber}: el documento ya está asociado a otro correo en usuarios_activos.csv.`);
                }
                if (registryByEmail.some((user) => String(user.identificacion || "").trim() !== record.document)) {
                    throw new Error(`Fila ${record.rowNumber}: el correo ya está asociado a otro documento en usuarios_activos.csv.`);
                }
                if (target && (target.document !== record.document || normalizeEmail(target.email) !== record.email)) {
                    throw new Error(`Fila ${record.rowNumber}: el documento o correo ya está registrado con otros datos.`);
                }
                if (target && target.role !== record.role) throw new Error(`Fila ${record.rowNumber}: el rol no coincide con el usuario registrado.`);
                if (target && userIsProtected(target)) throw new Error(`Fila ${record.rowNumber}: la cuenta principal del sistema está protegida.`);
                const existingAccount = accounts.find((account) => account.id === target?.id || account.username === record.username || normalizeEmail(account.email) === record.email);
                if (record.username && accounts.some((account) => account !== existingAccount && account.username === record.username)) {
                    throw new Error(`Fila ${record.rowNumber}: el nombre de usuario ya existe.`);
                }
                records.push({ ...record, target, existingAccount });
            } catch (error) {
                errors.push(error.message);
            }
        });
        if (errors.length) return sendJson(response, 400, { ok: false, message: `No se importó el archivo. Corrige ${errors.length} error${errors.length === 1 ? "" : "es"}.`, errors: errors.slice(0, 12) });

        let created = 0;
        let updated = 0;
        records.forEach((record) => {
            let user;
            if (record.target) {
                user = applyUserUpdate(record.target, {
                    documentType: record.documentType,
                    name: record.name,
                    email: record.email,
                    phone: record.phone || record.target.phone || "",
                    status: record.status,
                    ficha: record.ficha
                }, false);
                if (record.existingAccount && record.password) {
                    record.existingAccount.username = record.username || record.existingAccount.username;
                    record.existingAccount.salt = crypto.randomBytes(16).toString("hex");
                    record.existingAccount.passwordHash = crypto.scryptSync(record.password, record.existingAccount.salt, 64).toString("hex");
                } else if (!record.existingAccount && record.password) {
                    user.id = `usuario-${crypto.randomUUID()}`;
                    user.username = record.username;
                    user.documentType = record.documentType;
                    user.salt = crypto.randomBytes(16).toString("hex");
                    user.passwordHash = crypto.scryptSync(record.password, user.salt, 64).toString("hex");
                    managedUsers.push(user);
                    accounts.push(user);
                }
                updated += 1;
            } else {
                const id = record.role === "Aprendiz" && !record.password ? `aprendiz-${record.document}` : `usuario-${crypto.randomUUID()}`;
                user = {
                    id,
                    username: record.username,
                    document: record.document,
                    documentType: record.documentType,
                    name: record.name,
                    email: record.email,
                    phone: record.phone,
                    role: record.role,
                    status: record.status,
                    ficha: record.ficha,
                    createdAt: new Date().toISOString(),
                    createdBy: session.user.email || session.user.id
                };
                upsertCsvUser(user);
                if (record.password) {
                    user.salt = crypto.randomBytes(16).toString("hex");
                    user.passwordHash = crypto.scryptSync(record.password, user.salt, 64).toString("hex");
                    managedUsers.push(user);
                    accounts.push(user);
                }
                if (record.role === "Aprendiz") syncApprenticeProfile(user);
                created += 1;
            }
            if (record.status === "Inactivo") invalidateUserSessions(user);
        });
        persistCsvUsers();
        persistManagedUsers();
        persistApprentices();
        return sendJson(response, 201, {
            ok: true,
            message: `${records.length} usuario${records.length === 1 ? "" : "s"} procesado${records.length === 1 ? "" : "s"}: ${created} nuevo${created === 1 ? "" : "s"} y ${updated} actualizado${updated === 1 ? "" : "s"}.`,
            importResult: { total: records.length, created, updated, fileName },
            ...userDirectoryPayload()
        });
    }

    function nextSessions() {
        const days = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
        const now = new Date();
        const fichasById = new Map(sqlData.fichas.map((item) => [item.id, item]));
        const environmentsById = new Map(sqlData.ambientes.map((item) => [item.id, item]));
        const programsById = new Map(sqlData.programas.map((item) => [item.id, item]));
        return sqlData.horarios.map((schedule) => {
            const dayName = normalizeSqlText(schedule.dia);
            const normalizedDay = dayName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const targetDay = days[normalizedDay];
            if (targetDay === undefined) return null;
            const startHour = Number(String(schedule.horaInicio || "00:00").slice(0, 2));
            const startMinute = Number(String(schedule.horaInicio || "00:00").slice(3, 5));
            const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute);
            let difference = (targetDay - date.getDay() + 7) % 7;
            if (difference === 0 && date <= now) difference = 7;
            date.setDate(date.getDate() + difference);
            const ficha = fichasById.get(schedule.fichaId);
            const environment = environmentsById.get(schedule.ambienteId);
            const program = programsById.get(ficha?.programaId);
            return {
                ficha: String(ficha?.numero || ""),
                programa: String(program?.nombre || "Programa de formación"),
                dia: dayName,
                fecha: dateKey(date),
                horaInicio: String(schedule.horaInicio || "").slice(0, 5),
                horaFin: String(schedule.horaFin || "").slice(0, 5),
                jornada: startHour < 12 ? "Mañana" : startHour < 18 ? "Tarde" : "Noche",
                ambiente: environment ? `Amb. ${environment.codigo}` : "Sin ambiente",
                timestamp: date.getTime()
            };
        }).filter(Boolean).sort((left, right) => left.timestamp - right.timestamp).slice(0, 3).map(({ timestamp, ...session }) => session);
    }

    function handleStatistics(request, response, requestUrl) {
        const session = requireAdministrator(request, response);
        if (!session) return;
        const range = resolveDashboardRange(requestUrl, attendanceRecords);
        const trendDays = [7, 15, 30].includes(Number(requestUrl.searchParams.get("trendDays")))
            ? Number(requestUrl.searchParams.get("trendDays"))
            : 7;
        const inRange = (item, from = range.fromText, to = range.toText) => item.fecha >= from && item.fecha <= to;
        const selectedRecords = attendanceRecords.filter((item) => inRange(item));
        const daysInRange = Math.round((range.to - range.from) / 86400000) + 1;
        const previousTo = addDays(range.from, -1);
        const previousFrom = addDays(previousTo, -(daysInRange - 1));
        const previousRecords = attendanceRecords.filter((item) => inRange(item, dateKey(previousFrom), dateKey(previousTo)));
        const currentRate = rateFor(selectedRecords);
        const previousRate = rateFor(previousRecords);
        const attendanceDelta = selectedRecords.length && previousRecords.length
            ? Math.round((currentRate - previousRate) * 10) / 10
            : null;
        const activeInstructors = csvUsers.filter((user) => String(user.rol || "").toLowerCase() === "instructor" && String(user.estado || "").toLowerCase() === "activo").length;
        const fichas = attendanceFichas();
        const availableEnvironments = sqlData.ambientes.filter((item) => String(item.estado || "").toLowerCase() === "disponible").length;
        const occupiedEnvironments = sqlData.ambientes.filter((item) => String(item.estado || "").toLowerCase() === "ocupado").length;

        const composition = fichas.map((ficha) => {
            const records = selectedRecords.filter((item) => item.ficha === ficha.codigo);
            return { ficha: ficha.codigo, programa: ficha.programa, ...statusSummary(records) };
        }).filter((item) => item.total > 0).sort((left, right) => right.attendance - left.attendance);

        const trendStart = addDays(range.to, -(trendDays - 1));
        const trend = Array.from({ length: trendDays }, (_, index) => {
            const date = dateKey(addDays(trendStart, index));
            const records = attendanceRecords.filter((item) => item.fecha === date);
            return { date, percentage: records.length ? rateFor(records) : null, total: records.length };
        });

        const weekdayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        const journeys = ["Mañana", "Tarde", "Noche", "Mixta"];
        const weeklyPerformance = journeys.map((journey) => ({
            journey,
            days: weekdayNames.map((day, index) => {
                const records = selectedRecords.filter((item) => item.jornada === journey && localDate(item.fecha)?.getDay() === index + 1);
                return { day, percentage: records.length ? rateFor(records) : null, total: records.length };
            })
        }));

        const alerts = [];
        const committeeCases = academicCommitteeCases();
        if (committeeCases.length) alerts.push({
            type: "danger",
            icon: "fa-user-shield",
            title: "Casos para Comité Académico",
            description: `${committeeCases.length} ${committeeCases.length === 1 ? "aprendiz superó" : "aprendices superaron"} las 4 fallas sin justificar y requiere${committeeCases.length === 1 ? "" : "n"} revisión.`,
            time: currentAcademicPeriod().label
        });
        const lowFichas = composition.filter((item) => item.attendance < 70);
        if (lowFichas.length) alerts.push({ type: "warning", icon: "fa-chart-column", title: "Asistencia por debajo del 70%", description: `${lowFichas.length} ficha${lowFichas.length === 1 ? " presenta" : "s presentan"} bajo rendimiento.`, time: `Hasta ${range.toText}` });
        if (occupiedEnvironments) alerts.push({ type: "info", icon: "fa-building", title: "Ambientes ocupados", description: `${occupiedEnvironments} de ${sqlData.ambientes.length} ambientes figuran como ocupados.`, time: "Estado actual" });
        const pendingUsers = csvUsers.filter((user) => String(user.estado || "").toLowerCase() !== "activo").length;
        if (pendingUsers) alerts.push({ type: "danger", icon: "fa-user-clock", title: "Usuarios pendientes", description: `${pendingUsers} usuario${pendingUsers === 1 ? " está" : "s están"} pendiente${pendingUsers === 1 ? "" : "s"} de activar.`, time: "Estado actual" });

        return sendJson(response, 200, {
            ok: true,
            usuario: { name: session.user.name, role: session.user.role },
            filters: { from: range.fromText, to: range.toText, period: range.period, periods: range.periods, trendDays },
            summary: {
                apprentices: apprentices.filter(apprenticeIsEnabled).length,
                instructors: activeInstructors,
                fichas: fichas.length,
                environmentsAvailable: availableEnvironments,
                environmentsTotal: sqlData.ambientes.length,
                environmentOccupancy: sqlData.ambientes.length ? Math.round(occupiedEnvironments / sqlData.ambientes.length * 100) : 0,
                attendance: currentRate,
                attendanceRecords: selectedRecords.length,
                attendanceDelta
            },
            trend,
            composition,
            weeklyPerformance,
            topFichas: composition.slice(0, 5),
            alerts,
            nextSessions: nextSessions()
        });
    }

    function serveStatic(request, response, pathname) {
        if (!['GET', 'HEAD'].includes(request.method)) return sendJson(response, 405, { ok: false, message: "Método no permitido." });
        const requested = pathname === "/" ? "index.html" : pathname.slice(1);
        const extension = path.extname(requested).toLowerCase();
        const directory = publicDirectories[extension];
        const file = directory ? path.join(directory, requested) : "";
        if (!directory || path.basename(requested) !== requested || !mimeTypes[extension] || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            response.end("Recurso no encontrado");
            return;
        }
        response.writeHead(200, { "Content-Type": mimeTypes[extension], "Cache-Control": "no-store" });
        if (request.method === "HEAD") return response.end();
        fs.createReadStream(file).pipe(response);
    }

    const atenderApi = crearEnrutadorApi({
        acceso: {
            iniciarConContrasena: handlePasswordLogin,
            solicitarCodigo: handleRequestCode,
            verificarCodigo: handleVerifyCode,
            estadoCorreo: handleEmailStatus,
            historialCorreo: handleEmailHistory,
            consultarSesion: handleSession,
            consultarPerfil: handleAdminProfile,
            actualizarPerfil: handleAdminProfile,
            cambiarContrasena: handleAdminPasswordChange,
            cerrarSesion: handleLogout
        },
        usuarios: {
            consultarAprendiz: handleApprenticeProfile,
            actualizarAprendiz: handleApprenticeUpdate,
            listar: handleUsersData,
            crear: handleUserCreate,
            importar: handleUserImport,
            actualizar: handleUserUpdate,
            eliminar: handleUserDelete
        },
        formacion: {
            listarProgramas: handleProgramsData,
            crearPrograma: handleProgramCreate,
            actualizarPrograma: handleProgramUpdate,
            consultarAsistencia: handleAttendanceData,
            guardarAsistencia: handleAttendanceSave,
            consultarEstadisticas: handleStatistics
        },
        sistema: { consultarEstado: handleSystemHealth }
    });

    const server = http.createServer(async (request, response) => {
        cleanExpired();
        const requestUrl = new URL(request.url, "http://localhost");
        const pathname = decodeURIComponent(requestUrl.pathname);
        try {
            if (await atenderApi({ request, response, requestUrl, pathname })) return;
            if (pathname.startsWith("/api/")) return sendJson(response, 404, { ok: false, message: "Ruta de API no encontrada." });
            return serveStatic(request, response, pathname);
        } catch (error) {
            console.error("Error de API:", error.message);
            return sendJson(response, error.status || 500, { ok: false, message: error.message || "Error interno del servidor." });
        }
    });

    let emailHealthTimer = null;
    server.on("listening", () => {
        emailService.probe().catch(() => {});
        emailHealthTimer = setInterval(() => emailService.probe().catch(() => {}), 5 * 60 * 1000);
        emailHealthTimer.unref?.();
    });
    server.on("close", () => {
        if (emailHealthTimer) clearInterval(emailHealthTimer);
        emailHealthTimer = null;
    });

    return server;
}

if (require.main === module) {
    const port = Number(process.env.PORT || 3000);
    const server = createProjectServer();
    server.listen(port, () => {
        console.log(`Sistema SENA disponible en http://localhost:${port}/login.html`);
        const gmailReady = normalizeEmail(process.env.GMAIL_USER) && String(process.env.GMAIL_APP_PASSWORD || "").replace(/\s/g, "");
        const resendReady = process.env.RESEND_API_KEY;
        if (!gmailReady && !resendReady) console.log("Aviso: configura Gmail o Resend en .env para habilitar los códigos por correo.");
    });
}

module.exports = { createProjectServer, loadCsvUsers };
