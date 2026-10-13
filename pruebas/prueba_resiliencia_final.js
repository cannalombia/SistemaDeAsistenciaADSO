const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const exists = (...parts) => fs.existsSync(path.join(root, ...parts));

const server = read("servidor", "servidor.js");
const systemRoutes = read("servidor", "rutas", "sistema.js");
assert.match(systemRoutes, /\/api\/health\/live/);
assert.match(systemRoutes, /\/api\/health\/ready/);
assert.match(server, /Idempotency-Key/i);
assert.match(server, /withMutationLock/);
assert.match(server, /syncSharedState/);
assert.match(server, /hydrateSessionFromRepository/);
assert.match(server, /saveQrToken/);
assert.match(server, /unhandledRejection/);
assert.match(server, /uncaughtException/);
assert.match(server, /requestTimeout/);
assert.match(server, /headersTimeout/);
assert.match(server, /keepAliveTimeout/);
assert.match(server, /TRUST_PROXY/);

const repository = read("servidor", "base_datos", "repositorio.js");
for (const method of [
    "withMutationLock", "saveSession", "getSession", "saveQrToken", "getQrToken",
    "getIdempotency", "saveIdempotency", "enqueueEmailOutbox", "heartbeatInstance",
    "activeInstances", "cleanupRuntime"
]) assert.match(repository, new RegExp(`\\b${method}\\b`), `Falta ${method} en el repositorio MySQL.`);
assert.match(repository, /GET_LOCK/);
assert.match(repository, /RELEASE_LOCK/);
assert.match(repository, /beginTransaction\(\)/);

const email = read("servidor", "modulos", "correo.js");
assert.match(email, /circuit/i);
assert.match(email, /drainOutbox/);
assert.match(email, /half_open/i);

const migration = read("base_datos", "migraciones", "003_resiliencia_multiinstancia.up.sql");
for (const table of ["app_runtime_state", "app_sessions", "app_qr_tokens", "app_idempotency", "app_email_outbox", "app_instance_heartbeats"]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
}
assert.match(migration, /uq_attendance_effective/);

const pagesDir = path.join(root, "aplicacion", "paginas HTML");
const pages = fs.readdirSync(pagesDir).filter((name) => name.endsWith(".html"));
assert.equal(pages.length, 12, "Se esperaban las 12 páginas HTML del sistema.");
for (const page of pages) {
    const html = fs.readFileSync(path.join(pagesDir, page), "utf8");
    assert.match(html, /resiliencia_cliente\.js/, `${page} debe cargar resiliencia_cliente.js.`);
}

const apprentice = read("aplicacion", "paginas HTML", "aprendiz.html");
assert.match(apprentice, /learner-file-input/);
assert.match(apprentice, /learner-excuse-actions/);
assert.match(apprentice, /learner-excuse-history/);
const visual = read("aplicacion", "recursos", "estilos CCS", "sistema_visual.css");
assert.match(visual, /learner-file-input::file-selector-button/);
assert.match(visual, /learner-excuse-history/);

for (const file of [
    "iniciar_dos_nodos.ps1", "detener_dos_nodos.ps1", "verificar_nodos.ps1",
    "haproxy-blue-magic.cfg.example", "nginx-blue-magic.conf.example", "mysql-router.env.example"
]) assert.ok(exists("herramientas", "alta_disponibilidad", file), `Falta ${file}.`);

for (const setting of ["INSTANCE_ID", "BACKUP_DIR", "HTTP_REQUEST_TIMEOUT_MS", "SHUTDOWN_GRACE_MS", "EMAIL_CIRCUIT_FAILURE_THRESHOLD", "TRUST_PROXY"]) {
    assert.match(server, new RegExp(`process\\.env\\.${setting}\\b`), `El servidor debe utilizar la configuración ${setting}.`);
}

const attendance = JSON.parse(read("datos", "ejemplos", "asistencia_resiliencia.ejemplo.json"));
const effectiveKeys = new Set();
for (const item of attendance) {
    const key = `${item.identificacion}|${item.ficha}|${item.fecha}|${item.jornada}`;
    assert.ok(!effectiveKeys.has(key), `Asistencia duplicada: ${key}`);
    effectiveKeys.add(key);
}
for (const date of ["2026-09-28", "2026-10-02", "2026-10-05", "2026-10-09"]) {
    assert.ok(attendance.some((item) => item.fecha === date), `Faltan registros visuales para ${date}.`);
}

console.log("OK: cierre final de resiliencia, multi-instancia, health, idempotencia, correo durable, estadísticas y UI de excusas.");
