/*
    Archivo: diagnostico.js

    Propósito:
    Revisar de forma rápida si una instalación local tiene los componentes principales disponibles.

    Límites:
    No modifica datos, no muestra secretos y no corrige automáticamente la configuración.
*/
"use strict";

const fs = require("fs");
const path = require("path");
const net = require("net");

const raiz = path.resolve(__dirname, "..");

function leerEnv() {
    const archivo = path.join(raiz, ".env");
    const datos = {};
    if (!fs.existsSync(archivo)) return datos;
    for (const linea of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
        const texto = linea.trim();
        if (!texto || texto.startsWith("#")) continue;
        const pos = texto.indexOf("=");
        if (pos < 1) continue;
        datos[texto.slice(0, pos).trim()] = texto.slice(pos + 1).trim().replace(/^['"]|['"]$/g, "");
    }
    return datos;
}

function comprobarPuerto(puerto) {
    return new Promise((resolver) => {
        const socket = net.createConnection({ host: "127.0.0.1", port: puerto });
        socket.setTimeout(900);
        socket.once("connect", () => { socket.destroy(); resolver(true); });
        socket.once("timeout", () => { socket.destroy(); resolver(false); });
        socket.once("error", () => resolver(false));
    });
}

function estado(nombre, ok, detalle) {
    console.log(`${ok ? "[OK]" : "[--]"} ${nombre}${detalle ? ` · ${detalle}` : ""}`);
}

(async () => {
    const env = leerEnv();
    console.log("\nSISTEMA DE ASISTENCIA SENA — DIAGNÓSTICO\n");
    estado("Node.js", true, process.version);
    estado(".env", fs.existsSync(path.join(raiz, ".env")), fs.existsSync(path.join(raiz, ".env")) ? "configuración local presente" : "falta configuración local");
    estado("BUILD_ID", fs.existsSync(path.join(raiz, "BUILD_ID.txt")), fs.existsSync(path.join(raiz, "BUILD_ID.txt")) ? fs.readFileSync(path.join(raiz, "BUILD_ID.txt"), "utf8").trim() : "ausente");
    estado("Dependencias", fs.existsSync(path.join(raiz, "node_modules", "qrcode", "package.json")), "usa npm ci si faltan");
    estado("Servidor :3000", await comprobarPuerto(3000));

    const biometria = ["1", "true"].includes(String(env.BIOMETRIC_ENABLED || "false").toLowerCase());
    estado("Biometría", biometria, biometria ? `modo ${env.BIOMETRIC_MODE || "mock"}` : "deshabilitada");
    if (biometria) {
        const modo = String(env.BIOMETRIC_MODE || "mock").toLowerCase();
        estado("Clave biométrica local", String(env.BIOMETRIC_SERVICE_KEY || "").length >= 24, "no se muestra su valor");
        if (modo === "real") {
            estado("Clave AES biométrica", /^[0-9a-f]{64}$/i.test(String(env.BIOMETRIC_ENCRYPTION_KEY || "")), "no se muestra su valor");
            estado("Puente real compilado", fs.existsSync(path.join(raiz, "puente_biometrico_real", "bin", "motor_biometrico")), "se prepara con INSTALAR_BIOMETRIA_REAL.cmd");
        }
        let puertoBiometrico = 4318;
        try {
            const urlBiometrica = new URL(env.BIOMETRIC_SERVICE_URL || "http://127.0.0.1:4318");
            if (urlBiometrica.protocol === "http:" && urlBiometrica.hostname === "127.0.0.1") puertoBiometrico = Number(urlBiometrica.port || 80);
        } catch (_) {}
        estado(`Puente :${puertoBiometrico}`, await comprobarPuerto(puertoBiometrico), `URL local ${env.BIOMETRIC_SERVICE_URL || "http://127.0.0.1:4318"}`);
    }

    const mysqlConfigurado = Boolean(env.DB_HOST && env.DB_USER && env.DB_NAME);
    estado("Configuración MySQL", mysqlConfigurado, mysqlConfigurado ? `${env.DB_HOST}:${env.DB_PORT || 3306}/${env.DB_NAME}` : "incompleta");
    const correo = String(env.EMAIL_PROVIDER || "").trim();
    estado("Proveedor de correo", Boolean(correo), correo || "sin configurar");
    console.log("\nPara una validación funcional completa ejecuta: npm test && npm run verify\n");
})().catch((error) => {
    console.error("Diagnóstico interrumpido:", error.message);
    process.exitCode = 1;
});
