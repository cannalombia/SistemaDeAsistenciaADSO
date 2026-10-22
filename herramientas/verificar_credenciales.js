"use strict";

const fs = require("fs");
const path = require("path");
const { loadEnv } = require("./base_datos/comun");

const root = path.resolve(__dirname, "..");
const credentialsFile = path.join(root, "datos", "credenciales_administrador.json");

function validPair(prefix) {
    const salt = String(process.env[`${prefix}_AUTH_SALT`] || "").trim();
    const hash = String(process.env[`${prefix}_AUTH_PASSWORD_HASH`] || "").trim().toLowerCase();
    return salt.length >= 8 && /^[a-f0-9]{128}$/.test(hash);
}

function validStoredAdmin() {
    if (!fs.existsSync(credentialsFile)) return false;
    try {
        const value = JSON.parse(fs.readFileSync(credentialsFile, "utf8"));
        return String(value.salt || "").length >= 8 && /^[a-f0-9]{128}$/.test(String(value.passwordHash || "").toLowerCase());
    } catch (_) {
        return false;
    }
}

loadEnv(root);
if (!validStoredAdmin() && !validPair("ADMIN")) {
    console.error("[ERROR] Faltan credenciales administrativas válidas.");
    process.exit(10);
}
if (!validPair("INSTRUCTOR")) {
    console.error("[ERROR] Faltan INSTRUCTOR_AUTH_SALT e INSTRUCTOR_AUTH_PASSWORD_HASH válidos en .env.");
    process.exit(11);
}
console.log("[OK] Credenciales administrativas y de instructor disponibles (valores no mostrados).");
