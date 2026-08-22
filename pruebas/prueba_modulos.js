"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
    normalizeEmail,
    boundedInteger,
    maskEmail,
    readCookies,
    safeEqual
} = require("../servidor/modulos/utilidades");
const {
    detectCsvDelimiter,
    parseDelimitedCsv,
    serializeCsvUsers,
    normalizeSqlText,
    ensureOperationalFile
} = require("../servidor/modulos/persistencia");
const { verificationMessage } = require("../servidor/modulos/correo");
const {
    normalizeProgramText,
    canonicalProgramStatus,
    displayProgramLevel,
    validateProgramInput
} = require("../servidor/dominio/programas");
const { canonicalRole, canonicalUserStatus } = require("../servidor/dominio/usuarios");
const { rateFor, statusSummary, resolveDashboardRange } = require("../servidor/dominio/estadisticas");

assert.equal(normalizeEmail("  Persona@Ejemplo.COM "), "persona@ejemplo.com");
assert.equal(normalizeEmail("correo-incompleto"), "");
assert.equal(boundedInteger("12", 5, 1, 10), 10);
assert.equal(boundedInteger("sin número", 5, 1, 10), 5);
assert.equal(maskEmail("persona@ejemplo.com"), "pe***@ejemplo.com");
assert.equal(safeEqual("mismo-valor", "mismo-valor"), true);
assert.equal(safeEqual("uno", "otro"), false);

const cookies = readCookies({ headers: { cookie: "sesion=abc123; preferencia=modo%20claro" } });
assert.deepEqual(cookies, { sesion: "abc123", preferencia: "modo claro" });

const csv = '\uFEFFidentificación;nombre;nota\n100;"Ortiz, Juan";"texto con ; separador"\n';
assert.equal(detectCsvDelimiter(csv), ";");
assert.deepEqual(parseDelimitedCsv(csv), [
    { identificacion: "100", nombre: "Ortiz, Juan", nota: "texto con ; separador" }
]);

const serializado = serializeCsvUsers([{
    identificacion: "100",
    tipo_documento: "CC",
    nombre: 'Juan "Manuel"',
    correo: "juan@example.com",
    rol: "Aprendiz",
    estado: "Activo",
    ficha: "3349882"
}]);
assert.match(serializado, /"Juan ""Manuel"""/);
assert.equal(normalizeSqlText("Mi?rcoles en la Ma?ana"), "Miércoles en la Mañana");

assert.equal(normalizeProgramText("  TECNÓLOGO "), "tecnologo");
assert.equal(canonicalProgramStatus("en revisión"), "En revisión");
assert.equal(displayProgramLevel("tecnico"), "Técnico");
assert.deepEqual(validateProgramInput({
    code: "123",
    name: "Análisis de software",
    level: "Tecnólogo",
    duration: "27 meses",
    status: "Activo"
}), {
    code: "123",
    name: "Análisis de software",
    level: "Tecnólogo",
    duration: "27 meses",
    status: "Activo"
});
assert.equal(canonicalRole("APRENDIZ"), "Aprendiz");
assert.equal(canonicalUserStatus("inactivo"), "Inactivo");

const attendance = [
    { fecha: "2026-08-20", estado: "presente" },
    { fecha: "2026-08-20", estado: "ausente" }
];
assert.equal(rateFor(attendance), 50);
assert.equal(statusSummary(attendance).percentages.ausente, 50);
const rangeUrl = new URL("http://localhost/api/statistics?from=2026-08-20&to=2026-08-22");
assert.equal(resolveDashboardRange(rangeUrl, attendance, new Date("2026-08-22T12:00:00")).fromText, "2026-08-20");

const emailMessage = verificationMessage(
    { name: "Juan <script>", email: "juan@example.com" },
    "123456",
    "Sistema SENA <acceso@example.com>"
);
assert.equal(emailMessage.to[0], "juan@example.com");
assert.equal(emailMessage.html.includes("<script>"), false);
assert.equal(emailMessage.html.includes("&lt;script&gt;"), true);

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "sena-datos-"));
try {
    const exampleFile = path.join(temporaryDirectory, "ejemplo.json");
    const operationalFile = path.join(temporaryDirectory, "local", "datos.json");
    fs.writeFileSync(exampleFile, '[{"muestra":true}]\n', "utf8");
    assert.equal(ensureOperationalFile(operationalFile, exampleFile), true);
    assert.equal(fs.readFileSync(operationalFile, "utf8"), '[{"muestra":true}]\n');
    assert.equal(ensureOperationalFile(operationalFile, exampleFile), false);
} finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

console.log("OK: utilidades, dominio, correo, CSV y compatibilidad de datos validados.");
