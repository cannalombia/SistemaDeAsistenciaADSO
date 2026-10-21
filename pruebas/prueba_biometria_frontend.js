"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const raiz = path.resolve(__dirname, "..");
const leer = (ruta) => fs.readFileSync(path.join(raiz, ruta), "utf8");

const asistencia = leer("aplicacion/paginas HTML/asistencia.html");
const crearUsuario = leer("aplicacion/paginas HTML/crear_usuario.html");
const registroHuella = leer("aplicacion/paginas HTML/huella_registro.html");
const biometriaAsistencia = leer("aplicacion/recursos/JS scripts/biometria_asistencia.js");
const registroHuellaJs = leer("aplicacion/recursos/JS scripts/huella_registro.js");
const usuarios = leer("aplicacion/recursos/JS scripts/usuarios.js");
const navegacion = leer("aplicacion/recursos/JS scripts/navegacion.js");

assert.match(asistencia, /id="generate-qr"/, "Asistencia debe conservar un acceso al QR.");
assert.match(asistencia, /id="attendance-biometric-toggle"/, "Asistencia debe mostrar la opción Huella junto al QR.");
assert.match(asistencia, /IDENTIFICACIÓN BIOMÉTRICA/, "Asistencia debe conservar su pantalla integrada de identificación.");
assert.match(asistencia, /biometria_asistencia\.js/, "Asistencia debe cargar su controlador biométrico integrado.");
assert.match(biometriaAsistencia, /\/api\/biometria\/estado/, "El frontend debe consultar al servidor principal, no al puente directo.");
assert.doesNotMatch(biometriaAsistencia, /BIOMETRIC_SERVICE_KEY|127\.0\.0\.1:4318|Authorization:\s*Bearer/, "El frontend no debe conocer secretos ni la dirección del puente.");
assert.match(crearUsuario, /id="user-biometric-enroll"/, "Crear usuario debe incluir el control para registrar huella.");
assert.match(usuarios, /huella_registro\.html\?usuario=/, "Crear usuario debe dirigir al flujo biométrico centralizado.");
assert.doesNotMatch(usuarios, /operacion:\s*"enrolamiento"/, "Crear usuario no debe conservar un segundo enrolamiento embebido.");
assert.match(registroHuella, /id="biometric-consent-check"/, "El enrolamiento debe exigir autorización documentada.");
assert.match(asistencia, /attendance-biometric-enroll-link/, "Sin huellas, Asistencia debe orientar al enrolamiento centralizado.");
assert.match(registroHuella, /id="biometric-user-select"/, "La pantalla única debe permitir seleccionar un aprendiz existente.");
assert.match(registroHuella, /id="biometric-revoke-dialog"/, "La pantalla única debe incluir revocación autorizada.");
assert.match(registroHuellaJs, /operacion, usuario_id: estado\.usuario\.id/, "La pantalla única debe iniciar captura mediante la API protegida.");
assert.match(registroHuellaJs, /motivo\.length < 10/, "La revocación debe exigir un motivo auditable.");
assert.match(registroHuellaJs, /datos\.modo !== "real"/, "El enrolamiento debe rechazar explícitamente un puente simulado.");
assert.doesNotMatch(registroHuella, /Bitácora en vivo|biometric-activity-log/, "La pantalla no debe mostrar la bitácora que desborda el enrolamiento.");
assert.match(registroHuellaJs, /programarReconexion/, "El enrolamiento debe recuperarse cuando el lector vuelve a estar disponible.");
assert.match(registroHuellaJs, /BioSecure volverá a comprobarlo automáticamente/, "El error del lector debe indicar el siguiente paso.");
assert.doesNotMatch(registroHuellaJs, /BIOMETRIC_SERVICE_KEY|127\.0\.0\.1:4318|Authorization:\s*Bearer/, "La pantalla de enrolamiento no debe conocer el puente ni sus secretos.");
assert.doesNotMatch(navegacion, /asistencia_huella\.html[^\n]*Biometría/, "La biometría no debe quedar como módulo aislado en la barra lateral.");

console.log("OK: identificación integrada y enrolamiento biométrico único validados.");
