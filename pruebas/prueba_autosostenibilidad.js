"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const raiz = path.resolve(__dirname, "..");
const leer = (ruta) => fs.readFileSync(path.join(raiz, ruta), "utf8");

assert.match(leer("BUILD_ID.txt"), /^version-(?:8\.(?:1-huella-autosostenible|9-biometria-premium|9\.1-biosecure-premium-motion)|9\.1-biosecure-dashboard)-/);

const abrir = leer("ABRIR_PROYECTO.cmd");
assert.match(abrir, /npm\.cmd ci/i);
assert.match(abrir, /asegurar_biometria\.ps1/i);
assert.match(abrir, /asegurar_servidor\.ps1/i);

const vigilante = leer("herramientas/automatizacion/vigilante_servidor.ps1");
assert.match(vigilante, /asegurar_biometria\.ps1/);
assert.match(vigilante, /asegurar_servidor\.ps1/);

const supervisorBiometrico = leer("herramientas/automatizacion/asegurar_biometria.ps1");
assert.match(supervisorBiometrico, /127\.0\.0\.1/);
assert.match(supervisorBiometrico, /BIOMETRIC_SERVICE_KEY/);
assert.match(supervisorBiometrico, /RandomNumberGenerator/);
assert.match(supervisorBiometrico, /crash-loop/i);
assert.doesNotMatch(supervisorBiometrico, /Write-(Output|Host).*\$secret/i);

const realMotor = leer("puente_biometrico_real/motor_biometrico.c");
const realBridge = leer("puente_biometrico_real/servidor_real.py");
assert.match(realMotor, /fp_device_enroll_sync/);
assert.match(realMotor, /fp_device_verify_sync/);
assert.match(realMotor, /fp_device_identify_sync/);
assert.match(realMotor, /FP_DEVICE_FEATURE_IDENTIFY/);
assert.match(realBridge, /127\.0\.0\.1/);
assert.match(realBridge, /CLAVE_LOCAL_PUENTE_FILE/);
assert.doesNotMatch(realBridge, /Access-Control-Allow-Origin/i);

const mock = leer("puente_biometrico_mock/servidor_mock.js");
assert.match(mock, /RETENCION_CAPTURA_MS/);
assert.match(mock, /finalizada_en/);
assert.match(mock, /operacion === "identificacion"/);
assert.match(mock, /candidatos/);

const asistencia = leer("aplicacion/paginas HTML/asistencia.html");
const interfazBiometrica = leer("aplicacion/recursos/JS scripts/biometria_asistencia.js");
assert.doesNotMatch(asistencia, /id="attendance-biometric-user"/);
assert.match(interfazBiometrica, /operacion:\s*"identificacion"/);
assert.match(interfazBiometrica, /ficha:\s*ficha\.value/);
assert.doesNotMatch(interfazBiometrica, /usuario_id:\s*usuario\.value/);

const usuarios = leer("aplicacion/recursos/JS scripts/usuarios.js");
const registroBiometrico = leer("aplicacion/recursos/JS scripts/huella_registro.js");
assert.match(usuarios, /huella_registro\.html\?usuario=/);
assert.doesNotMatch(usuarios, /operacion:\s*"enrolamiento"/);
assert.match(registroBiometrico, /\/api\/biometria\/usuarios\//);
assert.match(registroBiometrico, /motivo/);

const servidor = leer("servidor/servidor.js");
assert.match(servidor, /estadoBiometriaMock/);
assert.match(servidor, /biometria_mock_estado\.json/);
assert.match(servidor, /todos los aprendices activos|candidatos/);
assert.match(servidor, /biometria:\s*biometricHealth/);

const entrega = leer("herramientas/entrega/crear_entrega_segura.ps1");
for (const sensible of [".env", ".git", "node_modules", "credenciales_administrador.json", "clave_codigos.key", "biometria_mock_estado.json", "clave_puente_biometrico.key", "biometria_real"]) {
    assert.match(entrega, new RegExp(sensible.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

console.log("OK: arranque, supervisión, biometría mock/real, identificación por ficha y entrega segura validados estructuralmente.");
