const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createProjectServer } = require("../servidor/servidor");
const { loadCsvUsers, serializeCsvUsers } = require("../servidor/modulos/persistencia");

async function main() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sena-base-principal-"));
    const file = path.join(directory, "usuarios.csv");
    const first = { identificacion: "800000001", tipo_documento: "Cédula de Ciudadanía", nombre: "Usuario CSV",
        correo: "csv@example.com", rol: "aprendiz", estado: "activo", ficha: "123" };
    fs.writeFileSync(file, serializeCsvUsers([first]));
    const sent = [];
    const options = { usersCsvFile: file, apprentices: [], managedUsers: [], attendanceRecords: [],
        adminPassword: "prueba-base", exposeTestCode: true, publicUrl: "", allowedEmails: "", allowedDomain: "",
        emailSender: async message => { sent.push(message); return { id: "prueba" }; },
        sqlData: { ambientes: [], horarios: [], programas: [], fichas: [] } };
    let server;
    let base;
    let adminCookie;
    async function request(route, method = "GET", body, cookie = adminCookie) {
        const response = await fetch(base + route, { method,
            headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {}) });
        const data = await response.json();
        return { status: response.status, data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
    }
    async function start() {
        server = createProjectServer(options);
        await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
        base = `http://127.0.0.1:${server.address().port}`;
        const login = await request("/api/auth/password", "POST", { identifier: "admin", password: "prueba-base" }, "");
        assert.equal(login.status, 200);
        adminCookie = login.cookie;
    }
    try {
        await start();
        assert.ok((await request("/api/users")).data.users.some(user => user.document === first.identificacion));

        // Add an external row while Node is running, then log in with that row.
        const added = { ...first, identificacion: "800000002", correo: "nuevo@example.com", nombre: "Nuevo externo" };
        fs.writeFileSync(file, serializeCsvUsers([first, added]));
        let users = (await request("/api/users")).data.users;
        assert.ok(users.some(user => user.document === added.identificacion));
        const code = await request("/api/auth/email/request", "POST", { document: added.identificacion }, "");
        assert.equal(code.status, 200);
        assert.equal(sent.at(-1).to[0], added.correo);
        const login = await request("/api/auth/email/verify", "POST", { document: added.identificacion, code: code.data.testCode }, "");
        assert.equal(login.status, 200);
        assert.equal(login.data.user.role, "Aprendiz");

        // Disabling externally revokes an already authenticated session.
        added.estado = "inactivo";
        fs.writeFileSync(file, serializeCsvUsers([first, added]));
        const session = await request("/api/auth/session", "GET", undefined, login.cookie);
        assert.notEqual(session.data.authenticated, true);
        assert.equal((await request("/api/auth/email/request", "POST", { document: added.identificacion }, "")).status, 403);

        // External role/name/ficha changes override stored profile values.
        first.rol = "instructor";
        first.nombre = "Instructor editado";
        first.ficha = "456";
        fs.writeFileSync(file, serializeCsvUsers([first, added]));
        users = (await request("/api/users")).data.users;
        const changed = users.find(user => user.document === first.identificacion);
        assert.equal(changed.role, "Instructor");
        assert.equal(changed.name, first.nombre);
        assert.equal(changed.ficha, "456");

        // Saving via UI endpoints writes the very same file.
        const created = await request("/api/users", "POST", {
            identificacion: "800000003", tipo_documento: "Cédula de Ciudadanía", nombre: "Desde app",
            correo: "app@example.com", rol: "Instructor", estado: "Activo", ficha: "456"
        });
        assert.equal(created.status, 201, JSON.stringify(created.data));
        assert.ok(loadCsvUsers(file).some(row => row.identificacion === "800000003"));
        const id = created.data.user.id;
        assert.equal((await request(`/api/users/${id}`, "PATCH", { nombre: "Actualizado en app" })).status, 200);
        assert.equal(loadCsvUsers(file).find(row => row.identificacion === "800000003").nombre, "Actualizado en app");
        assert.equal((await request(`/api/users/${id}`, "DELETE")).status, 200);
        assert.ok(!loadCsvUsers(file).some(row => row.identificacion === "800000003"));

        // Removing a CSV row cannot resurrect a cached apprentice or account.
        fs.writeFileSync(file, serializeCsvUsers([first]));
        assert.ok(!(await request("/api/users")).data.users.some(user => user.document === added.identificacion));
        assert.equal((await request("/api/auth/email/request", "POST", { document: added.identificacion }, "")).status, 404);

        // Malformed/duplicate edits are rejected and never overwritten by a save.
        for (const invalid of ["nombre;correo\nMal;mal@example.com\n", serializeCsvUsers([first, first])]) {
            fs.writeFileSync(file, invalid);
            assert.equal((await request("/api/users")).status, 503);
            assert.equal((await request("/api/users", "POST", { nombre: "No guardar" })).status, 503);
            assert.equal(fs.readFileSync(file, "utf8"), invalid);
        }
        fs.writeFileSync(file, serializeCsvUsers([first]));
        assert.equal((await request("/api/users")).status, 200);

        // No stale fallback if the file disappears; restored file recovers live.
        fs.renameSync(file, file + ".backup");
        assert.equal((await request("/api/users")).status, 503);
        fs.renameSync(file + ".backup", file);
        assert.equal((await request("/api/users")).status, 200);
        await new Promise(resolve => server.close(resolve));
        await start();
        assert.equal((await request("/api/users")).data.users.find(user => user.document === first.identificacion).name, first.nombre);
        console.log("OK: CSV principal, altas externas sin reinicio, acceso, bajas, sesiones, roles, guardado, validación y reinicio.");
    } finally {
        if (server?.listening) await new Promise(resolve => server.close(resolve));
        fs.rmSync(directory, { recursive: true, force: true });
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
