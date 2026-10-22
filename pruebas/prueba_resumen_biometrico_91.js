/* BioSecure 9.1: resumen de enrolamientos sin revelar plantillas. */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const http = require("node:http");
const { createProjectServer } = require("../servidor/servidor");
const { crearAlmacenBiometricoReal } = require("../servidor/modulos/almacen_biometrico_real");

async function run(modo) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "biosecure91-resumen-"));
    const clave = crypto.randomBytes(32).toString("hex");
    const alumno = { id: "aprendiz-91", document: "100091", name: "Persona Test", email: "prueba91@example.com",
        role: "Aprendiz", status: "Activo", program: { ficha: "3349882", code: "3349882", name: "ADSO" }, attendance: [] };
    if (modo === "real") {
        crearAlmacenBiometricoReal({ directorio: dir, clave }).guardar(alumno.id, Buffer.from("PLANTILLA_PRIVADA_PRUEBA_9_1").toString("base64"));
    }
    const server = createProjectServer({
        adminPassword: "admin-local-91", instructorPassword: "instructor-local-91",
        apprentices: [alumno],
        csvUsers: [{ identificacion: alumno.document, tipo_documento: "CC", nombre: alumno.name, correo: alumno.email, rol: "Aprendiz", estado: "Activo", ficha: "3349882" }],
        managedUsers: [{ id: alumno.id, document: alumno.document, name: alumno.name, email: alumno.email, role: "Aprendiz", status: "Activo", ficha: "3349882" }],
        attendanceRecords: [], auditFile: null, emailSender: async () => ({ id: "prueba" }),
        publicUrl: "", allowedEmails: "", allowedDomain: "", sqlData: { ambientes: [], horarios: [], programas: [], fichas: [] },
        biometriaHabilitada: true, biometriaModo: modo, biometriaDirectorioReal: dir, biometriaClaveCifrado: clave,
        biometriaMockEstado: modo === "mock" ? { [alumno.id]: { estado: "simulado", fecha: "2026-10-21T00:00:00Z" } } : {}
    });
    await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const get = async (cookie, headers = {}) => {
        const res = await fetch(base + "/api/biometria/resumen", { headers: { ...(cookie ? { Cookie: cookie } : {}), ...headers } });
        return { status: res.status, data: await res.json() };
    };
    const login = async (id, password) => {
        const res = await fetch(base + "/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: id, password }) });
        assert.equal(res.status, 200);
        return res.headers.get("set-cookie").split(";")[0];
    };
    try {
        const anon = await get("");
        assert.equal(anon.status, 403, "Sólo administrador autenticado");
        const instructor = await login("instructor", "instructor-local-91");
        assert.equal((await get(instructor)).status, 403, "Instructores sin permisos de enrolamiento");
        const admin = await login("admin", "admin-local-91");
        const response = await get(admin);
        assert.equal(response.status, 200);
        assert.equal(response.data.modo, modo);
        assert.equal(response.data.registrados, 1);
        assert.equal(response.data.total_aprendices, 1);
        assert.equal(response.data.registros_reales, modo === "real");
        assert.doesNotMatch(JSON.stringify(response.data), /PLANTILLA_PRIVADA_PRUEBA|100091|Persona Test|prueba91@example/);
        // node:fetch controla Host; enviamos una solicitud HTTP sin normalización de esa cabecera.
        const noLocal = await new Promise((resolve, reject) => {
            const request = http.get(base + "/api/biometria/resumen", {
                headers: { Cookie: admin, Host: "mi-servidor-publico.example" }
            }, response => { response.resume(); response.on("end", () => resolve(response.statusCode)); });
            request.on("error", reject);
        });
        assert.equal(noLocal, 403, "El resumen se limita a localhost");
    } finally {
        await new Promise((ok) => server.close(ok));
        fs.rmSync(dir, { recursive: true, force: true });
    }
}
(async () => {
    await run("mock");
    await run("real");
    console.log("OK: resumen 9.1 para administrador, distinción real/mock, sin secretos y solo localhost.");
})().catch(error => { console.error(error); process.exitCode = 1; });
