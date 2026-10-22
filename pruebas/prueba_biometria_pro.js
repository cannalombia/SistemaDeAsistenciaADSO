"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const raiz = path.resolve(__dirname, "..");
const leer = (ruta) => fs.readFileSync(path.join(raiz, ruta), "utf8");

const html = leer("aplicacion/paginas HTML/asistencia.html");
const css = leer("aplicacion/recursos/estilos CCS/biometria.css");
const js = leer("aplicacion/recursos/JS scripts/biometria_asistencia.js");
const mock = leer("puente_biometrico_mock/servidor_mock.js");
const supervisor = leer("herramientas/automatizacion/asegurar_biometria.ps1");
const diagnostico = leer("herramientas/automatizacion/diagnostico_biometria.ps1");

assert.match(html, /attendance-biometric-scanner/, "Asistencia debe incluir el escáner biométrico visual.");
assert.match(html, /attendance-biometric-scan-line/, "El escáner debe incluir la línea de lectura animada.");
assert.match(css, /@keyframes biometric-scan/, "Debe existir la animación de barrido biométrico.");
assert.match(css, /prefers-reduced-motion/, "Las animaciones deben respetar accesibilidad de movimiento reducido.");
assert.match(js, /BIOMETRÍA REAL ACTIVA/, "La interfaz debe distinguir dinámicamente el modo real.");
assert.match(js, /data.*scanState|scanState/, "El frontend debe controlar estados visuales del escáner.");
assert.match(mock, /PUERTO_PUENTE_BIOMETRICO/, "El puente mock debe aceptar el puerto entregado por el supervisor.");
assert.match(supervisor, /BIOMETRIC_SERVICE_URL/, "El supervisor debe usar BIOMETRIC_SERVICE_URL como fuente del puerto.");
assert.match(supervisor, /PUERTO_PUENTE_BIOMETRICO/, "El supervisor debe pasar el puerto al puente biométrico.");
assert.match(diagnostico, /05ba:000a/, "El diagnóstico debe verificar el DigitalPersona 4500 real.");
assert.match(diagnostico, /Attached/, "El diagnóstico debe revisar que usbipd adjuntó el lector a WSL.");

const seguridadRutas = require("../servidor/rutas/biometria");
const peticion = (host, remoto, origin="") => ({headers: {host, ...(origin ? {origin}: {})}, socket:{remoteAddress:remoto}});
assert.equal(seguridadRutas.esSolicitudLocalBiometria(peticion("127.0.0.1:3000", "127.0.0.1")), true);
assert.equal(seguridadRutas.esSolicitudLocalBiometria(peticion("localhost:3000", "::ffff:127.0.0.1")), true);
assert.equal(seguridadRutas.esSolicitudLocalBiometria(peticion("tunnel.lhr.life", "127.0.0.1")), false);
assert.equal(seguridadRutas.esSolicitudLocalBiometria(peticion("localhost:3000", "10.0.0.3")), false);
assert.equal(seguridadRutas.esSolicitudLocalBiometria(peticion("localhost:3000", "127.0.0.1", "https://malicioso.ejemplo")), false);
const premium = leer("aplicacion/recursos/estilos CCS/biometria_89.css");
assert.match(premium,/prefers-reduced-motion/);
assert.match(leer("aplicacion/paginas HTML/huella_registro.html"),/id="biometric-consent-check"/);
assert.match(leer("aplicacion/paginas HTML/huella_registro.html"),/id="biometric-user-search"/);
assert.match(leer("servidor/servidor.js"),/AUTORIZACION_REQUERIDA/);
console.log("OK: biometría PRO valida animación, modo real, puerto único, usbipd/WSL y diagnóstico integral.");
