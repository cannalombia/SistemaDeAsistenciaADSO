"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const open = read("ABRIR_PROYECTO.cmd");
assert.match(open, /EnableDelayedExpansion/i, "El .cmd debe leer correctamente códigos de salida dentro de bloques.");
const mysqlPosition = open.indexOf("asegurar_mysql.ps1");
const credentialsPosition = open.indexOf("verificar_credenciales.js");
const biometricPosition = open.indexOf("asegurar_biometria.ps1");
const serverPosition = open.indexOf("asegurar_servidor.ps1");

assert(mysqlPosition >= 0, "El arranque debe validar MySQL.");
assert(credentialsPosition > mysqlPosition, "Las credenciales deben validarse después de MySQL.");
assert(biometricPosition > credentialsPosition, "El puente debe arrancar después de las precondiciones.");
assert(serverPosition > biometricPosition, "Node debe arrancar después de preparar el puente.");
assert.match(open, /diagnostico_biometria\.ps1/i, "Una falla biométrica debe mostrar diagnóstico accionable.");
assert.match(read("herramientas/automatizacion/vigilante_servidor.ps1"), /asegurar_mysql\.ps1/i, "El vigilante debe validar MySQL antes de reiniciar servicios.");
assert.match(read("herramientas/automatizacion/asegurar_servidor.ps1"), /verificar_credenciales\.js/i, "El supervisor de Node debe validar credenciales antes de iniciar.");

for (const relative of [
    "herramientas/automatizacion/asegurar_biometria.ps1",
    "herramientas/automatizacion/diagnostico_biometria.ps1",
    "puente_biometrico_real/INSTALAR_BIOMETRIA_REAL.cmd"
]) {
    const source = read(relative);
    assert.match(source, /convertir_ruta_wsl\.ps1/i, `${relative} debe usar la traducción segura de rutas.`);
    assert.doesNotMatch(source, /wslpath\s+-a\s+\$ProjectRoot/i, `${relative} conserva la llamada que dañaba las barras de la ruta.`);
}

const converter = read("herramientas/automatizacion/convertir_ruta_wsl.ps1");
assert.match(converter, /WSLENV/);
assert.match(converter, /BIOSECURE_WINDOWS_PATH\/p/);
const biometricSupervisor = read("herramientas/automatizacion/asegurar_biometria.ps1");
assert.match(biometricSupervisor, /Start-Process -FilePath \$wslExecutable/, "wsl.exe debe permanecer como anfitrión del puente real.");
assert.match(biometricSupervisor, /--exec env PUERTO_PUENTE_BIOMETRICO/, "El puente debe recibir puerto y clave sin bash -lc.");
assert.match(read("herramientas/verificar_mysql.js"), /assertMigrationsCurrent/);
assert.match(read("herramientas/automatizacion/asegurar_mysql.ps1"), /\$exitCode = \$LASTEXITCODE/, "El preflight MySQL debe decidir por código de salida, no por texto del proceso.");
assert.match(read("herramientas/verificar_credenciales.js"), /process\.exit\(10\)/);
assert.match(read("herramientas/automatizacion/probar_puente_python.ps1"), /wsl\.exe.*python3/s, "Las pruebas del motor ELF deben ejecutarse en WSL, no con Python de Windows.");

console.log("OK: orden de arranque, preflight MySQL/credenciales y traducción Windows-WSL validados.");
