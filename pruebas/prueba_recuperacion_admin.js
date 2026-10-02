"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createProjectServer } = require("../servidor/servidor");

async function main() {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "sena-recuperacion-admin-"));
    const credentialsFile = path.join(temporaryDirectory, "credenciales_administrador.json");
    const authStateFile = path.join(temporaryDirectory, "estado_autenticacion.json");
    const auditRecords = [];
    const sentMessages = [];
    let currentTime = Date.parse("2026-10-02T12:00:00Z");

    const oldPassword = "ClaveAnterior123";
    const newPassword = "ClaveNuevaSegura456";
    const server = createProjectServer({
        adminPassword: oldPassword,
        instructorPassword: "ClaveInstructor123",
        adminCredentialsFile: credentialsFile,
        authStateFile,
        auditFile: null,
        auditRecords,
        emailHistoryFile: null,
        otpSecret: "secreto-recuperacion-administrativa-prueba",
        exposeTestCode: true,
        now: () => currentTime,
        apprentices: [],
        attendanceRecords: [],
        managedUsers: [],
        csvUsers: [],
        programs: [],
        excuses: [],
        reports: [],
        sqlData: { ambientes: [], fichas: [], programas: [], horarios: [] },
        emailSender: async (message) => {
            sentMessages.push(message);
            return { id: `recuperacion-${sentMessages.length}` };
        }
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const post = async (route, body, headers = {}) => {
        const response = await fetch(`${baseUrl}${route}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify(body)
        });
        return { response, data: await response.json() };
    };
    const differentCode = (code) => code === "000000" ? "000001" : "000000";

    try {
        const unauthorized = await post("/api/auth/password/recovery/request", { identifier: "instructor" });
        assert.equal(unauthorized.response.status, 200);
        assert.equal(unauthorized.data.testCode, undefined);
        assert.equal(sentMessages.length, 0);
        assert.doesNotMatch(unauthorized.data.message, /admin@sena\.edu\.co/i);

        const unauthorizedReset = await post("/api/auth/password/recovery/reset", {
            identifier: "instructor",
            code: "123456",
            newPassword
        });
        assert.equal(unauthorizedReset.response.status, 401);

        const initialLogin = await post("/api/auth/password", { identifier: "admin", password: oldPassword });
        assert.equal(initialLogin.response.status, 200);
        const initialCookie = initialLogin.response.headers.get("set-cookie")?.split(";")[0] || "";

        const requested = await post("/api/auth/password/recovery/request", { identifier: "admin" });
        assert.equal(requested.response.status, 200);
        assert.match(requested.data.testCode, /^\d{6}$/);
        assert.equal(sentMessages.length, 1);
        assert.equal(sentMessages[0].to[0], "admin@sena.edu.co");
        assert.match(sentMessages[0].subject, /recuperar el acceso administrativo/i);
        assert.match(sentMessages[0].text, /Expira en 10 minutos/i);
        assert.doesNotMatch(sentMessages[0].text, new RegExp(oldPassword, "i"));

        const storedPending = JSON.parse(fs.readFileSync(authStateFile, "utf8"));
        assert.match(storedPending.adminRecovery.hash, /^[a-f0-9]{64}$/i);
        assert.notEqual(storedPending.adminRecovery.hash, requested.data.testCode);
        assert.equal(JSON.stringify(storedPending).includes(requested.data.testCode), false);

        const incorrect = await post("/api/auth/password/recovery/reset", {
            identifier: "admin",
            code: differentCode(requested.data.testCode),
            newPassword
        });
        assert.equal(incorrect.response.status, 401);

        const completed = await post("/api/auth/password/recovery/reset", {
            identifier: "admin",
            code: requested.data.testCode,
            newPassword
        });
        assert.equal(completed.response.status, 200);

        const reused = await post("/api/auth/password/recovery/reset", {
            identifier: "admin",
            code: requested.data.testCode,
            newPassword: "OtraClaveSegura789"
        });
        assert.equal(reused.response.status, 401);

        const newPasswordLogin = await post("/api/auth/password", { identifier: "admin", password: newPassword });
        const oldPasswordLogin = await post("/api/auth/password", { identifier: "admin", password: oldPassword });
        assert.equal(newPasswordLogin.response.status, 200);
        assert.equal(oldPasswordLogin.response.status, 401);

        const invalidatedSession = await fetch(`${baseUrl}/api/auth/session`, { headers: { Cookie: initialCookie } });
        assert.deepEqual(await invalidatedSession.json(), { authenticated: false });

        const storedCredentials = JSON.parse(fs.readFileSync(credentialsFile, "utf8"));
        assert.match(storedCredentials.passwordHash, /^[a-f0-9]{128}$/i);
        assert.ok(storedCredentials.salt.length >= 8);
        assert.equal(JSON.stringify(storedCredentials).includes(oldPassword), false);
        assert.equal(JSON.stringify(storedCredentials).includes(newPassword), false);
        assert.ok(auditRecords.some((entry) => entry.action === "request" && entry.entity === "admin_password_recovery"));
        assert.ok(auditRecords.some((entry) => entry.action === "reset_password" && entry.entity === "admin_password_recovery"));
        assert.equal(JSON.stringify(auditRecords).includes(requested.data.testCode), false);
        assert.equal(JSON.stringify(auditRecords).includes(newPassword), false);

        currentTime += 61 * 1000;
        const expiringRequest = await post("/api/auth/password/recovery/request", { identifier: "admin" });
        assert.equal(expiringRequest.response.status, 200);
        currentTime += 10 * 60 * 1000 + 1;
        const expired = await post("/api/auth/password/recovery/reset", {
            identifier: "admin",
            code: expiringRequest.data.testCode,
            newPassword: "ClavePosteriorExpirada123"
        });
        assert.equal(expired.response.status, 401);

        currentTime += 61 * 1000;
        const limitedRequest = await post("/api/auth/password/recovery/request", { identifier: "admin" });
        assert.equal(limitedRequest.response.status, 200);
        const badCode = differentCode(limitedRequest.data.testCode);
        for (let attempt = 1; attempt <= 5; attempt += 1) {
            const rejected = await post("/api/auth/password/recovery/reset", {
                identifier: "admin",
                code: badCode,
                newPassword: "ClaveIntentosSegura123"
            });
            assert.equal(rejected.response.status, attempt === 5 ? 429 : 401);
        }
        const blockedAfterLimit = await post("/api/auth/password/recovery/reset", {
            identifier: "admin",
            code: limitedRequest.data.testCode,
            newPassword: "ClaveIntentosSegura123"
        });
        assert.equal(blockedAfterLimit.response.status, 401);
        assert.ok(auditRecords.some((entry) => entry.details?.reason === "attempt_limit"));

        const loginHtml = fs.readFileSync(path.join(__dirname, "..", "aplicacion", "paginas HTML", "login.html"), "utf8");
        const authScript = fs.readFileSync(path.join(__dirname, "..", "aplicacion", "recursos", "JS scripts", "autenticacion.js"), "utf8");
        assert.match(loginHtml, /data-auth-action="forgot-password"/);
        assert.match(loginHtml, /id="admin-recovery-request-form"/);
        assert.match(loginHtml, /id="admin-recovery-reset-form"/);
        assert.match(authScript, /\/api\/auth\/password\/recovery\/request/);
        assert.match(authScript, /\/api\/auth\/password\/recovery\/reset/);

        console.log("OK: recuperación administrativa, OTP, expiración, intentos, contraseña, sesiones, auditoría y acceso no autorizado validados.");
    } finally {
        await new Promise((resolve) => server.close(resolve));
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
