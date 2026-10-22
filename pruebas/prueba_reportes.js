const assert = require("node:assert/strict");
const fs = require("fs");
const inspector = require("node:inspector");
const path = require("path");
const { PDFDocument } = require("../servidor/vendor/pdf-lib.min.js");
let createProjectServer;

async function startDomainFunctionCoverage(functionNames) {
    const session = new inspector.Session();
    session.connect();
    const post = (method, params = {}) => new Promise((resolve, reject) => {
        session.post(method, params, (error, result) => error ? reject(error) : resolve(result));
    });
    await post("Profiler.enable");
    await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
    return async function takeDomainFunctionCoverage() {
        try {
            const coverage = await post("Profiler.takePreciseCoverage");
            const reportDomain = coverage.result.find(item => String(item.url).replace(/\\/g, "/").endsWith("/servidor/dominio/reportes.js"));
            assert.ok(reportDomain, "No se encontró cobertura precisa de servidor/dominio/reportes.js.");
            const calls = Object.fromEntries(functionNames.map((name) => {
                const entry = reportDomain.functions.find(item => item.functionName === name);
                assert.ok(entry, `No se encontró la función ${name} en la cobertura precisa.`);
                return [name, entry.ranges[0].count];
            }));
            return calls;
        } finally {
            try { await post("Profiler.stopPreciseCoverage"); } catch (_) { /* sesión ya detenida */ }
            session.disconnect();
        }
    };
}

function storedReport(id, status, createdAt, archivedAt) {
    return {
        id,
        createdAt,
        createdBy: "Prueba retención",
        status,
        ...(archivedAt ? { archivedAt, archivedBy: "Administrador" } : {}),
        filters: { from: "2026-08-01", to: "2026-08-01", ficha: "3349882", jornada: "Mañana" },
        distribution: { total: 1, attendance: 100, counts: { presente: 1, tardanza: 0, ausente: 0, justificado: 0 }, percentages: { presente: 100, tardanza: 0, ausente: 0, justificado: 0 } },
        students: [{ identificacion: "100", nombre: "Aprendiz retención", ficha: "3349882", total: 1, attendance: 100, counts: { presente: 1, tardanza: 0, ausente: 0, justificado: 0 } }],
        records: [{ fecha: "2026-08-01", jornada: "Mañana", ficha: "3349882", identificacion: "100", nombre: "Aprendiz retención", estado: "presente", observacion: "" }],
        summary: {}, timeline: [], trend: [], composition: [], weeklyPerformance: [], topFichas: [], alerts: [], nextSessions: [],
        generatedAt: createdAt,
        usuario: { name: "Prueba retención", role: "Administrador" }
    };
}

async function createRetentionFixture(reports, reportsRetentionLimit) {
    const directory = fs.mkdtempSync(path.join(require("os").tmpdir(), "sena-retention-"));
    const reportsFile = path.join(directory, "reports.json");
    fs.writeFileSync(reportsFile, `${JSON.stringify(reports, null, 2)}\n`, "utf8");
    const auditRecords = [];
    const apprentice = { id: "retention-student", document: "100", name: "Aprendiz retención", email: "retention@example.com", role: "Aprendiz", status: "Activo", program: { ficha: "3349882", name: "Software", schedule: "Mañana" }, attendance: [] };
    const attendanceRecords = [{ identificacion: "100", nombre: apprentice.name, ficha: "3349882", fecha: "2026-08-01", jornada: "Mañana", estado: "presente", observacion: "", hora_registro: "2026-08-01T12:00:00.000Z" }];
    const server = createProjectServer({ adminPassword: "admin123", instructorPassword: "instructor123", apprentices: [apprentice], attendanceRecords, managedUsers: [], csvUsers: [], reportsFile, reportsRetentionLimit, auditRecords, auditFile: null, emailSender: async () => ({ id: "retention-test" }), sqlData: { ambientes: [], fichas: [], programas: [], horarios: [] } });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const login = await fetch(`${base}/api/auth/password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: "admin", password: "admin123" }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const request = (url, body, method = body ? "POST" : "GET") => fetch(base + url, { method, headers: { Cookie: cookie, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const close = async () => {
        await new Promise(resolve => server.close(resolve));
        if (path.dirname(path.resolve(directory)) !== path.resolve(require("os").tmpdir()) || !path.basename(directory).startsWith("sena-retention-")) throw new Error("Directorio temporal de retención inesperado");
        fs.rmSync(directory, { recursive: true, force: true });
    };
    return { reportsFile, auditRecords, request, close };
}

async function testRetentionBoundaryAndOrder(takeDomainFunctionCoverage) {
    const filters = { from: "2026-08-01", to: "2026-08-01", ficha: "3349882", jornada: "Mañana" };
    const blockedReports = [
        storedReport("archived-1", "archived", "2026-07-01T10:00:00.000Z", "2026-08-01T10:00:00.000Z"),
        storedReport("active-1", "active", "2026-07-02T10:00:00.000Z"),
        storedReport("archived-2", "archived", "2026-07-03T10:00:00.000Z", "2026-08-02T10:00:00.000Z"),
        storedReport("active-2", "active", "2026-07-04T10:00:00.000Z"),
        storedReport("active-3", "active", "2026-07-05T10:00:00.000Z"),
        storedReport("active-4", "active", "2026-07-06T10:00:00.000Z")
    ];
    const blocked = await createRetentionFixture(blockedReports, 4);
    const originalRename = fs.renameSync;
    let blockedPersistCalls = 0;
    try {
        const beforeList = await (await blocked.request("/api/reports")).json();
        const beforeFile = fs.readFileSync(blocked.reportsFile, "utf8");
        fs.renameSync = function observeBlockedPersistence(source, destination) {
            if (path.resolve(String(destination)) === path.resolve(blocked.reportsFile)) blockedPersistCalls += 1;
            return originalRename.call(fs, source, destination);
        };
        const response = await blocked.request("/api/reports", filters);
        const calls = await takeDomainFunctionCoverage();
        const body = await response.json();
        assert.equal(response.status, 409);
        assert.equal(body.message, "Se alcanzó el límite de 4 informes activos. Archiva o elimina uno antes de generar otro.");
        assert.equal(calls.pruneOldestArchivedReports, 1);
        assert.equal(calls.removeReport, 0);
        assert.equal(blockedPersistCalls, 0);
        assert.deepEqual(await (await blocked.request("/api/reports")).json(), beforeList);
        assert.equal(fs.readFileSync(blocked.reportsFile, "utf8"), beforeFile);
        assert.equal(blocked.auditRecords.some(item => item.entity === "reporte" && ["retention_delete", "create"].includes(item.action)), false);
    } finally {
        fs.renameSync = originalRename;
        await blocked.close();
    }

    const ordered = await createRetentionFixture([
        storedReport("archived-oldest", "archived", "2026-07-01T10:00:00.000Z", "2026-08-01T10:00:00.000Z"),
        storedReport("active-preserved", "active", "2026-07-02T10:00:00.000Z")
    ], 2);
    const effects = [];
    const originalAuditPush = ordered.auditRecords.push;
    try {
        fs.renameSync = function observeOrderedPersistence(source, destination) {
            if (path.resolve(String(destination)) === path.resolve(ordered.reportsFile)) effects.push("persistReports");
            return originalRename.call(fs, source, destination);
        };
        ordered.auditRecords.push = function observeReportAudit(...entries) {
            for (const entry of entries) if (entry.entity === "reporte" && ["retention_delete", "create"].includes(entry.action)) effects.push(entry.action);
            return originalAuditPush.apply(this, entries);
        };
        const response = await ordered.request("/api/reports", filters);
        assert.equal(response.status, 201);
        assert.deepEqual(effects, ["persistReports", "retention_delete", "create"]);
        const history = await (await ordered.request("/api/reports")).json();
        assert.equal(history.reports.length, 2);
        assert.equal(history.reports.some(item => item.id === "archived-oldest"), false);
        assert.equal(history.reports.some(item => item.id === "active-preserved"), true);
    } finally {
        fs.renameSync = originalRename;
        ordered.auditRecords.push = originalAuditPush;
        await ordered.close();
    }

    const legacyFailure = await createRetentionFixture([
        storedReport("archived-before-failure", "archived", "2026-07-01T10:00:00.000Z", "2026-08-01T10:00:00.000Z"),
        storedReport("active-before-failure", "active", "2026-07-02T10:00:00.000Z")
    ], 2);
    const legacyBeforeFile = fs.readFileSync(legacyFailure.reportsFile, "utf8");
    let legacyPersistCalls = 0;
    let legacyResponse;
    try {
        fs.renameSync = function failLegacyReportPersistence(source, destination) {
            if (path.resolve(String(destination)) === path.resolve(legacyFailure.reportsFile)) {
                legacyPersistCalls += 1;
                throw Object.assign(new Error("FALLO_LEGACY_SIMULADO"), { code: "EIO" });
            }
            return originalRename.call(fs, source, destination);
        };
        legacyResponse = await legacyFailure.request("/api/reports", filters);
    } finally {
        fs.renameSync = originalRename;
    }
    try {
        const legacyHistory = await (await legacyFailure.request("/api/reports")).json();
        const reportAudits = legacyFailure.auditRecords.filter(item => item.entity === "reporte" && ["retention_delete", "create"].includes(item.action));
        assert.equal(legacyPersistCalls, 1);
        assert.equal(legacyResponse.status, 500);
        assert.notEqual(legacyResponse.status, 201);
        assert.deepEqual(reportAudits, []);
        assert.equal(fs.readFileSync(legacyFailure.reportsFile, "utf8"), legacyBeforeFile);
        assert.equal(legacyHistory.reports.length, 2);
        assert.equal(legacyHistory.reports.some(item => item.id === "archived-before-failure"), false);
        assert.equal(legacyHistory.reports.some(item => item.id === "active-before-failure"), true);
        assert.equal(legacyHistory.reports.some(item => !["archived-before-failure", "active-before-failure"].includes(item.id)), true);
    } finally {
        await legacyFailure.close();
    }
    console.log("OK: frontera 3/2 con pruneOldestArchivedReports=1 y removeReport=0; fallo legacy temporal con HTTP 500, disco intacto, cero auditorías y memoria provisional.");
    console.log("OK: preflight sin mutación, persistencia única y orden persistReports → retention_delete → create validados.");
}

async function main() {
    const takeDomainFunctionCoverage = await startDomainFunctionCoverage(["pruneOldestArchivedReports", "removeReport"]);
    ({ createProjectServer } = require("../servidor/servidor"));
    await testRetentionBoundaryAndOrder(takeDomainFunctionCoverage);
    const directory = fs.mkdtempSync(path.join(require("os").tmpdir(), "sena-reports-"));
    const reportsFile = path.join(directory, "reports.json");
    const apprentices = Array.from({ length: 36 }, (_, i) => ({ id: `test-${i}`, document: String(123456780 + i), name: i === 0 ? "María José Muñoz Rodríguez con nombre largo de prueba" : `Aprendiz de prueba ${i}`, email: `test${i}@example.com`, role: "Aprendiz", status: "Activo", program: { ficha: i < 35 ? "3349882" : "3349883", name: "Desarrollo de software", schedule: "Mañana" }, attendance: [] }));
    const attendanceRecords = apprentices.flatMap((a, i) => ["2026-08-01", "2026-08-02"].map((fecha) => ({ identificacion: a.document, nombre: a.name, ficha: a.program.ficha, fecha, jornada: "Mañana", estado: ["presente", "tardanza", "ausente", "justificado"][i % 4], observacion: i === 0 ? "Observación de prueba con acentos: revisión académica. ".repeat(3) : "", hora_registro: `${fecha}T12:00:00Z` })));
    const auditRecords = [];
    const options = { adminPassword: "admin123", instructorPassword: "instructor123", apprentices, attendanceRecords, managedUsers: [], csvUsers: [], reportsFile, reportsRetentionLimit: 2, auditRecords, auditFile: null, exposeTestCode: true, emailSender: async () => ({ id: "qr-test" }), sqlData: { ambientes: [], fichas: [], programas: [], horarios: [] } };
    let server;
    let base;
    const start = async () => { server = createProjectServer(options); await new Promise((r) => server.listen(0, "127.0.0.1", r)); base = `http://127.0.0.1:${server.address().port}`; };
    const close = async () => { await new Promise((r) => server.close(r)); server = null; };
    const login = async (identifier, password) => { const r = await fetch(`${base}/api/auth/password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) }); assert.equal(r.status, 200); return r.headers.get("set-cookie").split(";")[0]; };
    let cookie;
    const request = async (url, body, session = cookie, method = body ? "POST" : "GET") => fetch(base + url, { method, headers: { Cookie: session || "", "Content-Type": "application/json" }, ...(body !== undefined && body !== null ? { body: JSON.stringify(body) } : {}) });
    try {
        await start(); cookie = await login("admin", "admin123");
        const qrPath = "/api/attendance/qr";
        const registerPath = qrPath + "/register";
        const qrInput = { ficha: "3349882", jornada: "Mañana" };
        assert.equal((await request(qrPath, qrInput, "")).status, 403);
        assert.equal((await request(qrPath, { ...qrInput, ficha: "999" })).status, 400);
        assert.equal((await request(qrPath, { ...qrInput, jornada: "Inválida" })).status, 400);
        const qr = await (await request(qrPath, qrInput)).json();
        const token = new URL(qr.url).searchParams.get("token");
        assert.match(token, /^[a-f0-9]{64}$/); assert.match(qr.image, /^data:image\/png;base64,/);
        assert(qr.remainingMs > 55000 && qr.remainingMs <= 60000);
        assert.equal((await request(registerPath, { token }, "")).status, 403);
        assert.equal((await request(registerPath, { token })).status, 403);
        const apprenticeLogin = async (a) => {
            const sent = await (await request("/api/auth/email/request", { document: a.document }, "")).json();
            const verified = await request("/api/auth/email/verify", { document: a.document, code: sent.testCode }, "");
            assert.equal(verified.status, 200);
            return verified.headers.get("set-cookie").split(";")[0];
        };
        const studentCookie = await apprenticeLogin(apprentices[0]);
        const otherCookie = await apprenticeLogin(apprentices[35]);
        assert.equal((await request(qrPath, qrInput, studentCookie)).status, 403);
        assert.equal((await request(registerPath, { token }, otherCookie)).status, 403);
        assert.equal((await request(registerPath, { token: "f".repeat(64) }, studentCookie)).status, 410);
        const simultaneous = await Promise.all([request(registerPath, { token }, studentCookie), request(registerPath, { token }, studentCookie)]);
        assert.deepEqual(simultaneous.map((r) => r.status).sort(), [201, 409]);
        const registered = await simultaneous.find((r) => r.status === 201).json();
        const savedAttendance = await (await request(`/api/attendance?ficha=3349882&fecha=${registered.registro.fecha}&jornada=${encodeURIComponent("Mañana")}`)).json();
        assert.equal(savedAttendance.aprendices.find((a) => a.identificacion === apprentices[0].document).observacion, "Registro por QR");
        const renewed = await (await request(qrPath, qrInput)).json();
        const renewedToken = new URL(renewed.url).searchParams.get("token");
        assert.notEqual(token, renewedToken);
        assert.equal((await request(registerPath, { token }, studentCookie)).status, 410);
        assert.equal((await request(registerPath, { token: renewedToken }, studentCookie)).status, 409);
        const realNow = Date.now;
        try {
            Date.now = () => renewed.expiresAt + 1;
            assert.equal((await request(registerPath, { token: renewedToken }, studentCookie)).status, 410);
        } finally { Date.now = realNow; }
        console.log("OK: QR, permisos, ficha, token desconocido, caducidad, renovación, duplicados concurrentes y asistencia existente.");
        const query = "/api/statistics?from=2026-08-01&to=2026-08-02&ficha=3349882";
        const data = await (await request(query)).json();
        assert.equal(data.distribution.total, 70); assert.equal(data.students.length, 35); assert.equal(data.timeline.length, 2);
        assert(data.records.every((r) => r.ficha === "3349882"));
        assert.equal(data.distribution.counts.presente, 18); assert.equal(data.summary.attendance, 25.7);
        assert.equal((await request("/api/statistics?from=2026-02-30&to=2026-03-05")).status, 400);
        assert.equal((await request("/api/statistics?from=2026-08-03&to=2026-08-01")).status, 400);
        assert.equal((await request(query + "&jornada=Inválida")).status, 400);
        assert.equal((await request("/api/reports", null, "")).status, 403);
        const filters = { from: "2026-08-01", to: "2026-08-02", ficha: "3349882", jornada: "Mañana" };
        assert.equal((await request("/api/reports", { ...filters, from: "2026-09-01", to: "2026-09-02" })).status, 400);
        assert.equal((await request("/api/reports", filters, "")).status, 403);
        const created = await request("/api/reports", filters); assert.equal(created.status, 201);
        const { report } = await created.json();
        const createdDetail = await (await request(`/api/reports/${report.id}`)).json();
        assert.equal(createdDetail.report.ok, true);
        assert.equal(createdDetail.report.id, report.id);
        assert.equal(createdDetail.report.createdAt, report.createdAt);
        assert.equal(createdDetail.report.createdBy, report.createdBy);
        assert.equal(createdDetail.report.status, "active");
        for (const key of ["usuario", "filters", "summary", "generatedAt", "distribution", "students", "records", "timeline", "trend", "composition", "weeklyPerformance", "topFichas", "alerts", "nextSessions"]) assert.equal(Object.hasOwn(createdDetail.report, key), true, `Falta el campo persistido ${key}`);
        const pdfResponse = await request(`/api/reports/${report.id}/pdf`); assert.equal(pdfResponse.status, 200); assert.equal(pdfResponse.headers.get("content-type"), "application/pdf");
        const bytes = Buffer.from(await pdfResponse.arrayBuffer()); assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
        const pdf = await PDFDocument.load(bytes); assert(pdf.getPageCount() >= 3);
        fs.writeFileSync(path.join(directory, "informe-prueba.pdf"), bytes);
        const updated = await request("/api/attendance", { ficha: "3349882", fecha: "2026-08-01", jornada: "Mañana", correctionReason: "Corrección posterior al corte del informe", aprendices: apprentices.slice(0, 35).map((a) => ({ identificacion: a.document, estado: "presente", observacion: "Actualizado después del informe" })) }); assert.equal(updated.status, 200);
        const refreshed = await (await request(query)).json(); assert.equal(refreshed.distribution.counts.presente, 44);
        const saved = await (await request(`/api/reports/${report.id}`)).json(); assert.equal(saved.report.distribution.counts.presente, 18);
        assert.equal((await request(`/api/reports/${report.id}/pdf`, null, "")).status, 403);
        assert.equal((await request("/api/reports/00000000-0000-0000-0000-000000000000")).status, 404);
        cookie = await login("instructor", "instructor123");
        assert.equal((await request(query)).status, 200);
        const instructorCreated = await (await request("/api/reports", filters)).json();
        assert.equal((await request(`/api/reports/${report.id}/pdf`)).status, 200);
        await close(); await start(); cookie = await login("admin", "admin123");
        let history = await (await request("/api/reports")).json(); assert.equal(history.reports.length, 2);
        assert.equal(history.permissions.manage, true); assert.equal(history.retention.limit, 2);
        assert.equal((await (await request(`/api/reports/${report.id}`)).json()).report.distribution.counts.presente, 18);
        assert.equal((await request(`/api/reports/${report.id}`, { action: "archive" }, cookie, "PATCH")).status, 200);
        assert.equal((await request(`/api/reports/${report.id}/pdf`)).status, 200);
        history = await (await request("/api/reports")).json(); assert.equal(history.reports.find((item) => item.id === report.id).status, "archived");
        const third = await request("/api/reports", filters); assert.equal(third.status, 201);
        assert.equal((await request(`/api/reports/${report.id}`)).status, 404);
        history = await (await request("/api/reports")).json(); assert.equal(history.reports.length, 2);
        cookie = await login("instructor", "instructor123");
        assert.equal((await request(`/api/reports/${instructorCreated.report.id}`, { action: "archive" }, cookie, "PATCH")).status, 403);
        cookie = await login("admin", "admin123");
        assert.equal((await request(`/api/reports/${instructorCreated.report.id}`, { action: "archive" }, cookie, "PATCH")).status, 200);
        assert.equal((await request(`/api/reports/${instructorCreated.report.id}`, { action: "restore" }, cookie, "PATCH")).status, 200);
        assert.equal((await request(`/api/reports/${instructorCreated.report.id}`, { confirm: false }, cookie, "DELETE")).status, 400);
        assert.equal((await request(`/api/reports/${instructorCreated.report.id}`, { confirm: true }, cookie, "DELETE")).status, 200);
        assert.equal((await request(`/api/reports/${instructorCreated.report.id}`)).status, 404);
        for (const action of ["create", "archive", "restore", "delete", "retention_delete"]) assert.ok(auditRecords.some((item) => item.entity === "reporte" && item.action === action), `Falta auditoría de reportes: ${action}`);
        console.log(`OK: filtros, acceso, corte inmutable, reinicio, PDF, archivado, restauración, eliminación confirmada, permisos, auditoría y retención (${pdf.getPageCount()} páginas).`);
    } finally { if (server) await close(); if (path.dirname(path.resolve(directory)) !== path.resolve(require("os").tmpdir()) || !path.basename(directory).startsWith("sena-reports-")) throw new Error("Directorio temporal inesperado"); fs.rmSync(directory, { recursive: true, force: true }); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
