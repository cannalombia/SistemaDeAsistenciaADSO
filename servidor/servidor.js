const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const QRCode = require("qrcode");
const os = require("os");
const rutasProyecto = require("./configuracion/rutas");
const { SCALE, fichaPlan, weeklyPlan } = require("./configuracion/escala_formacion");
const { crearEnrutadorApi } = require("./rutas");
const { normalizeEmail, boundedInteger, maskEmail, readCookies, safeEqual } = require("./modulos/utilidades");
const { readJsonFile, writeJsonFileAtomic, ensureOperationalFile, parseDelimitedCsv, serializeCsvUsers, loadCsvUsers, loadSqlTable, normalizeSqlText } = require("./modulos/persistencia");
const { createEmailService } = require("./modulos/correo");
const { normalizeProgramText: normalizedProgramText, canonicalProgramStatus, displayProgramLevel, validateProgramInput } = require("./dominio/programas");
const { canonicalRole, canonicalUserStatus, csvValue, registryRowFromUser } = require("./dominio/usuarios");
const { localDate, dateKey, addDays, rateFor, statusSummary, resolveDashboardRange } = require("./dominio/estadisticas");
const { buildReportSnapshot, reportStatus, reportMetadata, validateReportTransition, archiveReport, restoreReport, removeReport, pruneOldestArchivedReports } = require("./dominio/reportes");
const { createReportPdf } = require("./modulos/reporte_pdf");
const { readSqlFile, parseUsersSql, createDump } = require("./modulos/sqlfile");
const { createBackup, readBackupFile } = require("./modulos/respaldo");
const { writeFilesAtomically } = require("./modulos/transaccion_archivos");
const { validateDatabaseEnv } = require("./base_datos/configuracion");
const { createDatabasePool, checkDatabase } = require("./base_datos/conexion");
const { assertMigrationsCurrent } = require("./base_datos/migraciones");
const { createMysqlRepository } = require("./base_datos/repositorio");
const { readExcuseSubmission } = require("./modulos/excusas");
const { sendJson, readRequestJsonBody } = require("./modulos/http");

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
    const repository = options.repository || null;
    const publicUrl = String(options.publicUrl ?? process.env.PUBLIC_URL ?? "").trim();
    if (publicUrl) {
        let parsed;
        try { parsed = new URL(publicUrl); } catch (_) { /* Validated below. */ }
        if (!parsed || !["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
            throw new Error("PUBLIC_URL debe ser un origen HTTP(S), por ejemplo https://tu-dominio.localhost.run, sin rutas ni parámetros.");
        }
    }
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
    const attendanceTokens = new Map();
    const hourlyRequests = new Map();
    const pendingCodeRequests = new Set();
    const now = typeof options.now === "function" ? options.now : Date.now;
    const recoveryCodeTtlMs = 10 * 60 * 1000;
    const recoveryResendDelayMs = 60 * 1000;
    const recoveryAttemptLimit = 5;
    let adminRecovery = null;
    let adminRecoveryRequestPending = false;
    const persistentRuntime = !options.apprentices && !options.emailSender;
    const authStateFile = options.authStateFile === null
        ? null
        : (options.authStateFile || (persistentRuntime ? path.join(dataDirectory, "estado_autenticacion_correo.json") : null));
    const emailHistoryFile = options.emailHistoryFile === null
        ? null
        : (options.emailHistoryFile || (persistentRuntime ? path.join(dataDirectory, "historial_envios_correo.json") : null));
    const storedAuthState = readJsonFile(authStateFile, {});
    const nowAtStartup = now();
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
    const storedAdminRecovery = storedAuthState.adminRecovery;
    if (storedAdminRecovery
        && normalizeEmail(storedAdminRecovery.email)
        && /^[a-f0-9]{64}$/i.test(String(storedAdminRecovery.hash || ""))
        && Number(storedAdminRecovery.expiresAt) > nowAtStartup) {
        adminRecovery = {
            hash: String(storedAdminRecovery.hash),
            email: normalizeEmail(storedAdminRecovery.email),
            expiresAt: Number(storedAdminRecovery.expiresAt),
            nextSendAt: Number(storedAdminRecovery.nextSendAt) || nowAtStartup,
            attempts: boundedInteger(storedAdminRecovery.attempts, 0, 0, recoveryAttemptLimit)
        };
    }
    let emailHistory = readJsonFile(emailHistoryFile, []);
    if (!Array.isArray(emailHistory)) emailHistory = [];
    emailHistory = emailHistory.slice(-config.emailHistoryLimit);
    const serverStartedAt = new Date().toISOString();
    const emailService = createEmailService(config, { appendHistory: appendEmailHistory });
    const selectedEmailProvider = emailService.provider;
    const resendTestMode = emailService.testMode;
    const adminCredentialsFile = options.adminCredentialsFile || path.join(dataDirectory, "credenciales_administrador.json");
    const credentialsFromEnvironment = (prefix) => {
        const salt = String(process.env[`${prefix}_AUTH_SALT`] || "").trim();
        const passwordHash = String(process.env[`${prefix}_AUTH_PASSWORD_HASH`] || "").trim().toLowerCase();
        if (!salt && !passwordHash) return null;
        if (salt.length < 8 || !/^[a-f0-9]{128}$/.test(passwordHash)) {
            throw new Error(`Las variables ${prefix}_AUTH_SALT y ${prefix}_AUTH_PASSWORD_HASH no son válidas.`);
        }
        return { salt, passwordHash };
    };
    let adminCredentials = null;
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
    } else {
        const environmentCredentials = credentialsFromEnvironment("ADMIN");
        if (!environmentCredentials) {
            throw new Error("Faltan credenciales administrativas. Ejecuta npm.cmd run reset:admin o configura ADMIN_AUTH_SALT y ADMIN_AUTH_PASSWORD_HASH.");
        }
        adminCredentials = {
            ...environmentCredentials,
            name: String(process.env.ADMIN_AUTH_NAME || "Administrador SENA").trim(),
            email: normalizeEmail(process.env.ADMIN_AUTH_EMAIL || "admin@sena.edu.co")
        };
    }
    let instructorCredentials = credentialsFromEnvironment("INSTRUCTOR");
    if (typeof options.instructorPassword === "string") {
        const salt = "sena-instructor-test";
        instructorCredentials = {
            salt,
            passwordHash: crypto.scryptSync(options.instructorPassword, salt, 64).toString("hex")
        };
    }
    if (!instructorCredentials && (persistentRuntime || options.repository)) {
        throw new Error("Faltan credenciales del instructor. Configura INSTRUCTOR_AUTH_SALT e INSTRUCTOR_AUTH_PASSWORD_HASH.");
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
        }
    ];
    if (instructorCredentials) builtInAccounts.push({
            id: "instructor-sena",
            username: "instructor",
            email: normalizeEmail(process.env.INSTRUCTOR_AUTH_EMAIL || "instructor@sena.edu.co"),
            name: String(process.env.INSTRUCTOR_AUTH_NAME || "Instructor SENA").trim(),
            role: "Instructor",
            salt: instructorCredentials.salt,
            passwordHash: instructorCredentials.passwordHash
        });
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
    const usersCsvFile = options.usersCsvFile || rutasProyecto.usuariosCsv;
    const csvFileBacked = !options.csvUsers && (!options.apprentices || Boolean(options.usersCsvFile));
    if (persistentRuntime) ensureOperationalFile(
        usersCsvFile,
        fs.existsSync(path.join(dataDirectory, "importaciones", "usuarios_activos.csv"))
            ? path.join(dataDirectory, "importaciones", "usuarios_activos.csv")
            : path.join(dataDirectory, "ejemplos", "usuarios_activos.ejemplo.csv"),
        "identificacion;tipo_documento;nombre;correo;rol;estado;ficha\n"
    );
    let csvSource = csvFileBacked ? readUsersCsvSource() : null;
    let csvUsers = options.csvUsers
        ? JSON.parse(JSON.stringify(options.csvUsers))
        : (csvFileBacked ? validateUsersCsvSource(csvSource) : []);
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
    const trainingFile = options.trainingFile === null ? null : (options.trainingFile || (persistentRuntime ? path.join(dataDirectory, "formacion.json") : null));
    const storedTraining = readJsonFile(trainingFile, null);
    const trainingState = options.trainingState
        ? JSON.parse(JSON.stringify(options.trainingState))
        : (storedTraining && Array.isArray(storedTraining.fichas) && Array.isArray(storedTraining.horarios) && Array.isArray(storedTraining.ambientes)
            ? storedTraining
            : { fichas: sqlData.fichas || [], horarios: sqlData.horarios || [], ambientes: sqlData.ambientes || [] });
    sqlData.fichas = trainingState.fichas;
    sqlData.horarios = trainingState.horarios;
    sqlData.ambientes = trainingState.ambientes;
    if (!Array.isArray(trainingState.attendanceClosures)) trainingState.attendanceClosures = [];
    if (trainingFile && !storedTraining) writeJsonFileAtomic(trainingFile, trainingState);
    const auditFile = options.auditFile === null ? null : (options.auditFile || (persistentRuntime ? path.join(dataDirectory, "auditoria.json") : null));
    const auditRecords = options.auditRecords || readJsonFile(auditFile, []);
    const excusesFile = options.excusesFile === null ? null : (options.excusesFile || (persistentRuntime ? path.join(dataDirectory, "excusas.json") : null));
    if (persistentRuntime) ensureOperationalFile(excusesFile, path.join(dataDirectory, "ejemplos", "excusas.ejemplo.json"), "[]\n");
    const excuses = options.excuses ? JSON.parse(JSON.stringify(options.excuses)) : readJsonFile(excusesFile, []);
    const programsFile = path.join(dataDirectory, "programas.json");
    const programRecords = options.programs
        ? JSON.parse(JSON.stringify(options.programs))
        : (!options.sqlData && fs.existsSync(programsFile)
            ? JSON.parse(fs.readFileSync(programsFile, "utf8"))
            : JSON.parse(JSON.stringify(sqlData.programas || [])));
    sqlData.programas = programRecords;
    refreshUsersFromCsv(true);

    function readUsersCsvSource() {
        try {
            return fs.readFileSync(usersCsvFile, "utf8");
        } catch (_) {
            throw Object.assign(new Error(`No se pudo leer la base principal ${path.basename(usersCsvFile)}. Comprueba que existe y está disponible.`), { status: 503 });
        }
    }

    function validateUsersCsvSource(source) {
        const required = ["identificacion", "tipo_documento", "nombre", "correo", "rol", "estado", "ficha"];
        const header = source.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0];
        const columns = header.split(header.includes(";") ? ";" : ",").map(value => value.trim().replace(/^"|"$/g, "").toLowerCase());
        const fail = message => { throw Object.assign(new Error(`Base principal ${path.basename(usersCsvFile)}: ${message}`), { status: 503 }); };
        if (required.some(key => !columns.includes(key)) || columns.length !== required.length) fail(`conserva las columnas ${required.join("; ")}.`);
        const rows = parseDelimitedCsv(source);
        const documents = new Set();
        const emails = new Set();
        return rows.map((row, index) => {
            let user;
            try { user = normalizeImportedUser(row, index + 2); } catch (error) { fail(error.message); }
            if (documents.has(user.document) || emails.has(user.email)) fail(`documento o correo repetido en la fila ${index + 2}.`);
            documents.add(user.document);
            emails.add(user.email);
            return registryRowFromUser(user);
        });
    }

    function refreshUsersFromCsv(force = false) {
        if (!csvFileBacked) return;
        const source = readUsersCsvSource();
        if (!force && source === csvSource) return;
        const rows = validateUsersCsvSource(source);
        // Validate the entire file before replacing any in-memory data.
        for (const previous of csvUsers) {
            const next = rows.find(row => row.identificacion === previous.identificacion);
            if (!next || JSON.stringify(next) !== JSON.stringify(previous)) {
                invalidateUserSessions({ document: previous.identificacion, email: previous.correo });
                codes.delete(previous.identificacion);
            }
        }
        csvUsers = rows;
        csvSource = source;
        for (const row of csvUsers) {
            const user = { document: row.identificacion, documentType: row.tipo_documento, name: row.nombre, email: row.correo,
                role: canonicalRole(row.rol), status: canonicalUserStatus(row.estado), ficha: row.ficha };
            if (user.role === "Aprendiz") syncApprenticeProfile(user);
            const account = managedUsers.find(item => item.document === user.document);
            if (account) Object.assign(account, user);
        }
    }

    async function readJsonBody(request, maxBytes) {
        const sessionBeforeUpload = currentSession(request);
        const body = await readRequestJsonBody(request, maxBytes);
        // A CSV may have been saved while the request body was being uploaded.
        refreshUsersFromCsv();
        if (sessionBeforeUpload && !currentSession(request)) {
            throw Object.assign(new Error("Tu usuario cambió en la base principal. Inicia sesión nuevamente."), { status: 403 });
        }
        return body;
    }

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
        if (!csvFileBacked) return;
        if (readUsersCsvSource() !== csvSource) {
            refreshUsersFromCsv();
            throw Object.assign(new Error("La base principal cambió durante la operación. Revisa los datos y vuelve a guardar."), { status: 409 });
        }
        const temporary = `${usersCsvFile}.tmp`;
        const source = serializeCsvUsers(csvUsers);
        try {
            fs.writeFileSync(temporary, source, "utf8");
            fs.renameSync(temporary, usersCsvFile);
            csvSource = source;
        } catch (_) {
            refreshUsersFromCsv(true);
            throw Object.assign(new Error(`No se pudo guardar ${path.basename(usersCsvFile)}. Cierra el archivo en Excel y vuelve a intentarlo.`), { status: 503 });
        }
    }

    function persistPrograms() {
        if (options.programs || options.sqlData) return;
        const temporary = `${programsFile}.tmp`;
        fs.writeFileSync(temporary, `${JSON.stringify(programRecords, null, 2)}\n`, "utf8");
        fs.renameSync(temporary, programsFile);
    }

    function persistTraining() {
        if (options.trainingState || (options.sqlData && !options.trainingFile) || !trainingFile) return;
        writeJsonFileAtomic(trainingFile, trainingState);
    }

    function persistExcuses() {
        if (options.excuses || !excusesFile) return;
        writeJsonFileAtomic(excusesFile, excuses);
    }

    function createAuditEntry(session, action, entity, entityId, before, after, details = {}) {
        return {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            actor: {
                id: session?.user?.id || "system",
                name: session?.user?.name || "Sistema",
                email: session?.user?.email || "",
                role: session?.user?.role || "Sistema"
            },
            action, entity, entityId: String(entityId || ""),
            before: before == null ? null : JSON.parse(JSON.stringify(before)),
            after: after == null ? null : JSON.parse(JSON.stringify(after)),
            details
        };
    }

    function appendAuditEntry(entry) {
        auditRecords.push(entry);
        if (auditRecords.length > 5000) auditRecords.splice(0, auditRecords.length - 5000);
    }

    function audit(session, action, entity, entityId, before, after, details = {}) {
        const entry = createAuditEntry(session, action, entity, entityId, before, after, details);
        appendAuditEntry(entry);
        writeJsonFileAtomic(auditFile, auditRecords);
        return entry;
    }

    function persistAuthState() {
        writeJsonFileAtomic(authStateFile, {
            version: 1,
            savedAt: new Date().toISOString(),
            codes: [...codes.entries()].map(([document, item]) => ({ document, ...item })),
            hourlyRequests: [...hourlyRequests.entries()].map(([key, item]) => ({ key, ...item })),
            adminRecovery
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

    function hashRecoveryCode(email, code) {
        return crypto.createHmac("sha256", config.otpSecret).update(`admin-recovery:${email}:${code}`).digest("hex");
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
        const currentTime = now();
        for (const [token, item] of attendanceTokens) if (item.expiresAt <= currentTime) attendanceTokens.delete(token);
        let authStateChanged = false;
        for (const [document, item] of codes) {
            if (item.expiresAt <= currentTime) {
                codes.delete(document);
                authStateChanged = true;
            }
        }
        if (adminRecovery && adminRecovery.expiresAt <= currentTime) {
            adminRecovery = null;
            authStateChanged = true;
        }
        for (const [token, item] of sessions) if (item.expiresAt <= currentTime) sessions.delete(token);
        for (const [key, item] of hourlyRequests) {
            if (item.windowEndsAt <= currentTime) {
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
        if (csvFileBacked && !userIsProtected(account) && !csvUsers.some(row => row.identificacion === account.document)) {
            return sendJson(response, 403, { ok: false, message: "La cuenta ya no está en la base principal." });
        }
        if ((canonicalUserStatus(account.status) || "Activo") !== "Activo") {
            return sendJson(response, 403, { ok: false, message: "Esta cuenta se encuentra desactivada." });
        }
        return createSession(response, {
            id: account.id,
            document: account.document || "",
            username: account.username,
            name: account.name,
            email: account.email,
            role: account.role,
            picture: "logo_sena.png",
            method: "password"
        });
    }

    const recoveryRequestMessage = "Si los datos corresponden a la cuenta administrativa, recibirás un código para continuar.";

    function isAdminRecoveryIdentifier(identifier, account) {
        const normalized = String(identifier || "").trim().toLowerCase();
        const email = normalizeEmail(normalized);
        return normalized === account.username || Boolean(email && email === normalizeEmail(account.email));
    }

    async function handleAdminRecoveryRequest(request, response) {
        const body = await readJsonBody(request);
        const account = builtInAccounts[0];
        if (!isAdminRecoveryIdentifier(body.identifier, account)) {
            return sendJson(response, 200, { ok: true, message: recoveryRequestMessage });
        }

        const email = normalizeEmail(account.email);
        const currentTime = now();
        if (adminRecovery && adminRecovery.email === email && adminRecovery.nextSendAt > currentTime) {
            const seconds = Math.ceil((adminRecovery.nextSendAt - currentTime) / 1000);
            return sendJson(response, 429, { ok: false, message: `Espera ${seconds} segundos antes de solicitar otro código.` });
        }

        const clientKey = crypto.createHash("sha256")
            .update(`admin-recovery:${request.socket.remoteAddress || "local"}:${account.id}`)
            .digest("hex");
        const rate = hourlyRequests.get(clientKey);
        if (rate && rate.windowEndsAt > currentTime && rate.count >= 5) {
            return sendJson(response, 429, { ok: false, message: "Alcanzaste el límite de solicitudes de recuperación por hora." });
        }
        if (adminRecoveryRequestPending) {
            return sendJson(response, 429, { ok: false, message: "Ya hay una recuperación en proceso de envío. Espera un momento." });
        }

        const code = crypto.randomInt(0, 1000000).toString().padStart(6, "0");
        const requestId = crypto.randomUUID();
        adminRecoveryRequestPending = true;
        try {
            await emailService.enqueuePasswordRecoveryCode(account, code, requestId);
            adminRecovery = {
                hash: hashRecoveryCode(email, code),
                email,
                expiresAt: currentTime + recoveryCodeTtlMs,
                nextSendAt: currentTime + recoveryResendDelayMs,
                attempts: 0
            };
            hourlyRequests.set(clientKey, {
                count: rate && rate.windowEndsAt > currentTime ? rate.count + 1 : 1,
                windowEndsAt: rate && rate.windowEndsAt > currentTime ? rate.windowEndsAt : currentTime + 60 * 60 * 1000
            });
            persistAuthState();
            audit(null, "request", "admin_password_recovery", account.id, null, null, {
                requestId,
                recipient: maskEmail(email)
            });

            const result = { ok: true, message: recoveryRequestMessage };
            if (config.exposeTestCode) result.testCode = code;
            return sendJson(response, 200, result);
        } finally {
            adminRecoveryRequestPending = false;
        }
    }

    async function handleAdminRecoveryReset(request, response) {
        const body = await readJsonBody(request);
        const account = builtInAccounts[0];
        const identifierAllowed = isAdminRecoveryIdentifier(body.identifier, account);
        const code = String(body.code || "").trim();
        const newPassword = String(body.newPassword || "");
        const genericCodeError = "El código no es válido o ya venció. Solicita uno nuevo.";

        if (!identifierAllowed || !/^\d{6}$/.test(code)) {
            return sendJson(response, 401, { ok: false, message: genericCodeError });
        }
        if (newPassword.length < 10) {
            return sendJson(response, 400, { ok: false, message: "La nueva contraseña debe tener al menos 10 caracteres." });
        }
        if (!adminRecovery || adminRecovery.email !== normalizeEmail(account.email) || adminRecovery.expiresAt <= now()) {
            adminRecovery = null;
            persistAuthState();
            audit(null, "reject", "admin_password_recovery", account.id, null, null, { reason: "expired_or_missing" });
            return sendJson(response, 401, { ok: false, message: genericCodeError });
        }
        if (!safeEqual(adminRecovery.hash, hashRecoveryCode(adminRecovery.email, code))) {
            adminRecovery.attempts += 1;
            const limitReached = adminRecovery.attempts >= recoveryAttemptLimit;
            if (limitReached) adminRecovery = null;
            persistAuthState();
            audit(null, "reject", "admin_password_recovery", account.id, null, null, {
                reason: limitReached ? "attempt_limit" : "invalid_code",
                attempts: limitReached ? recoveryAttemptLimit : adminRecovery.attempts
            });
            return sendJson(response, limitReached ? 429 : 401, {
                ok: false,
                message: limitReached ? "Demasiados intentos. Solicita un código nuevo." : "El código no es correcto."
            });
        }
        if (verifyPassword(account, newPassword)) {
            return sendJson(response, 400, { ok: false, message: "La contraseña nueva debe ser diferente de la actual." });
        }

        const recipient = maskEmail(adminRecovery.email);
        adminRecovery = null;
        persistAuthState();
        account.salt = crypto.randomBytes(16).toString("hex");
        account.passwordHash = crypto.scryptSync(newPassword, account.salt, 64).toString("hex");
        adminCredentials.salt = account.salt;
        adminCredentials.passwordHash = account.passwordHash;
        saveAdminAccount();

        let sessionsInvalidated = 0;
        for (const [token, storedSession] of sessions) {
            if (storedSession.user?.id === account.id) {
                sessions.delete(token);
                sessionsInvalidated += 1;
            }
        }
        audit(null, "reset_password", "admin_password_recovery", account.id, null, null, {
            method: "email_otp",
            recipient,
            sessionsInvalidated
        });
        return sendJson(response, 200, { ok: true, message: "Contraseña administrativa actualizada. Ya puedes iniciar sesión." });
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

    function notificationPayload() {
        const notifications = [];
        const committee = academicCommitteeCases();
        if (committee.length) notifications.push({ id: "academic", type: "danger", icon: "fa-user-shield", title: "Casos para Comité Académico", message: `${committee.length} aprendiz${committee.length === 1 ? "" : "es"} supera${committee.length === 1 ? "" : "n"} las cuatro fallas sin justificar.`, href: "estadisticas.html" });
        const inactive = csvUsers.filter(item => canonicalUserStatus(item.estado) === "Inactivo").length;
        if (inactive) notifications.push({ id: "inactive-users", type: "warning", icon: "fa-user-clock", title: "Usuarios inactivos", message: `${inactive} usuario${inactive === 1 ? " está" : "s están"} pendiente${inactive === 1 ? "" : "s"} de revisión.`, href: "crear_usuario.html" });
        const failures = emailHistory.slice(-20).filter(item => item.status === "failed").length;
        if (failures) notifications.push({ id: "email", type: "danger", icon: "fa-envelope-circle-xmark", title: "Fallos recientes de correo", message: `${failures} envío${failures === 1 ? " falló" : "s fallaron"} entre los últimos 20 intentos.`, href: "ajustes.html" });
        const withoutInstructor = sqlData.fichas.filter(item => String(item.estado).toLowerCase() !== "inactiva" && (item.instructorId === null || item.instructorId === undefined || String(item.instructorId).trim() === "")).length;
        if (withoutInstructor) notifications.push({ id: "fichas", type: "warning", icon: "fa-folder-open", title: "Fichas sin instructor", message: `${withoutInstructor} ficha${withoutInstructor === 1 ? " activa no tiene" : "s activas no tienen"} instructor asignado.`, href: "fichas.html" });
        const weekday = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][new Date().getDay()];
        const today = dateKey(new Date());
        const pending = sqlData.horarios.filter(schedule => String(schedule.estado || "Activo") === "Activo" && normalizeSqlText(schedule.dia) === weekday).filter(schedule => {
            const ficha = sqlData.fichas.find(item => String(item.id) === String(schedule.fichaId));
            return ficha && !attendanceRecords.some(item => item.fecha === today && item.ficha === String(ficha.numero) && item.jornada === normalizeSqlText(ficha.jornada));
        }).length;
        if (pending) notifications.push({ id: "attendance", type: "info", icon: "fa-calendar-check", title: "Jornadas pendientes", message: `${pending} horario${pending === 1 ? " de hoy todavía no tiene" : "s de hoy todavía no tienen"} asistencia guardada.`, href: "asistencia.html" });
        return { notifications, count: notifications.length, generatedAt: new Date().toISOString() };
    }

    function handleNotifications(request, response) {
        if (!requireStaff(request, response)) return;
        return sendJson(response, 200, { ok: true, ...notificationPayload() });
    }

    function handleAudit(request, response, requestUrl) {
        if (!requireAdministrator(request, response)) return;
        const limit = boundedInteger(requestUrl.searchParams.get("limit"), 100, 1, 500);
        const entity = cleanText(requestUrl.searchParams.get("entity"), 40);
        const selected = (entity ? auditRecords.filter(item => item.entity === entity) : auditRecords).slice(-limit).reverse();
        return sendJson(response, 200, { ok: true, total: auditRecords.length, entries: selected });
    }

    async function handleSystemHealth(_request, response) {
        const emailHealth = emailService.getHealth();
        let database = { source: repository ? "mysql" : "legacy", ready: true };
        if (repository) {
            try { database = { source: "mysql", ...(await checkDatabase(repository.pool)) }; }
            catch (error) { return sendJson(response, 503, { ok: false, service: "sistema-asistencia-sena", status: "unavailable", database: { source: "mysql", ready: false, error: error.message } }); }
        }
        return sendJson(response, 200, {
            ok: true,
            service: "sistema-asistencia-sena",
            status: "ready",
            startedAt: serverStartedAt,
            uptimeSeconds: Math.floor(process.uptime()),
            database,
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

    const attendanceClosureKey = (ficha, fecha, jornada) => `${fecha}:${jornada}:${ficha}`;
    function findAttendanceClosure(ficha, fecha, jornada) {
        const key = attendanceClosureKey(ficha, fecha, jornada);
        return trainingState.attendanceClosures.find((item) => item.key === key) || null;
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
            ultima_actualizacion: lastUpdated,
            cierre: findAttendanceClosure(ficha, fecha, jornada)
        });
    }

    async function handleAttendanceQr(request, response) {
        const session = requireStaff(request, response);
        if (!session) return;
        const body = await readJsonBody(request);
        const ficha = String(body.ficha || "");
        const jornada = String(body.jornada || "");
        if (!attendanceFichas().some((item) => item.codigo === ficha) || !["Mañana", "Tarde", "Noche"].includes(jornada)) {
            return sendJson(response, 400, { ok: false, message: "Selecciona una ficha y una jornada válidas." });
        }
        const token = crypto.randomBytes(32).toString("hex");
        const now = Date.now();
        const expiresAt = now + 60000;
        const base_url = publicUrl ||
                        `${config.secureCookie ? "https" : "http"}://${request.headers.host}`;

        const url = new URL("/asistencia_qr.html", base_url);
        url.searchParams.set("token", token);
        const image = await QRCode.toDataURL(url.href, { width: 320, margin: 4, errorCorrectionLevel: "M" });
        // One active QR per staff session; rotation revokes the previous image.
        for (const [key, item] of attendanceTokens) if (item.owner === session.token) attendanceTokens.delete(key);
        attendanceTokens.set(token, { ficha, jornada, fecha: dateKey(new Date(now)), expiresAt, owner: session.token });
        return sendJson(response, 201, { ok: true, image, url: url.href, expiresAt, remainingMs: Math.max(0, expiresAt - Date.now()) });
    }

    async function handleAttendanceQrRegister(request, response) {
        const body = await readJsonBody(request);
        const session = requireApprentice(request, response);
        if (!session) return;
        const entry = attendanceTokens.get(String(body.token || ""));
        if (!entry || entry.expiresAt <= Date.now() || entry.fecha !== dateKey(new Date())) {
            return sendJson(response, 410, { ok: false, message: "QR inexistente o vencido. Escanea el QR actual." });
        }
        const apprentice = apprentices.find((item) => item.id === session.user.id);
        if (!apprentice || (canonicalUserStatus(apprentice.status) || "Activo") !== "Activo" || !apprenticeIsEnabled(apprentice) || String(apprentice.program?.ficha || apprentice.program?.code || "") !== entry.ficha) {
            return sendJson(response, 403, { ok: false, message: "No perteneces a esta ficha o tu cuenta está inactiva." });
        }
        if (attendanceRecords.some((item) => item.identificacion === apprentice.document && item.ficha === entry.ficha && item.fecha === entry.fecha && item.jornada === entry.jornada)) {
            return sendJson(response, 409, { ok: false, message: "Ya tienes asistencia registrada para esta fecha y jornada." });
        }
        const record = { identificacion: apprentice.document, nombre: apprentice.name, ficha: entry.ficha, fecha: entry.fecha, jornada: entry.jornada, estado: "presente", observacion: "Registro por QR", hora_registro: new Date().toISOString(), registrado_por: session.user.email || session.user.id };
        attendanceRecords.push(record);
        try { persistAttendance(); } catch (error) { attendanceRecords.pop(); throw error; }
        audit(session, "register_qr", "asistencia", `${record.fecha}:${record.jornada}:${record.ficha}:${record.identificacion}`, null, record);
        return sendJson(response, 201, { ok: true, message: "Asistencia registrada correctamente.", registro: record });
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
        const closure = findAttendanceClosure(ficha, fecha, jornada);
        if (closure) return sendJson(response, 423, { ok: false, message: `La jornada está cerrada desde ${closure.closedAt}. Solo un administrador puede reabrirla.` });
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
        const previousRecords = attendanceRecords.filter(item => item.ficha === ficha && item.fecha === fecha && item.jornada === jornada);
        const comparable = (items) => items.map((item) => ({ identificacion: item.identificacion, estado: item.estado, observacion: item.observacion || "" })).sort((a, b) => a.identificacion.localeCompare(b.identificacion));
        const changed = JSON.stringify(comparable(previousRecords)) !== JSON.stringify(comparable(records));
        if (previousRecords.length && !changed) return sendJson(response, 200, { ok: true, guardados: previousRecords.length, ultima_actualizacion: previousRecords.map((item) => item.hora_registro).sort().at(-1), message: "No había cambios por corregir." });
        const correctionReason = String(body.correctionReason || "").trim();
        if (previousRecords.length && correctionReason.length < 10) {
            return sendJson(response, 400, { ok: false, message: "Indica un motivo de corrección de al menos 10 caracteres." });
        }
        if (previousRecords.length) for (const record of records) record.correction = { reason: correctionReason.slice(0, 300), correctedAt: now, correctedBy: session.user.email || session.user.id };
        for (let index = attendanceRecords.length - 1; index >= 0; index -= 1) {
            const item = attendanceRecords[index];
            if (item.ficha === ficha && item.fecha === fecha && item.jornada === jornada) attendanceRecords.splice(index, 1);
        }
        attendanceRecords.push(...records);
        persistAttendance();
        audit(session, previousRecords.length ? "correct" : "create", "asistencia_jornada", attendanceClosureKey(ficha, fecha, jornada), previousRecords, records, { total: records.length, correctionReason: previousRecords.length ? correctionReason : null });
        return sendJson(response, 200, {
            ok: true,
            guardados: records.length,
            ultima_actualizacion: now,
            message: previousRecords.length ? `Asistencia corregida para ${records.length} aprendices; el cambio quedó auditado.` : `Asistencia guardada para ${records.length} aprendices.`
        });
    }

    async function handleAttendanceClose(request, response) {
        const session = requireStaff(request, response);
        if (!session) return;
        const body = await readJsonBody(request);
        const ficha = String(body.ficha || "").trim(), fecha = String(body.fecha || "").trim(), jornada = String(body.jornada || "").trim();
        const reason = String(body.reason || "").trim();
        if (reason.length < 10) return sendJson(response, 400, { ok: false, message: "Indica un motivo de cierre de al menos 10 caracteres." });
        const key = attendanceClosureKey(ficha, fecha, jornada);
        if (findAttendanceClosure(ficha, fecha, jornada)) return sendJson(response, 409, { ok: false, message: "La jornada ya está cerrada." });
        const records = attendanceRecords.filter((item) => item.ficha === ficha && item.fecha === fecha && item.jornada === jornada);
        if (!records.length) return sendJson(response, 409, { ok: false, message: "Guarda la asistencia antes de cerrar la jornada." });
        const closure = { key, ficha, fecha, jornada, reason: reason.slice(0, 300), closedAt: new Date().toISOString(), closedBy: session.user.email || session.user.id };
        trainingState.attendanceClosures.push(closure);
        persistTraining();
        audit(session, "close", "asistencia_jornada", key, null, closure, { total: records.length });
        return sendJson(response, 200, { ok: true, cierre: closure, message: "Jornada cerrada. Ya no admite correcciones ordinarias." });
    }

    async function handleAttendanceReopen(request, response) {
        const session = requireAdministrator(request, response);
        if (!session) return;
        const body = await readJsonBody(request);
        const ficha = String(body.ficha || "").trim(), fecha = String(body.fecha || "").trim(), jornada = String(body.jornada || "").trim();
        const reason = String(body.reason || "").trim();
        if (reason.length < 10) return sendJson(response, 400, { ok: false, message: "Indica un motivo de reapertura de al menos 10 caracteres." });
        const index = trainingState.attendanceClosures.findIndex((item) => item.key === attendanceClosureKey(ficha, fecha, jornada));
        if (index < 0) return sendJson(response, 404, { ok: false, message: "La jornada no está cerrada." });
        const [closure] = trainingState.attendanceClosures.splice(index, 1);
        persistTraining();
        audit(session, "reopen", "asistencia_jornada", closure.key, closure, null, { reason: reason.slice(0, 300) });
        return sendJson(response, 200, { ok: true, message: "Jornada reabierta. La próxima modificación exigirá motivo de corrección." });
    }

    function publicExcuse(item) {
        const { dataBase64: _data, ...support } = item.support || {};
        return { ...item, support };
    }

    function handleExcusesList(request, response, requestUrl) {
        const session = currentSession(request);
        if (!session) return sendJson(response, 403, { ok: false, message: "Debes iniciar sesión para consultar excusas." });
        const role = String(session.user.role || "").toLowerCase();
        const status = String(requestUrl.searchParams.get("status") || "").toLowerCase();
        let selected = role === "aprendiz" ? excuses.filter((item) => item.document === session.user.document) : excuses;
        if (!["aprendiz", "administrador", "coordinador", "instructor"].includes(role)) return sendJson(response, 403, { ok: false, message: "No tienes permiso para consultar excusas." });
        if (status) selected = selected.filter((item) => item.status === status);
        return sendJson(response, 200, { ok: true, excuses: selected.map(publicExcuse).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)) });
    }

    async function handleExcuseCreate(request, response) {
        const session = requireApprentice(request, response);
        if (!session) return;
        const submission = await readExcuseSubmission(request);
        const apprentice = apprentices.find((item) => item.id === session.user.id || item.document === session.user.document);
        const ficha = String(submission.ficha || apprentice?.program?.ficha || "").trim();
        const date = String(submission.fecha || "").trim();
        const reason = String(submission.motivo || "").trim();
        if (!apprentice || ficha !== String(apprentice.program?.ficha || apprentice.program?.code || "")) return sendJson(response, 400, { ok: false, message: "La ficha de la excusa no corresponde al aprendiz." });
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > dateKey(new Date())) return sendJson(response, 400, { ok: false, message: "Selecciona una fecha de ausencia válida, no futura." });
        if (reason.length < 10) return sendJson(response, 400, { ok: false, message: "Describe el motivo de la excusa con al menos 10 caracteres." });
        const absence = attendanceRecords.find((item) => item.identificacion === apprentice.document && item.ficha === ficha && item.fecha === date && item.estado === "ausente");
        if (!absence) return sendJson(response, 409, { ok: false, message: "No existe una ausencia pendiente para esa fecha y ficha." });
        if (excuses.some((item) => item.document === apprentice.document && item.ficha === ficha && item.date === date && ["pending", "approved"].includes(item.status))) return sendJson(response, 409, { ok: false, message: "Ya existe una excusa pendiente o aprobada para esa ausencia." });
        const excuse = {
            id: crypto.randomUUID(), document: apprentice.document, apprenticeName: apprentice.name, ficha, date,
            journey: absence.jornada, reason: reason.slice(0, 500), status: "pending", submittedAt: new Date().toISOString(),
            support: submission.support, reviewedAt: null, reviewedBy: null, reviewComment: ""
        };
        excuses.push(excuse);
        persistExcuses();
        audit(session, "submit", "excusa", excuse.id, null, publicExcuse(excuse), { attendance: attendanceClosureKey(ficha, date, absence.jornada) });
        return sendJson(response, 201, { ok: true, excuse: publicExcuse(excuse), message: "Excusa enviada. Un instructor debe revisarla." });
    }

    async function handleExcuseReview(request, response, id) {
        const session = requireStaff(request, response);
        if (!session) return;
        const body = await readJsonBody(request);
        const decision = String(body.decision || "").toLowerCase();
        const comment = String(body.comment || "").trim();
        if (!new Set(["approved", "rejected"]).has(decision) || comment.length < 5) return sendJson(response, 400, { ok: false, message: "Selecciona aprobar o rechazar e indica un comentario de al menos 5 caracteres." });
        const excuse = excuses.find((item) => item.id === id);
        if (!excuse) return sendJson(response, 404, { ok: false, message: "Excusa no encontrada." });
        if (excuse.status !== "pending") return sendJson(response, 409, { ok: false, message: "La excusa ya fue revisada." });
        const before = publicExcuse(excuse);
        if (decision === "approved") {
            const attendance = attendanceRecords.find((item) => item.identificacion === excuse.document && item.ficha === excuse.ficha && item.fecha === excuse.date && item.jornada === excuse.journey && item.estado === "ausente");
            if (!attendance) return sendJson(response, 409, { ok: false, message: "La ausencia original ya no está disponible para justificar." });
            const previousAttendance = JSON.parse(JSON.stringify(attendance));
            attendance.estado = "justificado";
            attendance.observacion = `Excusa aprobada: ${comment}`.slice(0, 200);
            attendance.hora_registro = new Date().toISOString();
            attendance.registrado_por = session.user.email || session.user.id;
            attendance.correction = { reason: `Aprobación de excusa ${excuse.id}`, correctedAt: attendance.hora_registro, correctedBy: attendance.registrado_por };
            persistAttendance();
            audit(session, "justify", "asistencia", `${excuse.date}:${excuse.journey}:${excuse.ficha}:${excuse.document}`, previousAttendance, attendance, { excuseId: excuse.id });
        }
        excuse.status = decision;
        excuse.reviewedAt = new Date().toISOString();
        excuse.reviewedBy = session.user.email || session.user.id;
        excuse.reviewComment = comment.slice(0, 500);
        persistExcuses();
        audit(session, decision === "approved" ? "approve" : "reject", "excusa", excuse.id, before, publicExcuse(excuse));
        return sendJson(response, 200, { ok: true, excuse: publicExcuse(excuse), message: decision === "approved" ? "Excusa aprobada y ausencia marcada como justificada." : "Excusa rechazada." });
    }

    function handleExcuseSupport(request, response, id) {
        const session = currentSession(request);
        const excuse = excuses.find((item) => item.id === id);
        if (!session || !excuse) return sendJson(response, 404, { ok: false, message: "Soporte no encontrado." });
        if (String(session.user.role).toLowerCase() === "aprendiz" && excuse.document !== session.user.document) return sendJson(response, 403, { ok: false, message: "No puedes consultar este soporte." });
        const buffer = Buffer.from(excuse.support.dataBase64, "base64");
        response.writeHead(200, { "Content-Type": excuse.support.mimeType, "Content-Disposition": `attachment; filename="${excuse.support.name.replace(/["\\]/g, "_")}"`, "Content-Length": buffer.length, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" });
        response.end(buffer);
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

    function requireBackupAdministrator(request, response) {
        const session = currentSession(request);
        if (!session || String(session.user?.role || "").trim().toLowerCase() !== "administrador") {
            sendJson(response, 403, { ok: false, message: "El respaldo integral es exclusivo para administradores." });
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
        // Las instalaciones con MySQL conservan esta credencial fuera de la base de datos.
        // Las pruebas aisladas solo escriben cuando proporcionan un archivo temporal explícito.
        if (!persistentRuntime && !repository && !options.adminCredentialsFile) return;
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
        audit(session, "create", "programa", program.id, null, publicProgram(program));
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
        const before = publicProgram(program);
        program.nombre = values.name;
        program.nivel = values.level;
        program.duracion = values.duration;
        program.estado = values.status;
        program.updatedAt = new Date().toISOString();
        program.updatedBy = session.user.email || session.user.id;
        persistPrograms();
        audit(session, "update", "programa", program.id, before, publicProgram(program));
        return sendJson(response, 200, {
            ok: true,
            message: "Programa actualizado correctamente.",
            program: publicProgram(program),
            ...programDirectoryPayload()
        });
    }

    async function handleProgramDelete(request, response, code) {
        const session = requireAdministrator(request, response);
        if (!session) return;
        const index = programRecords.findIndex(item => String(item.id) === String(code));
        if (index < 0) return sendJson(response, 404, { ok: false, message: "No se encontró el programa solicitado." });
        const program = programRecords[index];
        const linkedFichas = sqlData.fichas.filter(item => String(item.programaId) === String(code));
        if (linkedFichas.length) return sendJson(response, 409, {
            ok: false,
            message: `No se puede eliminar ${program.nombre}: tiene ${linkedFichas.length} ficha${linkedFichas.length === 1 ? "" : "s"} vinculada${linkedFichas.length === 1 ? "" : "s"}. Desactívalo o reasigna primero las fichas.`,
            dependencies: { fichas: linkedFichas.length }
        });
        const before = publicProgram(program);
        programRecords.splice(index, 1);
        persistPrograms();
        audit(session, "delete", "programa", code, before, null);
        return sendJson(response, 200, { ok: true, message: "Programa eliminado correctamente.", ...programDirectoryPayload() });
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
            if ((user.id && session.user?.id === user.id) || (user.document && session.user?.document === user.document) || (user.email && normalizeEmail(session.user?.email) === normalizeEmail(user.email))) sessions.delete(token);
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
        if (csvFileBacked) return false;
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
        if (csvFileBacked) return false;
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
                id: existing.id || id,
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
        const isRegistered = user => !csvFileBacked || csvUsers.some(row => row.identificacion === user.document && canonicalRole(row.rol) === canonicalRole(user.role));
        apprentices.filter(isRegistered).forEach(add);
        accounts.filter(user => userIsProtected(user) || isRegistered(user)).forEach(add);
        csvUsers.forEach(add);
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
        if (csvUsers.some((user) => String(user.identificacion || "").trim() === document)) return sendJson(response, 409, { ok: false, message: "El documento ya existe en la base principal de usuarios." });
        if (csvUsers.some((user) => normalizeEmail(user.correo) === email)) return sendJson(response, 409, { ok: false, message: "El correo ya existe en la base principal de usuarios." });
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
        persistCsvUsers();
        persistManagedUsers();
        if (role === "Aprendiz") persistApprentices();
        const createdUser = systemUsers().find((item) => item.document === document && normalizeEmail(item.email) === email);
        audit(session, "create", "usuario", createdUser?.id || document, null, createdUser);

        return sendJson(response, 201, {
            ok: true,
            message: `${role} creado correctamente. El código de acceso se enviará a ${email} cuando lo solicite al iniciar sesión.`,
            user: createdUser,
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
        const body = await readJsonBody(request);
        const target = findDirectoryUser(id);
        if (!target) return sendJson(response, 404, { ok: false, message: "No se encontró el usuario solicitado." });
        if (userIsProtected(target)) return sendJson(response, 403, { ok: false, message: "La cuenta principal del sistema está protegida." });
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
            return sendJson(response, 409, { ok: false, message: "El correo ya pertenece a otro registro de la base principal de usuarios." });
        }
        if (session.user.id === target.id && status === "Inactivo") {
            return sendJson(response, 400, { ok: false, message: "No puedes desactivar la cuenta con la que tienes la sesión abierta." });
        }
        const statusChanged = status !== target.status;
        const updated = applyUserUpdate(target, { documentType, name, email, phone, status, ficha });
        if (status === "Inactivo") invalidateUserSessions(updated);
        audit(session, statusChanged ? (status === "Activo" ? "activate" : "deactivate") : "update", "usuario", updated.id, target, updated);
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
        audit(session, "delete", "usuario", target.id, target, null);
        return sendJson(response, 200, {
            ok: true,
            message: `${target.name} fue eliminado del sistema y de la base principal de usuarios.`,
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

    async function handleUserImport(request, response, sqlUpload = false) {
        const session = requireAdministrator(request, response);
        if (!session) return;
        let body;
        if (sqlUpload) {
            const sql = await readSqlFile(request);
            refreshUsersFromCsv();
            if (!requireAdministrator(request, response)) return;
            body = { fileName: "SQLFILE.csv", csv: serializeCsvUsers(parseUsersSql(sql)) };
        } else body = await readJsonBody(request, 512 * 1024);
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
                    throw new Error(`Fila ${record.rowNumber}: el documento ya está asociado a otro correo en la base principal de usuarios.`);
                }
                if (registryByEmail.some((user) => String(user.identificacion || "").trim() !== record.document)) {
                    throw new Error(`Fila ${record.rowNumber}: el correo ya está asociado a otro documento en la base principal de usuarios.`);
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
        audit(session, "import", "usuarios", fileName, null, { total: records.length, created, updated }, { fileName });
        return sendJson(response, 201, {
            ok: true,
            message: `${records.length} usuario${records.length === 1 ? "" : "s"} procesado${records.length === 1 ? "" : "s"}: ${created} nuevo${created === 1 ? "" : "s"} y ${updated} actualizado${updated === 1 ? "" : "s"}.`,
            importResult: { total: records.length, created, updated, fileName },
            ...userDirectoryPayload()
        });
    }

    function exportDatabaseSql() {
        refreshUsersFromCsv();
        return createDump(csvUsers, {
            ambientes: sqlData.ambientes, fichas: sqlData.fichas,
            horarios: sqlData.horarios, programas: programRecords,
            aprendices: apprentices, asistencia: attendanceRecords, reportes: reports,
            cuentas: accounts.map(({ passwordHash, salt, password, ...profile }) => profile)
        });
    }

    async function handleSqlExport(request, response) {
        if (!requireAdministrator(request, response)) return;
        const dump = exportDatabaseSql();
        response.writeHead(200, {
            "Content-Type": "application/sql; charset=utf-8",
            "Content-Disposition": 'attachment; filename="Base_datos_SENA.sql"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff"
        });
        response.end(dump);
    }

    const cleanText = (value, max = 160) => String(value || "").trim().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").slice(0, max);
    const nextNumericId = records => records.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
    const publicFicha = ficha => {
        const program = programRecords.find(item => String(item.id) === String(ficha.programaId));
        const code = String(ficha.numero || "");
        return { id: String(ficha.id), code: String(ficha.numero || ""), plan: fichaPlan(code), program: String(program?.nombre || ficha.programa || "Sin programa"),
            programId: String(ficha.programaId || ""), schedule: normalizeSqlText(ficha.jornada || ""), mode: String(ficha.modalidad || ""),
            status: String(ficha.estado || ""), instructorId: ficha.instructorId == null ? "" : String(ficha.instructorId), dependencies: {
                aprendices: csvUsers.filter(item => canonicalRole(item.rol) === "Aprendiz" && String(item.ficha) === code).length,
                horarios: sqlData.horarios.filter(item => String(item.fichaId) === String(ficha.id)).length,
                asistencias: attendanceRecords.filter(item => item.ficha === code).length
            } };
    };
    const publicEnvironment = item => ({ id: String(item.id), code: String(item.codigo || ""), name: String(item.nombre || ""),
        capacity: Number(item.capacidad) || 0, type: String(item.tipo || ""), status: String(item.estado || ""), zone: String(item.zona || ""),
        dependencies: { horarios: sqlData.horarios.filter(schedule => String(schedule.ambienteId) === String(item.id)).length } });
    const publicSchedule = item => {
        const ficha = sqlData.fichas.find(value => String(value.id) === String(item.fichaId));
        const environment = sqlData.ambientes.find(value => String(value.id) === String(item.ambienteId));
        const instructor = systemUsers().find(value => String(value.id) === String(item.instructorId) || value.document === String(item.instructorId));
        const code = String(ficha?.numero || item.ficha || ""), journey = fichaPlan(code)?.schedule || (Number(String(item.horaInicio || "00").slice(0, 2)) < 12 ? "Mañana" : Number(String(item.horaInicio || "00").slice(0, 2)) < 18 ? "Tarde" : "Noche");
        return { id: String(item.id), ficha: code, day: normalizeSqlText(item.dia || ""),
            start: String(item.horaInicio || ""), end: String(item.horaFin || ""), time: `${item.horaInicio || ""} - ${item.horaFin || ""}`,
            environmentId: String(item.ambienteId || ""), environment: environment ? `${environment.codigo} · ${environment.nombre}` : "Sin ambiente",
            zone: String(environment?.zona || ""), instructorId: String(item.instructorId || ""), instructor: instructor?.name || "Sin instructor", status: String(item.estado || "Activo"),
            dependencies: { asistencias: attendanceRecords.filter(record => record.ficha === code && record.jornada === journey).length } };
    };
    function trainingPayload() {
        return { scale: SCALE, weeklyPlan: weeklyPlan(sqlData.fichas), fichas: sqlData.fichas.map(publicFicha).sort((a, b) => a.code.localeCompare(b.code, "es", { numeric: true })),
            schedules: sqlData.horarios.map(publicSchedule), environments: sqlData.ambientes.map(publicEnvironment),
            programs: programRecords.map(item => ({ id: String(item.id), name: String(item.nombre || "") })),
            instructors: systemUsers().filter(item => item.role === "Instructor" && item.status === "Activo").map(item => ({ id: item.id, name: item.name, document: item.document })) };
    }
    function handleTrainingData(request, response) {
        if (!requireStaff(request, response)) return;
        return sendJson(response, 200, { ok: true, ...trainingPayload() });
    }
    function validateFichaInput(body, current = {}) {
        const code = cleanText(body.code ?? current.numero, 15).replace(/\D/g, "");
        const programId = cleanText(body.programId ?? current.programaId, 20);
        const schedule = cleanText(body.schedule ?? current.jornada, 20);
        const mode = cleanText(body.mode ?? current.modalidad, 30);
        const status = cleanText(body.status ?? current.estado, 20);
        const instructorId = cleanText(body.instructorId ?? current.instructorId, 80);
        if (!/^\d{4,15}$/.test(code) || !programRecords.some(item => String(item.id) === programId)) throw Object.assign(new Error("Revisa el número de ficha y selecciona un programa válido."), { status: 400 });
        if (!["Mañana", "Tarde", "Noche", "Mixta"].includes(schedule) || !["Presencial", "Virtual", "A distancia", "Mixta"].includes(mode) || !["Activa", "Inactiva"].includes(status)) throw Object.assign(new Error("La jornada, modalidad o estado de la ficha no es válido."), { status: 400 });
        const plan = fichaPlan(code);
        if (plan && schedule !== plan.schedule) throw Object.assign(new Error(`La ficha ${code} corresponde a la jornada ${plan.schedule}, de ${plan.start} a ${plan.end}.`), { status: 400 });
        if (instructorId && instructorId !== String(current.instructorId ?? "") && !systemUsers().some(item => (item.id === instructorId || item.document === instructorId) && item.role === "Instructor" && item.status === "Activo")) throw Object.assign(new Error("Selecciona un instructor activo o deja la ficha sin asignar."), { status: 400 });
        return { code, programId, schedule, mode, status, instructorId: instructorId || null };
    }
    function validateEnvironmentInput(body, current = {}) {
        const value = { code: cleanText(body.code ?? current.codigo, 30), name: cleanText(body.name ?? current.nombre), capacity: Number(body.capacity ?? current.capacidad),
            type: cleanText(body.type ?? current.tipo, 40), status: cleanText(body.status ?? current.estado, 30), zone: cleanText(body.zone ?? current.zona, 60) };
        if (!/^[A-Za-z0-9._-]{1,30}$/.test(value.code) || !value.name || !Number.isInteger(value.capacity) || value.capacity < 1 || value.capacity > 1000 || !value.zone) throw Object.assign(new Error("Revisa el código, nombre, capacidad y zona del ambiente."), { status: 400 });
        if (!["Aula", "Laboratorio", "Especializado", "Taller", "Auditorio"].includes(value.type) || !["Disponible", "Ocupado", "Mantenimiento", "Inactivo"].includes(value.status)) throw Object.assign(new Error("El tipo o estado del ambiente no es válido."), { status: 400 });
        return value;
    }
    function validateScheduleInput(body, current = {}) {
        const value = { fichaId: cleanText(body.fichaId ?? current.fichaId, 30), ambienteId: cleanText(body.environmentId ?? current.ambienteId, 30), instructorId: cleanText(body.instructorId ?? current.instructorId, 80),
            day: cleanText(body.day ?? current.dia, 20), start: cleanText(body.start ?? current.horaInicio, 5), end: cleanText(body.end ?? current.horaFin, 5), status: cleanText(body.status ?? current.estado ?? "Activo", 20) };
        const selectedFicha = sqlData.fichas.find(item => String(item.id) === value.fichaId);
        const selectedEnvironment = sqlData.ambientes.find(item => String(item.id) === value.ambienteId);
        if (!selectedFicha || !selectedEnvironment || !systemUsers().some(item => (item.id === value.instructorId || item.document === value.instructorId) && item.role === "Instructor" && item.status === "Activo")) throw Object.assign(new Error("Selecciona ficha, ambiente e instructor válidos."), { status: 400 });
        if (!["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"].includes(value.day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.end) || value.start >= value.end || !["Activo", "Inactivo"].includes(value.status)) throw Object.assign(new Error("Revisa el día, el rango de horas y el estado."), { status: 400 });
        const plan = fichaPlan(selectedFicha.numero);
        if (plan && value.status === "Activo" && (!plan.days.includes(value.day) || value.start < plan.start || value.end > plan.end)) throw Object.assign(new Error(`Esta ficha tiene clases de lunes a viernes, de ${plan.start} a ${plan.end}.`), { status: 400 });
        if (value.status === "Activo" && (String(selectedFicha.estado || "Activa") !== "Activa" || String(selectedEnvironment.estado || "Disponible") === "Inactivo")) throw Object.assign(new Error("No puedes activar un horario con una ficha o ambiente inactivo."), { status: 409 });
        const collision = value.status === "Activo" && sqlData.horarios.some(item => item !== current && String(item.estado || "Activo") === "Activo" && normalizeSqlText(item.dia) === value.day && String(item.ambienteId) === value.ambienteId && value.start < String(item.horaFin).slice(0, 5) && value.end > String(item.horaInicio).slice(0, 5));
        if (collision) throw Object.assign(new Error("El ambiente ya tiene un horario que se cruza con este rango."), { status: 409 });
        const availableInstructors = systemUsers().filter(item => item.role === "Instructor");
        const instructorKey = id => {
            const user = availableInstructors.find(item => String(item.id) === String(id) || String(item.document) === String(id));
            return String(user?.document || id);
        };
        const occupied = value.status === "Activo" && sqlData.horarios.some(item => item !== current && String(item.estado || "Activo") === "Activo" && normalizeSqlText(item.dia) === value.day && value.start < String(item.horaFin).slice(0, 5) && value.end > String(item.horaInicio).slice(0, 5) && (String(item.fichaId) === value.fichaId || instructorKey(item.instructorId) === instructorKey(value.instructorId)));
        if (occupied) throw Object.assign(new Error("La ficha o el instructor ya tiene una clase en este rango."), { status: 409 });
        return value;
    }
    async function handleFichaCreate(request, response) {
        const session = requireAdministrator(request, response); if (!session) return;
        const value = validateFichaInput(await readJsonBody(request));
        if (sqlData.fichas.some(item => String(item.numero) === value.code)) return sendJson(response, 409, { ok: false, message: "Ya existe una ficha con ese número." });
        const record = { id: nextNumericId(sqlData.fichas), numero: value.code, jornada: value.schedule, modalidad: value.mode, estado: value.status, programaId: Number(value.programId), instructorId: value.instructorId };
        sqlData.fichas.push(record); persistTraining(); audit(session, "create", "ficha", record.id, null, publicFicha(record));
        return sendJson(response, 201, { ok: true, message: "Ficha guardada en el servidor.", ...trainingPayload() });
    }
    async function handleFichaUpdate(request, response, id) {
        const session = requireAdministrator(request, response); if (!session) return;
        const record = sqlData.fichas.find(item => String(item.id) === String(id)); if (!record) return sendJson(response, 404, { ok: false, message: "Ficha no encontrada." });
        const before = publicFicha(record), value = validateFichaInput(await readJsonBody(request), record);
        if (sqlData.fichas.some(item => item !== record && String(item.numero) === value.code)) return sendJson(response, 409, { ok: false, message: "Ya existe otra ficha con ese número." });
        Object.assign(record, { numero: value.code, jornada: value.schedule, modalidad: value.mode, estado: value.status, programaId: Number(value.programId), instructorId: value.instructorId });
        persistTraining(); audit(session, "update", "ficha", record.id, before, publicFicha(record));
        return sendJson(response, 200, { ok: true, message: "Ficha actualizada.", ...trainingPayload() });
    }
    async function handleFichaDelete(request, response, id) {
        const session = requireAdministrator(request, response); if (!session) return;
        const index = sqlData.fichas.findIndex(item => String(item.id) === String(id)); if (index < 0) return sendJson(response, 404, { ok: false, message: "Ficha no encontrada." });
        const record = sqlData.fichas[index], code = String(record.numero);
        const dependencies = {
            aprendices: csvUsers.filter(item => canonicalRole(item.rol) === "Aprendiz" && String(item.ficha) === code).length,
            horarios: sqlData.horarios.filter(item => String(item.fichaId) === String(record.id)).length,
            asistencias: attendanceRecords.filter(item => item.ficha === code).length
        };
        if (Object.values(dependencies).some(Boolean)) return sendJson(response, 409, { ok: false, message: `No se puede eliminar la ficha ${code}: conserva ${dependencies.aprendices} aprendiz(es), ${dependencies.horarios} horario(s) y ${dependencies.asistencias} asistencia(s). Puedes desactivarla.`, dependencies });
        const before = publicFicha(record); sqlData.fichas.splice(index, 1); persistTraining(); audit(session, "delete", "ficha", id, before, null);
        return sendJson(response, 200, { ok: true, message: "Ficha eliminada correctamente.", ...trainingPayload() });
    }
    async function handleEnvironmentCreate(request, response) {
        const session = requireAdministrator(request, response); if (!session) return;
        const value = validateEnvironmentInput(await readJsonBody(request));
        if (sqlData.ambientes.some(item => String(item.codigo).toLowerCase() === value.code.toLowerCase())) return sendJson(response, 409, { ok: false, message: "Ya existe un ambiente con ese código." });
        const record = { id: nextNumericId(sqlData.ambientes), codigo: value.code, nombre: value.name, capacidad: value.capacity, tipo: value.type, estado: value.status, zona: value.zone };
        sqlData.ambientes.push(record); persistTraining(); audit(session, "create", "ambiente", record.id, null, publicEnvironment(record));
        return sendJson(response, 201, { ok: true, message: "Ambiente guardado en el servidor.", ...trainingPayload() });
    }
    async function handleEnvironmentUpdate(request, response, id) {
        const session = requireAdministrator(request, response); if (!session) return;
        const record = sqlData.ambientes.find(item => String(item.id) === String(id)); if (!record) return sendJson(response, 404, { ok: false, message: "Ambiente no encontrado." });
        const before = publicEnvironment(record), value = validateEnvironmentInput(await readJsonBody(request), record);
        if (sqlData.ambientes.some(item => item !== record && String(item.codigo).toLowerCase() === value.code.toLowerCase())) return sendJson(response, 409, { ok: false, message: "Ya existe otro ambiente con ese código." });
        Object.assign(record, { codigo: value.code, nombre: value.name, capacidad: value.capacity, tipo: value.type, estado: value.status, zona: value.zone });
        persistTraining(); audit(session, "update", "ambiente", record.id, before, publicEnvironment(record));
        return sendJson(response, 200, { ok: true, message: "Ambiente actualizado.", ...trainingPayload() });
    }
    async function handleEnvironmentDelete(request, response, id) {
        const session = requireAdministrator(request, response); if (!session) return;
        const index = sqlData.ambientes.findIndex(item => String(item.id) === String(id)); if (index < 0) return sendJson(response, 404, { ok: false, message: "Ambiente no encontrado." });
        const record = sqlData.ambientes[index], horarios = sqlData.horarios.filter(item => String(item.ambienteId) === String(record.id)).length;
        if (horarios) return sendJson(response, 409, { ok: false, message: `No se puede eliminar ${record.nombre}: tiene ${horarios} horario${horarios === 1 ? "" : "s"} vinculado${horarios === 1 ? "" : "s"}. Desactívalo o reasigna primero los horarios.`, dependencies: { horarios } });
        const before = publicEnvironment(record); sqlData.ambientes.splice(index, 1); persistTraining(); audit(session, "delete", "ambiente", id, before, null);
        return sendJson(response, 200, { ok: true, message: "Ambiente eliminado correctamente.", ...trainingPayload() });
    }
    async function handleScheduleCreate(request, response) {
        const session = requireAdministrator(request, response); if (!session) return;
        const value = validateScheduleInput(await readJsonBody(request));
        const record = { id: nextNumericId(sqlData.horarios), fichaId: Number(value.fichaId), ambienteId: Number(value.ambienteId), instructorId: value.instructorId, dia: value.day, horaInicio: value.start, horaFin: value.end, estado: value.status };
        sqlData.horarios.push(record); persistTraining(); audit(session, "create", "horario", record.id, null, publicSchedule(record));
        return sendJson(response, 201, { ok: true, message: "Horario guardado en el servidor.", ...trainingPayload() });
    }
    async function handleScheduleUpdate(request, response, id) {
        const session = requireAdministrator(request, response); if (!session) return;
        const record = sqlData.horarios.find(item => String(item.id) === String(id)); if (!record) return sendJson(response, 404, { ok: false, message: "Horario no encontrado." });
        const before = publicSchedule(record), value = validateScheduleInput(await readJsonBody(request), record);
        Object.assign(record, { fichaId: Number(value.fichaId), ambienteId: Number(value.ambienteId), instructorId: value.instructorId, dia: value.day, horaInicio: value.start, horaFin: value.end, estado: value.status });
        persistTraining(); audit(session, "update", "horario", record.id, before, publicSchedule(record));
        return sendJson(response, 200, { ok: true, message: "Horario actualizado.", ...trainingPayload() });
    }
    async function handleScheduleDelete(request, response, id) {
        const session = requireAdministrator(request, response); if (!session) return;
        const index = sqlData.horarios.findIndex(item => String(item.id) === String(id)); if (index < 0) return sendJson(response, 404, { ok: false, message: "Horario no encontrado." });
        const record = sqlData.horarios[index], ficha = sqlData.fichas.find(item => String(item.id) === String(record.fichaId));
        const journey = fichaPlan(ficha?.numero)?.schedule || (Number(String(record.horaInicio || "00").slice(0, 2)) < 12 ? "Mañana" : Number(String(record.horaInicio || "00").slice(0, 2)) < 18 ? "Tarde" : "Noche");
        const asistencias = attendanceRecords.filter(item => item.ficha === String(ficha?.numero || "") && item.jornada === journey).length;
        if (asistencias) return sendJson(response, 409, { ok: false, message: `No se puede eliminar este horario: tiene ${asistencias} asistencia${asistencias === 1 ? "" : "s"} vinculada${asistencias === 1 ? "" : "s"}. Puedes desactivarlo.`, dependencies: { asistencias } });
        const before = publicSchedule(record); sqlData.horarios.splice(index, 1); persistTraining(); audit(session, "delete", "horario", id, before, null);
        return sendJson(response, 200, { ok: true, message: "Horario eliminado correctamente.", ...trainingPayload() });
    }

    function nextSessions() {
        const days = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
        const now = new Date();
        const fichasById = new Map(sqlData.fichas.map((item) => [item.id, item]));
        const environmentsById = new Map(sqlData.ambientes.map((item) => [item.id, item]));
        const programsById = new Map(sqlData.programas.map((item) => [item.id, item]));
        return sqlData.horarios.filter(schedule => String(schedule.estado || "Activo") === "Activo").map((schedule) => {
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
            if (!ficha || String(ficha.estado || "Activa") !== "Activa" || !environment || String(environment.estado || "Disponible") === "Inactivo") return null;
            return {
                ficha: String(ficha?.numero || ""),
                programa: String(program?.nombre || "Programa de formación"),
                dia: dayName,
                fecha: dateKey(date),
                horaInicio: String(schedule.horaInicio || "").slice(0, 5),
                horaFin: String(schedule.horaFin || "").slice(0, 5),
                jornada: fichaPlan(ficha.numero)?.schedule || (startHour < 12 ? "Mañana" : startHour < 18 ? "Tarde" : "Noche"),
                ambiente: environment ? `Amb. ${environment.codigo}` : "Sin ambiente",
                timestamp: date.getTime()
            };
        }).filter(Boolean).sort((left, right) => left.timestamp - right.timestamp).slice(0, 3).map(({ timestamp, ...session }) => session);
    }

    function statisticsPayload(requestUrl, session) {
        const range = resolveDashboardRange(requestUrl, attendanceRecords);
        const trendDays = [7, 15, 30].includes(Number(requestUrl.searchParams.get("trendDays")))
            ? Number(requestUrl.searchParams.get("trendDays"))
            : 7;
        const fichaFilter = String(requestUrl.searchParams.get("ficha") || "").trim();
        const journeyFilter = String(requestUrl.searchParams.get("jornada") || "").trim();
        const allFichas = attendanceFichas();
        attendanceRecords.forEach((record) => {
            if (!allFichas.some((item) => item.codigo === record.ficha)) allFichas.push({ codigo: record.ficha, programa: "Ficha histórica" });
        });
        if (fichaFilter && !allFichas.some((item) => item.codigo === fichaFilter)) throw Object.assign(new Error("La ficha seleccionada no existe."), { status: 400 });
        if (journeyFilter && !["Mañana", "Tarde", "Noche", "Mixta"].includes(journeyFilter)) throw Object.assign(new Error("Jornada inválida."), { status: 400 });
        const matchesScope = (item) => (!fichaFilter || item.ficha === fichaFilter) && (!journeyFilter || item.jornada === journeyFilter);
        const inRange = (item, from = range.fromText, to = range.toText) => matchesScope(item) && item.fecha >= from && item.fecha <= to;
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
        const fichas = allFichas.filter((item) => !fichaFilter || item.codigo === fichaFilter);
        const availableEnvironments = sqlData.ambientes.filter((item) => String(item.estado || "").toLowerCase() === "disponible").length;
        const occupiedEnvironments = sqlData.ambientes.filter((item) => String(item.estado || "").toLowerCase() === "ocupado").length;

        const composition = fichas.map((ficha) => {
            const records = selectedRecords.filter((item) => item.ficha === ficha.codigo);
            return { ficha: ficha.codigo, programa: ficha.programa, ...statusSummary(records) };
        }).filter((item) => item.total > 0).sort((left, right) => right.attendance - left.attendance);

        const trendStart = addDays(range.to, -(trendDays - 1));
        const trend = Array.from({ length: trendDays }, (_, index) => {
            const date = dateKey(addDays(trendStart, index));
            const records = selectedRecords.filter((item) => item.fecha === date);
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
        const committeeCases = academicCommitteeCases().filter((item) => !fichaFilter || String(item.ficha) === fichaFilter);
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

        const students = new Map();
        selectedRecords.forEach((record) => {
            const key = `${record.ficha}:${record.identificacion}`;
            if (!students.has(key)) {
                const apprentice = apprentices.find((item) => item.document === record.identificacion);
                students.set(key, { identificacion: record.identificacion, nombre: record.nombre || apprentice?.name || record.identificacion, ficha: record.ficha, records: [] });
            }
            students.get(key).records.push(record);
        });
        return {
            ok: true,
            usuario: { name: session.user.name, role: session.user.role },
            filters: { from: range.fromText, to: range.toText, period: range.period, periods: range.periods, trendDays, ficha: fichaFilter, jornada: journeyFilter, fichas: allFichas },
            summary: {
                apprentices: apprentices.filter((item) => apprenticeIsEnabled(item) && (!fichaFilter || String(item.program?.ficha || item.program?.code) === fichaFilter)).length,
                instructors: activeInstructors,
                fichas: fichas.length,
                environmentsAvailable: availableEnvironments,
                environmentsTotal: sqlData.ambientes.length,
                environmentOccupancy: sqlData.ambientes.length ? Math.round(occupiedEnvironments / sqlData.ambientes.length * 100) : 0,
                attendance: currentRate,
                attendanceRecords: selectedRecords.length,
                attendanceDelta
            },
            generatedAt: new Date().toISOString(),
            distribution: statusSummary(selectedRecords),
            students: [...students.values()].map(({ records, ...student }) => ({ ...student, ...statusSummary(records) })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
            records: selectedRecords.map((item) => ({ fecha: item.fecha, jornada: item.jornada, ficha: item.ficha, identificacion: item.identificacion, nombre: item.nombre || apprentices.find((a) => a.document === item.identificacion)?.name || item.identificacion, estado: item.estado, observacion: item.observacion || "" })),
            timeline: Array.from({ length: daysInRange }, (_, index) => {
                const date = dateKey(addDays(range.from, index));
                const records = selectedRecords.filter((item) => item.fecha === date);
                return { date, percentage: records.length ? rateFor(records) : null, ...statusSummary(records) };
            }),
            trend,
            composition,
            weeklyPerformance,
            topFichas: composition.slice(0, 5),
            alerts,
            nextSessions: nextSessions().filter((item) => !fichaFilter || item.ficha === fichaFilter)
        };
    }

    function handleStatistics(request, response, requestUrl) {
        const session = requireStaff(request, response);
        if (!session) return;
        return sendJson(response, 200, statisticsPayload(requestUrl, session));
    }

    const reportsFile = options.reportsFile === null ? null : (options.reportsFile || (persistentRuntime ? path.join(dataDirectory, "reportes_estadisticas.json") : null));
    const reports = options.reports ? JSON.parse(JSON.stringify(options.reports)) : (reportsFile && fs.existsSync(reportsFile) ? JSON.parse(fs.readFileSync(reportsFile, "utf8")) : []);
    const reportsRetentionLimit = options.reportsRetentionLimit == null
        ? boundedInteger(process.env.REPORTS_RETENTION_LIMIT, 500, 10, 5000)
        : boundedInteger(options.reportsRetentionLimit, 500, 2, 5000);
    function persistReports() {
        writeJsonFileAtomic(reportsFile, reports);
    }

    async function handleReports(request, response) {
        const session = requireStaff(request, response);
        if (!session) return;
        if (request.method === "GET") {
            const role = String(session.user.role || "").trim().toLowerCase();
            return sendJson(response, 200, {
                ok: true,
                reports: reports.map(reportMetadata).reverse(),
                permissions: { manage: ["administrador", "coordinador"].includes(role) },
                retention: { limit: reportsRetentionLimit, strategy: "Los informes archivados más antiguos se eliminan primero al alcanzar el límite." }
            });
        }
        const body = await readJsonBody(request);
        if (!localDate(body.from) || !localDate(body.to)) return sendJson(response, 400, { ok: false, message: "Selecciona las dos fechas del informe." });
        const params = new URLSearchParams({ from: body.from, to: body.to, ficha: String(body.ficha || ""), jornada: String(body.jornada || ""), period: "custom" });
        const payload = statisticsPayload(new URL(`/api/statistics?${params}`, "http://localhost"), session);
        if (!payload.distribution.total) return sendJson(response, 400, { ok: false, message: "No hay asistencia guardada en este rango. Registra la asistencia o selecciona otras fechas." });
        const removals = pruneOldestArchivedReports(reports, reportsRetentionLimit);
        if (removals === null) return sendJson(response, 409, { ok: false, message: `Se alcanzó el límite de ${reportsRetentionLimit} informes activos. Archiva o elimina uno antes de generar otro.` });
        const report = buildReportSnapshot(payload, { id: crypto.randomUUID(), createdAt: new Date().toISOString(), createdBy: session.user.name || session.user.username });
        reports.push(report);
        persistReports();
        if (removals.length) {
            const removed = removals.map(item => item.before);
            audit(session, "retention_delete", "reporte", removed.map(item => item.id).join(","), removed, null, { limit: reportsRetentionLimit, count: removed.length });
        }
        audit(session, "create", "reporte", report.id, null, reportMetadata(report));
        return sendJson(response, 201, { ok: true, report: reportMetadata(report) });
    }

    async function handleReport(request, response, id, pdf) {
        const session = request.method === "GET" ? requireStaff(request, response) : requireAdministrator(request, response);
        if (!session) return;
        const report = reports.find((item) => item.id === id);
        if (!report) return sendJson(response, 404, { ok: false, message: "No se encontró el informe." });
        if (request.method === "PATCH") {
            const body = await readJsonBody(request);
            const action = String(body.action || "").trim().toLowerCase();
            const transition = validateReportTransition(report, action);
            if (transition.reason === "invalid_action") return sendJson(response, 400, { ok: false, message: "La acción debe ser archive o restore." });
            if (!transition.ok) return sendJson(response, 409, { ok: false, message: transition.reason === "already_archived" ? "El informe ya está archivado." : "El informe no está archivado." });
            const before = reportMetadata(report);
            if (action === "archive") {
                archiveReport(report, {
                    archivedAt: new Date().toISOString(),
                    archivedBy: session.user.name || session.user.username
                });
            } else {
                restoreReport(report);
            }
            persistReports();
            audit(session, action, "reporte", report.id, before, reportMetadata(report));
            return sendJson(response, 200, { ok: true, report: reportMetadata(report), message: action === "archive" ? "Informe archivado." : "Informe restaurado." });
        }
        if (request.method === "DELETE") {
            const body = await readJsonBody(request);
            if (body.confirm !== true) return sendJson(response, 400, { ok: false, message: "Confirma explícitamente la eliminación del informe." });
            const removal = removeReport(reports, report);
            if (!removal) return sendJson(response, 404, { ok: false, message: "No se encontró el informe." });
            persistReports();
            audit(session, "delete", "reporte", removal.removed.id, removal.before, null);
            return sendJson(response, 200, { ok: true, message: "Informe eliminado permanentemente." });
        }
        if (!pdf) return sendJson(response, 200, { ok: true, report: { ...report, status: reportStatus(report) } });
        const buffer = await createReportPdf(report);
        response.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="informe-${report.filters.ficha || 'general'}-${report.filters.from}-${id.slice(0, 8)}.pdf"`, "Cache-Control": "no-store", "Content-Length": buffer.length });
        response.end(buffer);
    }

    function backupData() {
        refreshUsersFromCsv();
        return {
            storage: { source: repository ? "mysql" : "legacy", charset: "utf8mb4", collation: "utf8mb4_unicode_ci", timezone: "UTC" },
            users: csvUsers,
            apprentices,
            managedUsers,
            attendance: attendanceRecords,
            programs: programRecords,
            training: trainingState,
            reports,
            audit: auditRecords,
            excuses
        };
    }

    function validateRestoredData(data) {
        const users = validateUsersCsvSource(serializeCsvUsers(data.users));
        const unique = (records, key, label) => {
            const values = new Set();
            for (const item of records) {
                const value = String(item?.[key] ?? "");
                if (!value || values.has(value)) throw Object.assign(new Error(`El respaldo contiene ${label} sin identificador o repetidos.`), { status: 400 });
                values.add(value);
            }
        };
        unique(data.programs, "id", "programas");
        unique(data.training.fichas, "id", "fichas");
        unique(data.training.ambientes, "id", "ambientes");
        unique(data.training.horarios, "id", "horarios");
        const programIds = new Set(data.programs.map(item => String(item.id)));
        const fichaIds = new Set(data.training.fichas.map(item => String(item.id)));
        const environmentIds = new Set(data.training.ambientes.map(item => String(item.id)));
        const fichaCodes = new Set(data.training.fichas.map(item => String(item.numero)));
        if (data.training.fichas.some(item => !programIds.has(String(item.programaId)))) throw Object.assign(new Error("El respaldo contiene fichas asociadas a programas inexistentes."), { status: 400 });
        if (data.training.horarios.some(item => !fichaIds.has(String(item.fichaId)) || !environmentIds.has(String(item.ambienteId)))) throw Object.assign(new Error("El respaldo contiene horarios asociados a fichas o ambientes inexistentes."), { status: 400 });
        if (users.some(item => canonicalRole(item.rol) === "Aprendiz" && item.ficha && !fichaCodes.has(String(item.ficha)))) throw Object.assign(new Error("El respaldo contiene aprendices asociados a fichas inexistentes."), { status: 400 });
        if (data.attendance.some(item => !/^\d{4}-\d{2}-\d{2}$/.test(String(item.fecha || "")) || !/^\d+$/.test(String(item.ficha || "")))) throw Object.assign(new Error("El respaldo contiene registros de asistencia inválidos."), { status: 400 });
        unique(data.excuses || [], "id", "excusas");
        if ((data.excuses || []).some((item) => !["pending", "approved", "rejected"].includes(item.status) || !item.support?.dataBase64 || !/^[a-f0-9]{64}$/.test(String(item.support.sha256 || "")))) throw Object.assign(new Error("El respaldo contiene excusas inválidas o sin soporte íntegro."), { status: 400 });
        return { ...data, users };
    }

    function replaceArray(target, values) {
        target.splice(0, target.length, ...JSON.parse(JSON.stringify(values)));
    }

    const jsonText = value => `${JSON.stringify(value, null, 2)}\n`;

    function restoredFileEntries() {
        const entries = [];
        if (csvFileBacked) entries.push({ file: usersCsvFile, content: serializeCsvUsers(csvUsers) });
        if (!options.apprentices) entries.push({ file: apprenticesFile, content: jsonText(apprentices) });
        if (!options.managedUsers && !options.apprentices) entries.push({ file: managedUsersFile, content: jsonText(managedUsers) });
        if (!options.attendanceRecords) entries.push({ file: attendanceFile, content: jsonText(attendanceRecords) });
        if (!options.programs && !options.sqlData) entries.push({ file: programsFile, content: jsonText(programRecords) });
        if (!(options.trainingState || (options.sqlData && !options.trainingFile) || !trainingFile)) entries.push({ file: trainingFile, content: jsonText(trainingState) });
        if (reportsFile) entries.push({ file: reportsFile, content: jsonText(reports) });
        if (auditFile) entries.push({ file: auditFile, content: jsonText(auditRecords) });
        if (excusesFile) entries.push({ file: excusesFile, content: jsonText(excuses) });
        return entries;
    }

    function applyRestoredData(data) {
        csvUsers = JSON.parse(JSON.stringify(data.users));
        replaceArray(apprentices, data.apprentices);
        const previousAccounts = new Map(managedUsers.map(item => [String(item.id || item.document || normalizeEmail(item.email)), item]));
        const restoredAccounts = data.managedUsers.map(item => {
            const { salt: _salt, passwordHash: _passwordHash, password: _password, ...profile } = item;
            const previous = previousAccounts.get(String(profile.id || profile.document || normalizeEmail(profile.email)));
            return previous?.salt && previous?.passwordHash ? { ...profile, salt: previous.salt, passwordHash: previous.passwordHash } : profile;
        });
        replaceArray(managedUsers, restoredAccounts);
        replaceArray(attendanceRecords, data.attendance);
        replaceArray(programRecords, data.programs);
        replaceArray(sqlData.fichas, data.training.fichas);
        replaceArray(sqlData.horarios, data.training.horarios);
        replaceArray(sqlData.ambientes, data.training.ambientes);
        for (const key of Object.keys(trainingState)) if (!["fichas", "horarios", "ambientes"].includes(key)) delete trainingState[key];
        for (const [key, value] of Object.entries(data.training)) if (!["fichas", "horarios", "ambientes"].includes(key)) trainingState[key] = JSON.parse(JSON.stringify(value));
        replaceArray(reports, data.reports);
        replaceArray(auditRecords, data.audit);
        replaceArray(excuses, data.excuses || []);
        accounts.splice(0, accounts.length, ...builtInAccounts, ...managedUsers);
    }

    function handleBackupExport(request, response) {
        const session = requireBackupAdministrator(request, response);
        if (!session) return;
        const backup = createBackup(backupData());
        const buffer = Buffer.from(`${JSON.stringify(backup, null, 2)}\n`, "utf8");
        const date = new Date().toISOString().slice(0, 10);
        audit(session, "export", "respaldo", date, null, { bytes: buffer.length });
        response.writeHead(200, {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="Respaldo_integral_SENA_${date}.json"`,
            "Content-Length": buffer.length,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff"
        });
        response.end(buffer);
    }

    async function handleBackupRestore(request, response) {
        const session = requireBackupAdministrator(request, response);
        if (!session) return;
        const restored = validateRestoredData(await readBackupFile(request));
        refreshUsersFromCsv();
        const previous = JSON.parse(JSON.stringify(backupData()));
        const automaticDirectory = options.backupDirectory || path.join(root, "respaldos", "restauraciones");
        const automaticName = `Pre_restauracion_${new Date().toISOString().replace(/[:.]/g, "-")}_${crypto.randomUUID().slice(0, 8)}.json`;
        const automaticFile = path.join(automaticDirectory, automaticName);
        const automaticBackup = createBackup(previous);
        writeFilesAtomically([{ file: automaticFile, content: jsonText(automaticBackup) }]);
        const automaticAudit = createAuditEntry(session, "create", "respaldo_automatico", automaticName, null, null, { file: automaticName, checksum: automaticBackup.checksum });
        try {
            applyRestoredData(restored);
            appendAuditEntry(automaticAudit);
            appendAuditEntry(createAuditEntry(session, "restore", "respaldo", new Date().toISOString(), null, null, {
                users: csvUsers.length, attendance: attendanceRecords.length, fichas: sqlData.fichas.length,
                schedules: sqlData.horarios.length, environments: sqlData.ambientes.length, reports: reports.length,
                automaticBackup: automaticName
            }));
            writeFilesAtomically(restoredFileEntries());
            if (csvFileBacked) csvSource = serializeCsvUsers(csvUsers);
        } catch (error) {
            applyRestoredData(previous);
            appendAuditEntry(automaticAudit);
            audit(session, "restore_failed", "respaldo", new Date().toISOString(), null, null, { automaticBackup: automaticName, error: error.message });
            throw Object.assign(new Error(`No se pudo restaurar el respaldo; se conservaron los datos anteriores. ${error.message}`), { status: error.status || 500 });
        }
        codes.clear();
        attendanceTokens.clear();
        for (const token of sessions.keys()) if (token !== session.token) sessions.delete(token);
        persistAuthState();
        return sendJson(response, 200, {
            ok: true,
            message: "Respaldo restaurado correctamente. Se creó una copia automática del estado anterior y la actualización se aplicó de forma integral.",
            automaticBackup: automaticName,
            summary: { users: csvUsers.length, attendance: attendanceRecords.length, programs: programRecords.length, fichas: sqlData.fichas.length, schedules: sqlData.horarios.length, environments: sqlData.ambientes.length, reports: reports.length }
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
            solicitarRecuperacion: handleAdminRecoveryRequest,
            completarRecuperacion: handleAdminRecoveryReset,
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
            importarSql: (request, response) => handleUserImport(request, response, true),
            exportarSql: handleSqlExport,
            actualizar: handleUserUpdate,
            eliminar: handleUserDelete
        },
        formacion: {
            consultarFormacion: handleTrainingData,
            listarFichas: handleTrainingData,
            crearFicha: handleFichaCreate,
            actualizarFicha: handleFichaUpdate,
            eliminarFicha: handleFichaDelete,
            listarHorarios: handleTrainingData,
            crearHorario: handleScheduleCreate,
            actualizarHorario: handleScheduleUpdate,
            eliminarHorario: handleScheduleDelete,
            listarAmbientes: handleTrainingData,
            crearAmbiente: handleEnvironmentCreate,
            actualizarAmbiente: handleEnvironmentUpdate,
            eliminarAmbiente: handleEnvironmentDelete,
            listarProgramas: handleProgramsData,
            crearPrograma: handleProgramCreate,
            actualizarPrograma: handleProgramUpdate,
            eliminarPrograma: handleProgramDelete,
            consultarAsistencia: handleAttendanceData,
            guardarAsistencia: handleAttendanceSave,
            cerrarAsistencia: handleAttendanceClose,
            reabrirAsistencia: handleAttendanceReopen,
            generarQr: handleAttendanceQr,
            registrarQr: handleAttendanceQrRegister,
            listarExcusas: handleExcusesList,
            crearExcusa: handleExcuseCreate,
            revisarExcusa: handleExcuseReview,
            consultarSoporteExcusa: handleExcuseSupport,
            consultarEstadisticas: handleStatistics,
            reportes: handleReports,
            consultarReporte: handleReport
        },
        sistema: { consultarEstado: handleSystemHealth, consultarAuditoria: handleAudit, consultarNotificaciones: handleNotifications, exportarRespaldo: handleBackupExport, restaurarRespaldo: handleBackupRestore }
    });

    const cloneSnapshot = (value) => JSON.parse(JSON.stringify(value));
    let mutationTail = Promise.resolve();

    function enqueuePersistedMutation(task) {
        const execution = mutationTail.then(task, task);
        mutationTail = execution.catch(() => {});
        return execution;
    }

    async function handleHttpRequest(request, response) {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, PATCH, DELETE, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        if (request.method === "OPTIONS") {
            response.writeHead(204);
            return response.end();
        }
        cleanExpired();
        try {
            const requestUrl = new URL(request.url, "http://localhost");
            const pathname = decodeURIComponent(requestUrl.pathname);
            if (pathname.startsWith("/api/")) refreshUsersFromCsv();
            if (await atenderApi({ request, response, requestUrl, pathname })) return;
            if (pathname.startsWith("/api/")) return sendJson(response, 404, { ok: false, message: "Ruta de API no encontrada." });
            return serveStatic(request, response, pathname);
        } catch (error) {
            console.error("Error de API:", error.message);
            return sendJson(response, error.status || 500, { ok: false, message: error.message || "Error interno del servidor." });
        }
    }

    const server = http.createServer(async (request, response) => {
        // Las lecturas permanecen concurrentes y pueden observar temporalmente una mutación aún no confirmada.
        const persistedMutation = repository
            && ["POST", "PATCH", "DELETE"].includes(request.method)
            && String(request.url || "").startsWith("/api/");
        if (!persistedMutation) return handleHttpRequest(request, response);
        return enqueuePersistedMutation(async () => {
            const previous = cloneSnapshot(backupData());
            const completed = deferResponseUntilMysqlCommit(response, previous);
            await handleHttpRequest(request, response);
            await completed;
        });
    });

    function deferResponseUntilMysqlCommit(response, previous) {
        const originalWriteHead = response.writeHead.bind(response);
        const originalEnd = response.end.bind(response);
        let statusCode = 200;
        let statusMessage;
        let headers;
        let ended = false;
        let resolveCompleted;
        const completed = new Promise((resolve) => { resolveCompleted = resolve; });
        response.writeHead = function deferredWriteHead(status, messageOrHeaders, possibleHeaders) {
            statusCode = status;
            if (typeof messageOrHeaders === "string") {
                statusMessage = messageOrHeaders;
                headers = possibleHeaders;
            } else headers = messageOrHeaders;
            response.statusCode = status;
            return response;
        };
        response.end = function deferredEnd(chunk, encoding, callback) {
            if (ended) return response;
            ended = true;
            const flush = (finalStatus = statusCode, finalHeaders = headers, finalChunk = chunk) => new Promise((resolve) => {
                const finish = () => {
                    response.off("finish", finish);
                    response.off("close", finish);
                    resolve();
                };
                response.once("finish", finish);
                response.once("close", finish);
                if (finalStatus === statusCode && statusMessage) originalWriteHead(finalStatus, statusMessage, finalHeaders);
                else originalWriteHead(finalStatus, finalHeaders);
                originalEnd(finalChunk, encoding, callback);
            });
            (async () => {
                if (statusCode < 200 || statusCode >= 400) {
                    applyRestoredData(previous);
                    await flush();
                    return;
                }
                try {
                    const next = cloneSnapshot(backupData());
                    await repository.saveSnapshot(next);
                    await flush();
                } catch (error) {
                    applyRestoredData(previous);
                    console.error("No se confirmó la operación en MySQL:", error.message);
                    for (const name of response.getHeaderNames()) response.removeHeader(name);
                    const body = JSON.stringify({ ok: false, message: "MySQL rechazó la operación; no se aplicaron cambios. Revisa la conexión y vuelve a intentar." });
                    await flush(503, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Length": Buffer.byteLength(body) }, body);
                }
            })().finally(resolveCompleted);
            return response;
        };
        return completed;
    }

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

    server.exportDatabaseSql = exportDatabaseSql;
    return server;
}

async function startApplication() {
    const databaseConfig = validateDatabaseEnv(process.env);
    let repository = null;
    let pool = null;
    let serverOptions = {};
    if (databaseConfig.source === "mysql") {
        pool = createDatabasePool(databaseConfig, { migrations: true });
        try {
            await checkDatabase(pool);
            await assertMigrationsCurrent(pool);
            repository = createMysqlRepository(pool);
            if (!(await repository.isActivated())) throw new Error("MySQL todavía no está validado como fuente definitiva. Ejecuta npm run db:cutover y completa la validación final antes de usar --activate.");
            const state = await repository.loadState();
            serverOptions = {
                repository,
                csvUsers: state.users,
                apprentices: state.apprentices,
                managedUsers: state.managedUsers,
                attendanceRecords: state.attendance,
                programs: state.programs,
                trainingState: state.training,
                reports: state.reports,
                reportsFile: null,
                auditRecords: state.audit,
                auditFile: null,
                excuses: state.excuses,
                excusesFile: null,
                authStateFile: null,
                emailHistoryFile: null
            };
        } catch (error) {
            await pool.end();
            throw new Error(`No se inició el sistema porque MySQL no está listo: ${error.message}`);
        }
    }
    const port = Number(process.env.PORT || 3000);
    const server = createProjectServer(serverOptions);
    let closing = false;
    const shutdown = async (signal) => {
        if (closing) return;
        closing = true;
        console.log(`${signal}: cerrando servidor y pool MySQL...`);
        await new Promise((resolve) => server.listening ? server.close(resolve) : resolve());
        if (pool) await pool.end();
    };
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => shutdown(signal).then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); }));
    server.listen(port, "0.0.0.0", () => {
        console.log(`Sistema SENA disponible en http://localhost:${port}/login.html`);
        console.log(`Escuchando en 0.0.0.0:${port}`);
        console.log(`Fuente de datos: ${databaseConfig.source === "mysql" ? `MySQL (${databaseConfig.database})` : "archivos legados; MySQL aún no es definitivo"}`);
        if (process.env.PUBLIC_URL?.trim()) console.log(`Acceso público: ${new URL("/login.html", process.env.PUBLIC_URL.trim()).href}`);
        else console.log("PUBLIC_URL no configurada: los QR usarán la dirección de acceso actual. Configúrala para compartirlos por Internet.");
        const gmailReady = normalizeEmail(process.env.GMAIL_USER) && String(process.env.GMAIL_APP_PASSWORD || "").replace(/\s/g, "");
        const resendReady = process.env.RESEND_API_KEY;
        if (!gmailReady && !resendReady) console.log("Aviso: configura Gmail o Resend en .env para habilitar los códigos por correo.");
    });
    return server;
}

if (require.main === module) {
    startApplication().catch((error) => {
        console.error(`ERROR DE ARRANQUE: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = { createProjectServer, loadCsvUsers, startApplication };
