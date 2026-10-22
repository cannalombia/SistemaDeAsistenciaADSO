const assert = require("node:assert/strict");
const os = require("node:os");
const { createProjectServer } = require("../servidor/servidor");

async function main() {
    const previous = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = "https://prueba-publica.lhr.life/";
    const options = {
        adminPassword: "prueba-publica",
        apprentices: [{ id: "prueba", document: "123456", name: "Prueba", email: "prueba@example.com", status: "Activo", program: { ficha: "123" }, attendance: [] }], attendanceRecords: [], managedUsers: [],
        emailSender: async () => ({ id: "prueba" }),
        sqlData: { ambientes: [], horarios: [], programas: [], fichas: [
            { numero: 123, jornada: "Mañana", estado: "Activa" }
        ] }
    };
    try {
        assert.throws(() => createProjectServer({ ...options, publicUrl: "javascript:alert(1)" }), /PUBLIC_URL/);
        assert.throws(() => createProjectServer({ ...options, publicUrl: "https://example.com/login.html" }), /PUBLIC_URL/);
        for (const configured of [true, false]) {
            const server = createProjectServer({ ...options, ...(configured ? {} : { publicUrl: "" }) });
            await new Promise((resolve, reject) => {
                server.once("error", reject);
                server.listen(0, "0.0.0.0", resolve);
            });
            const base = `http://127.0.0.1:${server.address().port}`;
            try {
                assert.equal(server.address().address, "0.0.0.0");
                for (const route of ["/login.html", "/asistencia_qr.html"]) {
                    const response = await fetch(base + route);
                    assert.equal(response.status, 200);
                    assert.equal(response.headers.get("access-control-allow-origin"), "*");
                    await response.text();
                }
                for (const route of ["/api/auth/password", "/api/attendance/qr/register"]) {
                    const response = await fetch(base + route, { method: "OPTIONS", headers: {
                        Origin: "https://otro.example", "Access-Control-Request-Method": "POST",
                        "Access-Control-Request-Headers": "content-type"
                    } });
                    assert.equal(response.status, 204);
                    assert.equal(response.headers.get("access-control-allow-origin"), "*");
                    assert.match(response.headers.get("access-control-allow-headers"), /Content-Type/);
                }
                const login = await fetch(base + "/api/auth/password", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ identifier: "admin", password: "prueba-publica" })
                });
                assert.equal(login.status, 200);
                assert.equal(login.headers.get("access-control-allow-origin"), "*");
                const cookie = login.headers.get("set-cookie").split(";")[0];
                await login.text();
                const qr = await fetch(base + "/api/attendance/qr", {
                    method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
                    body: JSON.stringify({ ficha: "123", jornada: "Mañana" })
                });
                const data = await qr.json();
                assert.equal(qr.status, 201, JSON.stringify(data));
                const qrUrl = new URL(data.url);
                if (configured) {
                    assert.equal(qrUrl.origin, "https://prueba-publica.lhr.life");
                } else {
                    const lan = Object.values(os.networkInterfaces()).flat().filter(Boolean)
                        .find((item) => item.family === "IPv4" && !item.internal && item.address && !item.address.startsWith("169.254."));
                    assert.equal(qrUrl.port, String(server.address().port));
                    assert.equal(qrUrl.protocol, "http:");
                    assert.equal(qrUrl.hostname, lan ? lan.address : "127.0.0.1");
                }
                assert.equal(qrUrl.pathname, "/asistencia_qr.html");
                assert.match(new URL(data.url).searchParams.get("token"), /^[a-f0-9]{64}$/);
                assert.match(data.image, /^data:image\/png;base64,/);
                const unauthenticated = await fetch(base + "/api/attendance/qr/register", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: new URL(data.url).searchParams.get("token") })
                });
                assert.equal(unauthenticated.status, 403);
                assert.equal(unauthenticated.headers.get("access-control-allow-origin"), "*");
                await unauthenticated.text();
            } finally {
                await new Promise(resolve => server.close(resolve));
            }
        }
        console.log("OK: PUBLIC_URL, QR público/local, login, CORS, OPTIONS y escucha IPv4.");
    } finally {
        if (previous === undefined) delete process.env.PUBLIC_URL;
        else process.env.PUBLIC_URL = previous;
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
