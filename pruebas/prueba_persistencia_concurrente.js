const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const envFile = path.resolve(__dirname, "..", ".env");
const originalExistsSync = fs.existsSync;
fs.existsSync = function existsWithoutOperationalEnv(file) {
    return path.resolve(String(file)) === envFile ? false : originalExistsSync.call(fs, file);
};
let createProjectServer;
try {
    ({ createProjectServer } = require("../servidor/servidor"));
} finally {
    fs.existsSync = originalExistsSync;
}

const REPORT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REPORT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const clone = value => JSON.parse(JSON.stringify(value));
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function report(id, ficha) {
    return {
        id,
        createdAt: "2026-08-03T12:00:00.000Z",
        createdBy: "Prueba concurrente",
        status: "active",
        filters: { from: "2026-08-01", to: "2026-08-02", ficha, jornada: "Mañana" },
        distribution: {
            total: 1,
            attendance: 100,
            counts: { presente: 1, tardanza: 0, ausente: 0, justificado: 0 },
            percentages: { presente: 100, tardanza: 0, ausente: 0, justificado: 0 }
        },
        students: [{ identificacion: ficha, nombre: `Aprendiz ${ficha}`, ficha, total: 1, attendance: 100, counts: { presente: 1, tardanza: 0, ausente: 0, justificado: 0 } }],
        records: [{ fecha: "2026-08-01", jornada: "Mañana", ficha, identificacion: ficha, nombre: `Aprendiz ${ficha}`, estado: "presente", observacion: "" }],
        summary: {}, timeline: [], trend: [], composition: [], weeklyPerformance: [], topFichas: [], alerts: [], nextSessions: [],
        generatedAt: "2026-08-03T12:00:00.000Z",
        usuario: { name: "Prueba concurrente", role: "Administrador" }
    };
}

function auditEntry(id, entityId) {
    return {
        id,
        timestamp: "2026-08-03T12:00:00.000Z",
        actor: { id: "system", name: "Sistema", email: "", role: "Sistema" },
        action: "create",
        entity: "reporte",
        entityId,
        before: null,
        after: { id: entityId },
        details: {}
    };
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((success, failure) => { resolve = success; reject = failure; });
    return { promise, resolve, reject };
}

function controlledRepository() {
    const calls = [];
    let controlled = false;
    return {
        calls,
        enableControl() { controlled = true; },
        async saveSnapshot(snapshot) {
            if (!controlled) return;
            const gate = deferred();
            calls.push({ snapshot, initial: clone(snapshot), gate, outcome: "pending" });
            return gate.promise;
        },
        resolve(index) {
            calls[index].outcome = "resolved";
            calls[index].gate.resolve();
        },
        reject(index, message) {
            calls[index].outcome = "rejected";
            calls[index].gate.reject(new Error(message));
        }
    };
}

async function waitFor(predicate, message) {
    const limit = Date.now() + 3000;
    while (!predicate()) {
        if (Date.now() >= limit) throw new Error(message);
        await delay(5);
    }
}

async function createFixture(reportsInput = [report(REPORT_A, "A"), report(REPORT_B, "B")], fixtureOptions = {}) {
    const auditRecords = reportsInput.map((item, index) => auditEntry(`audit-${index}-base`, item.id));
    const repository = controlledRepository();
    let internalReports = null;
    const reportIds = new Set(reportsInput.map(item => item.id));
    const originalParse = JSON.parse;
    JSON.parse = function captureInternalReports(source, reviver) {
        const value = originalParse(source, reviver);
        if (Array.isArray(value) && value.length === reportIds.size && value.every(item => reportIds.has(item?.id))) internalReports = value;
        return value;
    };
    let server;
    try {
        server = createProjectServer({
            repository,
            adminPassword: "admin123",
            instructorPassword: "instructor123",
            apprentices: fixtureOptions.apprentices || [],
            attendanceRecords: fixtureOptions.attendanceRecords || [],
            managedUsers: [],
            csvUsers: [],
            programs: [],
            trainingState: { fichas: [], horarios: [], ambientes: [], attendanceClosures: [] },
            reports: reportsInput,
            reportsFile: null,
            reportsRetentionLimit: fixtureOptions.reportsRetentionLimit || 10,
            auditRecords,
            auditFile: null,
            excuses: [],
            excusesFile: null,
            authStateFile: null,
            emailHistoryFile: null,
            emailSender: async () => ({ id: "concurrency-test" })
        });
    } finally {
        JSON.parse = originalParse;
    }
    assert.ok(internalReports, "No se capturó la referencia interna de reports para la prueba de identidad.");
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const login = await fetch(`${base}/api/auth/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: "admin", password: "admin123" })
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    repository.enableControl();
    const request = (url, body, method = "PATCH") => fetch(base + url, {
        method,
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const list = async () => (await (await fetch(`${base}/api/reports`, { headers: { Cookie: cookie } })).json()).reports;
    const close = () => new Promise(resolve => server.close(resolve));
    return { server, repository, auditRecords, internalReports, request, list, close };
}

function statuses(reports) {
    return Object.fromEntries(reports.map(item => [item.id, item.status]));
}

function reportAudit(auditRecords) {
    return auditRecords.filter(item => item.entity === "reporte").map(item => ({ action: item.action, entityId: item.entityId }));
}

function assertDetachedAndStable(call, fixture) {
    assert.notEqual(call.snapshot.reports, fixture.internalReports, "saveSnapshot recibió la referencia viva de reports.");
    assert.notEqual(call.snapshot.audit, fixture.auditRecords, "saveSnapshot recibió la referencia viva de auditRecords.");
    assert.deepEqual(call.snapshot, call.initial, "El snapshot cambió mientras saveSnapshot estaba pendiente.");
}

async function caseAConfirmsBFails() {
    const fixture = await createFixture();
    try {
        const requestA = fixture.request(`/api/reports/${REPORT_A}`, { action: "archive" });
        await waitFor(() => fixture.repository.calls.length === 1, "A no llegó a saveSnapshot.");
        const requestB = fixture.request(`/api/reports/${REPORT_B}`, { action: "archive" });
        await delay(50);
        assert.equal(fixture.repository.calls.length, 1, "B ejecutó su handler mientras A seguía pendiente.");
        assert.equal(reportAudit(fixture.auditRecords).filter(item => item.action === "archive" && item.entityId === REPORT_B).length, 0);
        assertDetachedAndStable(fixture.repository.calls[0], fixture);

        fixture.repository.resolve(0);
        const responseA = await requestA;
        await waitFor(() => fixture.repository.calls.length === 2, "B no continuó después de confirmar A.");
        assertDetachedAndStable(fixture.repository.calls[0], fixture);
        assertDetachedAndStable(fixture.repository.calls[1], fixture);
        fixture.repository.reject(1, "FALLO_B_SIMULADO");
        const responseB = await requestB;
        const finalReports = await fixture.list();
        const finalStatus = statuses(finalReports);

        assert.equal(responseA.status, 200);
        assert.equal(responseB.status, 503);
        assert.equal(fixture.repository.calls[0].outcome, "resolved");
        assert.equal(finalStatus[REPORT_A], "archived");
        assert.equal(finalStatus[REPORT_B], "active");
        assert.deepEqual(reportAudit(fixture.auditRecords).filter(item => item.action === "archive"), [{ action: "archive", entityId: REPORT_A }]);
        assertDetachedAndStable(fixture.repository.calls[0], fixture);
        assertDetachedAndStable(fixture.repository.calls[1], fixture);
        return { responseA: responseA.status, responseB: responseB.status, finalStatus };
    } finally {
        await fixture.close();
    }
}

async function caseAFailsBConfirms() {
    const fixture = await createFixture();
    try {
        const requestA = fixture.request(`/api/reports/${REPORT_A}`, { action: "archive" });
        await waitFor(() => fixture.repository.calls.length === 1, "A no llegó a saveSnapshot.");
        const requestB = fixture.request(`/api/reports/${REPORT_B}`, { action: "archive" });
        await delay(50);
        assert.equal(fixture.repository.calls.length, 1, "B ejecutó su handler mientras A seguía pendiente.");
        assertDetachedAndStable(fixture.repository.calls[0], fixture);

        fixture.repository.reject(0, "FALLO_A_SIMULADO");
        const responseA = await requestA;
        await waitFor(() => fixture.repository.calls.length === 2, "B no continuó después del rollback de A.");
        assertDetachedAndStable(fixture.repository.calls[0], fixture);
        assertDetachedAndStable(fixture.repository.calls[1], fixture);
        fixture.repository.resolve(1);
        const responseB = await requestB;
        const finalReports = await fixture.list();
        const finalStatus = statuses(finalReports);

        assert.equal(responseA.status, 503);
        assert.equal(responseB.status, 200);
        assert.equal(fixture.repository.calls[1].outcome, "resolved");
        assert.equal(finalStatus[REPORT_A], "active");
        assert.equal(finalStatus[REPORT_B], "archived");
        assert.deepEqual(reportAudit(fixture.auditRecords).filter(item => item.action === "archive"), [{ action: "archive", entityId: REPORT_B }]);
        assertDetachedAndStable(fixture.repository.calls[0], fixture);
        assertDetachedAndStable(fixture.repository.calls[1], fixture);
        return { responseA: responseA.status, responseB: responseB.status, finalStatus };
    } finally {
        await fixture.close();
    }
}

async function errorsDoNotPoisonQueue() {
    const fixture = await createFixture();
    try {
        const invalid = await fixture.request(`/api/reports/${REPORT_A}`, { action: "invalid" });
        assert.equal(invalid.status, 400);
        assert.equal(fixture.repository.calls.length, 0, "Una respuesta 4xx intentó persistirse.");

        const firstValid = fixture.request(`/api/reports/${REPORT_A}`, { action: "archive" });
        await waitFor(() => fixture.repository.calls.length === 1, "La operación válida no continuó después del 4xx.");
        fixture.repository.reject(0, "FALLO_CONTROLADO");
        assert.equal((await firstValid).status, 503);

        const secondValid = fixture.request(`/api/reports/${REPORT_B}`, { action: "archive" });
        await waitFor(() => fixture.repository.calls.length === 2, "La operación válida no continuó después del rechazo.");
        fixture.repository.resolve(1);
        assert.equal((await secondValid).status, 200);
        const finalStatus = statuses(await fixture.list());
        assert.equal(finalStatus[REPORT_A], "active");
        assert.equal(finalStatus[REPORT_B], "archived");
        assertDetachedAndStable(fixture.repository.calls[0], fixture);
        assertDetachedAndStable(fixture.repository.calls[1], fixture);
        return { invalid: invalid.status, rejected: 503, following: 200, finalStatus };
    } finally {
        await fixture.close();
    }
}

async function concurrentDeletesOfDifferentReports() {
    const fixture = await createFixture();
    try {
        const deleteA = fixture.request(`/api/reports/${REPORT_A}`, { confirm: true }, "DELETE");
        await waitFor(() => fixture.repository.calls.length === 1, "DELETE A no llegó a saveSnapshot.");
        const deleteB = fixture.request(`/api/reports/${REPORT_B}`, { confirm: true }, "DELETE");
        await delay(50);
        assert.equal(fixture.repository.calls.length, 1, "DELETE B se ejecutó mientras DELETE A seguía pendiente.");
        assert.deepEqual(reportAudit(fixture.auditRecords).filter(item => item.action === "delete"), [{ action: "delete", entityId: REPORT_A }]);

        fixture.repository.resolve(0);
        const responseA = await deleteA;
        await waitFor(() => fixture.repository.calls.length === 2, "DELETE B no continuó después de confirmar DELETE A.");
        fixture.repository.resolve(1);
        const responseB = await deleteB;
        const finalReports = await fixture.list();

        assert.equal(responseA.status, 200);
        assert.equal(responseB.status, 200);
        assert.deepEqual(finalReports, []);
        assert.deepEqual(reportAudit(fixture.auditRecords).filter(item => item.action === "delete"), [
            { action: "delete", entityId: REPORT_A },
            { action: "delete", entityId: REPORT_B }
        ]);
        assertDetachedAndStable(fixture.repository.calls[0], fixture);
        assertDetachedAndStable(fixture.repository.calls[1], fixture);
        return { first: responseA.status, second: responseB.status, audits: 2, remaining: finalReports.length };
    } finally {
        await fixture.close();
    }
}

async function concurrentDeletesOfSameReport() {
    const fixture = await createFixture([report(REPORT_A, "A")]);
    try {
        const firstDelete = fixture.request(`/api/reports/${REPORT_A}`, { confirm: true }, "DELETE");
        await waitFor(() => fixture.repository.calls.length === 1, "El primer DELETE no llegó a saveSnapshot.");
        const secondDelete = fixture.request(`/api/reports/${REPORT_A}`, { confirm: true }, "DELETE");
        await delay(50);
        assert.equal(fixture.repository.calls.length, 1, "El segundo DELETE comenzó antes de confirmarse el primero.");

        fixture.repository.resolve(0);
        const firstResponse = await firstDelete;
        const secondResponse = await secondDelete;
        const secondBody = await secondResponse.json();
        const finalReports = await fixture.list();
        const deleteAudits = reportAudit(fixture.auditRecords).filter(item => item.action === "delete");

        assert.equal(firstResponse.status, 200);
        assert.equal(secondResponse.status, 404);
        assert.equal(secondBody.message, "No se encontró el informe.");
        assert.equal(fixture.repository.calls.length, 1, "El 404 del segundo DELETE intentó persistir otro snapshot.");
        assert.deepEqual(deleteAudits, [{ action: "delete", entityId: REPORT_A }]);
        assert.deepEqual(finalReports, []);
        assertDetachedAndStable(fixture.repository.calls[0], fixture);
        return { first: firstResponse.status, second: secondResponse.status, audits: deleteAudits.length, remaining: finalReports.length };
    } finally {
        await fixture.close();
    }
}

function archivedReport(id, ficha, archivedAt) {
    return { ...report(id, ficha), status: "archived", archivedAt, archivedBy: "Administrador" };
}

function retentionFixtureOptions() {
    const apprentice = { id: "retention-student", document: "100", name: "Aprendiz retención", email: "retention@example.com", role: "Aprendiz", status: "Activo", program: { ficha: "3349882", name: "Software", schedule: "Mañana" }, attendance: [] };
    return {
        apprentices: [apprentice],
        attendanceRecords: [{ identificacion: apprentice.document, nombre: apprentice.name, ficha: "3349882", fecha: "2026-08-01", jornada: "Mañana", estado: "presente", observacion: "", hora_registro: "2026-08-01T12:00:00.000Z" }],
        reportsRetentionLimit: 2
    };
}

async function concurrentReportCreationsApplyRetentionInOrder() {
    const fixture = await createFixture([
        archivedReport(REPORT_A, "A", "2026-08-01T10:00:00.000Z"),
        archivedReport(REPORT_B, "B", "2026-08-02T10:00:00.000Z")
    ], retentionFixtureOptions());
    const filters = { from: "2026-08-01", to: "2026-08-01", ficha: "3349882", jornada: "Mañana" };
    try {
        const firstCreation = fixture.request("/api/reports", filters, "POST");
        await waitFor(() => fixture.repository.calls.length === 1, "La primera creación no llegó a saveSnapshot.");
        const secondCreation = fixture.request("/api/reports", filters, "POST");
        await delay(50);
        assert.equal(fixture.repository.calls.length, 1, "La segunda creación ejecutó retención mientras la primera seguía pendiente.");

        fixture.repository.resolve(0);
        const firstResponse = await firstCreation;
        const firstBody = await firstResponse.json();
        await waitFor(() => fixture.repository.calls.length === 2, "La segunda creación no continuó después de confirmar la primera.");
        fixture.repository.resolve(1);
        const secondResponse = await secondCreation;
        const secondBody = await secondResponse.json();
        const finalReports = await fixture.list();
        const retentionAudits = reportAudit(fixture.auditRecords).filter(item => item.action === "retention_delete");

        assert.equal(firstResponse.status, 201);
        assert.equal(secondResponse.status, 201);
        assert.deepEqual(retentionAudits, [
            { action: "retention_delete", entityId: REPORT_A },
            { action: "retention_delete", entityId: REPORT_B }
        ]);
        assert.deepEqual(new Set(finalReports.map(item => item.id)), new Set([firstBody.report.id, secondBody.report.id]));
        assert(finalReports.every(item => item.status === "active"));
        assert(fixture.auditRecords.some(item => item.action === "create" && item.entityId === firstBody.report.id));
        assert(fixture.auditRecords.some(item => item.action === "create" && item.entityId === secondBody.report.id));
        assertDetachedAndStable(fixture.repository.calls[0], fixture);
        assertDetachedAndStable(fixture.repository.calls[1], fixture);
        return { first: firstResponse.status, second: secondResponse.status, retentionIds: retentionAudits.map(item => item.entityId), remaining: finalReports.length };
    } finally {
        await fixture.close();
    }
}

async function mysqlRollbackRestoresRetentionMutation() {
    const fixture = await createFixture([
        archivedReport(REPORT_A, "A", "2026-08-01T10:00:00.000Z"),
        report(REPORT_B, "B")
    ], retentionFixtureOptions());
    const filters = { from: "2026-08-01", to: "2026-08-01", ficha: "3349882", jornada: "Mañana" };
    const initialAudit = clone(reportAudit(fixture.auditRecords));
    try {
        const rejectedCreation = fixture.request("/api/reports", filters, "POST");
        await waitFor(() => fixture.repository.calls.length === 1, "La creación con retención no llegó a saveSnapshot.");
        fixture.repository.reject(0, "FALLO_RETENCION_SIMULADO");
        const rejectedResponse = await rejectedCreation;
        const restoredReports = await fixture.list();

        assert.equal(rejectedResponse.status, 503);
        assert.deepEqual(statuses(restoredReports), { [REPORT_B]: "active", [REPORT_A]: "archived" });
        assert.deepEqual(reportAudit(fixture.auditRecords), initialAudit);
        assertDetachedAndStable(fixture.repository.calls[0], fixture);

        const followingCreation = fixture.request("/api/reports", filters, "POST");
        await waitFor(() => fixture.repository.calls.length === 2, "La cola no continuó después del rollback de retención.");
        fixture.repository.resolve(1);
        assert.equal((await followingCreation).status, 201);
        return { rejected: rejectedResponse.status, following: 201, restoredStatus: statuses(restoredReports) };
    } finally {
        await fixture.close();
    }
}

async function qrGenerationDoesNotWaitForMysqlSnapshot() {
    const fixture = await createFixture([], {
        apprentices: [{
            id: "qr-student",
            document: "100200300",
            name: "Aprendiz QR",
            email: "qr@example.com",
            role: "Aprendiz",
            status: "Activo",
            program: { ficha: "3349882", name: "Software", schedule: "Mañana" },
            attendance: []
        }]
    });
    try {
        const responsePromise = fixture.request("/api/attendance/qr", { ficha: "3349882", jornada: "Mañana" }, "POST");
        await delay(75);
        if (fixture.repository.calls.length) fixture.repository.resolve(0);
        const response = await responsePromise;
        const body = await response.json();

        assert.equal(response.status, 201);
        assert.equal(fixture.repository.calls.length, 0, "La generación temporal del QR intentó guardar un snapshot en MySQL.");
        assert.match(body.image, /^data:image\/png;base64,/);
        assert.match(body.url, /[?&]token=[a-f0-9]{64}$/);
        assert(body.remainingMs > 0 && body.remainingMs <= 60000);
        return { status: response.status, mysqlSnapshots: fixture.repository.calls.length, remainingMs: body.remainingMs };
    } finally {
        await fixture.close();
    }
}

async function main() {
    const case1 = await caseAConfirmsBFails();
    const case2 = await caseAFailsBConfirms();
    const recovery = await errorsDoNotPoisonQueue();
    const differentDeletes = await concurrentDeletesOfDifferentReports();
    const sameDelete = await concurrentDeletesOfSameReport();
    const concurrentRetention = await concurrentReportCreationsApplyRetentionInOrder();
    const retentionRollback = await mysqlRollbackRestoresRetentionMutation();
    const qrGeneration = await qrGenerationDoesNotWaitForMysqlSnapshot();
    console.log("OK: mutaciones serializadas, snapshots independientes, DELETE concurrente, retención concurrente, rollback MySQL y QR temporal seguros.");
    console.log(JSON.stringify({ case1, case2, recovery, differentDeletes, sameDelete, concurrentRetention, retentionRollback, qrGeneration, mysqlOperationalUsed: false, realFilesWritten: false }));
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
