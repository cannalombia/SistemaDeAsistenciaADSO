const assert = require("node:assert/strict");
const { createProjectServer } = require("../servidor/servidor");

const apprentice = { id: "aprendiz-9001", document: "9001", name: "Aprendiz Excusa", email: "aprendiz.excusa@sena.edu.co", role: "Aprendiz", status: "Activo", program: { code: "3349881", ficha: "3349881", name: "ADSO", schedule: "Mañana", mode: "Presencial", status: "En formación" }, attendance: [] };
const csvUsers = [{ identificacion: "9001", tipo_documento: "CC", nombre: apprentice.name, correo: apprentice.email, rol: "Aprendiz", estado: "Activo", ficha: "3349881" }];
const attendanceRecords = [];
const trainingState = { fichas: [{ id: 1, numero: 3349881, jornada: "Mañana", modalidad: "Presencial", estado: "Activa", programaId: 1, instructorId: 1 }], horarios: [], ambientes: [], attendanceClosures: [] };

async function json(base, path, method = "GET", body, cookie = "") {
    const response = await fetch(base + path, { method, headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { response, data: await response.json().catch(() => ({})) };
}

(async () => {
    const server = createProjectServer({
        apprentices: [apprentice], csvUsers, managedUsers: [], attendanceRecords, programs: [{ id: 1, nombre: "ADSO", nivel: "Tecnólogo", duracion: "24 meses", estado: "Activo" }], trainingState,
        reports: [], reportsFile: null, auditRecords: [], auditFile: null, excuses: [], excusesFile: null,
        adminPassword: "admin-test-password", exposeTestCode: true, emailSender: async () => ({ id: "test" }), publicUrl: "", allowedDomain: "", allowedEmails: ""
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        let result = await json(base, "/api/auth/password", "POST", { identifier: "admin", password: "admin-test-password" });
        assert.equal(result.response.status, 200);
        const adminCookie = result.response.headers.get("set-cookie").split(";")[0];
        const selection = { ficha: "3349881", fecha: "2026-09-30", jornada: "Mañana" };
        const roster = (estado) => ({ ...selection, aprendices: [{ identificacion: "9001", estado, observacion: estado === "ausente" ? "Ausencia inicial" : "Corrección" }] });

        assert.equal((await json(base, "/api/attendance", "POST", roster("ausente"), adminCookie)).response.status, 200);
        assert.equal((await json(base, "/api/attendance", "POST", roster("presente"), adminCookie)).response.status, 400);
        assert.equal((await json(base, "/api/attendance", "POST", { ...roster("presente"), correctionReason: "Corrección verificada por el instructor" }, adminCookie)).response.status, 200);
        assert.equal((await json(base, "/api/attendance", "POST", { ...roster("ausente"), correctionReason: "Se restablece ausencia para probar excusa" }, adminCookie)).response.status, 200);

        assert.equal((await json(base, "/api/attendance/close", "POST", { ...selection, reason: "Jornada revisada y cerrada formalmente" }, adminCookie)).response.status, 200);
        assert.equal((await json(base, "/api/attendance", "POST", { ...roster("presente"), correctionReason: "Intento sobre jornada cerrada" }, adminCookie)).response.status, 423);
        assert.equal((await json(base, "/api/attendance/reopen", "POST", { ...selection, reason: "Reapertura autorizada para revisar excusa" }, adminCookie)).response.status, 200);

        result = await json(base, "/api/auth/email/request", "POST", { document: "9001" });
        assert.equal(result.response.status, 200);
        result = await json(base, "/api/auth/email/verify", "POST", { document: "9001", code: result.data.testCode });
        assert.equal(result.response.status, 200);
        const apprenticeCookie = result.response.headers.get("set-cookie").split(";")[0];
        const form = new FormData();
        form.append("fecha", selection.fecha); form.append("ficha", selection.ficha); form.append("motivo", "Incapacidad médica con soporte verificable");
        form.append("SOPORTE", new Blob([Buffer.from("%PDF-1.4\n%%EOF\n")], { type: "application/pdf" }), "incapacidad.pdf");
        let response = await fetch(base + "/api/excuses", { method: "POST", headers: { Cookie: apprenticeCookie }, body: form });
        const created = await response.json();
        assert.equal(response.status, 201);
        assert.equal(created.excuse.status, "pending");
        assert.equal("dataBase64" in created.excuse.support, false);

        result = await json(base, "/api/excuses?status=pending", "GET", undefined, adminCookie);
        assert.equal(result.data.excuses.length, 1);
        response = await fetch(`${base}/api/excuses/${created.excuse.id}/support`, { headers: { Cookie: adminCookie } });
        assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), "application/pdf");
        result = await json(base, `/api/excuses/${created.excuse.id}`, "PATCH", { decision: "approved", comment: "Soporte médico verificado" }, adminCookie);
        assert.equal(result.response.status, 200);
        result = await json(base, `/api/attendance?ficha=3349881&fecha=${selection.fecha}&jornada=Ma%C3%B1ana`, "GET", undefined, adminCookie);
        assert.equal(result.data.aprendices[0].estado, "justificado");
        result = await json(base, "/api/audit?limit=100", "GET", undefined, adminCookie);
        for (const action of ["correct", "close", "reopen", "submit", "approve", "justify"]) assert.ok(result.data.entries.some((item) => item.action === action), `Falta auditoría ${action}`);
        console.log("OK: corrección motivada, cierre/reapertura, soporte de excusa, aprobación y justificación auditadas.");
    } finally { await new Promise((resolve) => server.close(resolve)); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
