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
const {
    reportStatus,
    reportMetadata,
    validateReportTransition,
    archiveReport,
    restoreReport
} = require("../servidor/dominio/reportes");

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

const activeReport = {
    id: "report-active",
    createdAt: "2026-08-20T12:00:00.000Z",
    createdBy: "Administrador",
    filters: { from: "2026-08-01", to: "2026-08-20", ficha: "3349882", jornada: "Mañana", ignored: true },
    distribution: { total: 4, attendance: 75 },
    students: [{}, {}],
    status: "active",
    records: [{ ignored: true }]
};
const activeReportBefore = JSON.parse(JSON.stringify(activeReport));
assert.equal(reportStatus({}), "active");
assert.equal(reportStatus(activeReport), "active");
assert.equal(reportStatus({ status: "archived" }), "archived");
assert.equal(reportStatus({ status: "ARCHIVED" }), "active");
assert.deepEqual(reportMetadata(activeReport), {
    id: "report-active",
    createdAt: "2026-08-20T12:00:00.000Z",
    createdBy: "Administrador",
    filters: { from: "2026-08-01", to: "2026-08-20", ficha: "3349882", jornada: "Mañana" },
    total: 4,
    attendance: 75,
    students: 2,
    status: "active",
    archivedAt: null,
    archivedBy: null
});
assert.deepEqual(reportMetadata({ ...activeReport, status: "archived", archivedAt: "2026-08-21T12:00:00.000Z", archivedBy: "Coordinador" }), {
    id: "report-active",
    createdAt: "2026-08-20T12:00:00.000Z",
    createdBy: "Administrador",
    filters: { from: "2026-08-01", to: "2026-08-20", ficha: "3349882", jornada: "Mañana" },
    total: 4,
    attendance: 75,
    students: 2,
    status: "archived",
    archivedAt: "2026-08-21T12:00:00.000Z",
    archivedBy: "Coordinador"
});
assert.deepEqual(validateReportTransition(activeReport, "archive"), { ok: true });
assert.deepEqual(validateReportTransition({ ...activeReport, status: "archived" }, "restore"), { ok: true });
assert.deepEqual(validateReportTransition({ ...activeReport, status: undefined }, "archive"), { ok: true });
assert.deepEqual(validateReportTransition(activeReport, "invalid"), { ok: false, reason: "invalid_action" });
assert.deepEqual(validateReportTransition({ ...activeReport, status: "archived" }, "archive"), { ok: false, reason: "already_archived" });
assert.deepEqual(validateReportTransition(activeReport, "restore"), { ok: false, reason: "not_archived" });
assert.deepEqual(activeReport, activeReportBefore);

const archivedAt = "2026-08-21T12:00:00.000Z";
const archivedBy = "Coordinador exacto";
const mutableReport = JSON.parse(JSON.stringify(activeReport));
const mutableReportBefore = reportMetadata(mutableReport);
const untouchedFields = {
    id: mutableReport.id,
    createdAt: mutableReport.createdAt,
    createdBy: mutableReport.createdBy,
    filters: JSON.parse(JSON.stringify(mutableReport.filters)),
    distribution: JSON.parse(JSON.stringify(mutableReport.distribution)),
    students: JSON.parse(JSON.stringify(mutableReport.students)),
    records: JSON.parse(JSON.stringify(mutableReport.records))
};
archiveReport(mutableReport, { archivedAt, archivedBy });
assert.equal(mutableReport.status, "archived");
assert.equal(mutableReport.archivedAt, archivedAt);
assert.equal(mutableReport.archivedBy, archivedBy);
assert.deepEqual(reportMetadata(mutableReport), {
    ...mutableReportBefore,
    status: "archived",
    archivedAt,
    archivedBy
});
assert.deepEqual({
    id: mutableReport.id,
    createdAt: mutableReport.createdAt,
    createdBy: mutableReport.createdBy,
    filters: mutableReport.filters,
    distribution: mutableReport.distribution,
    students: mutableReport.students,
    records: mutableReport.records
}, untouchedFields);

restoreReport(mutableReport);
assert.equal(mutableReport.status, "active");
assert.equal(Object.hasOwn(mutableReport, "archivedAt"), false);
assert.equal(Object.hasOwn(mutableReport, "archivedBy"), false);
assert.deepEqual(reportMetadata(mutableReport), mutableReportBefore);
assert.deepEqual({
    id: mutableReport.id,
    createdAt: mutableReport.createdAt,
    createdBy: mutableReport.createdBy,
    filters: mutableReport.filters,
    distribution: mutableReport.distribution,
    students: mutableReport.students,
    records: mutableReport.records
}, untouchedFields);

const historicalReport = { ...JSON.parse(JSON.stringify(activeReport)) };
delete historicalReport.status;
archiveReport(historicalReport, { archivedAt, archivedBy });
assert.equal(historicalReport.status, "archived");
assert.equal(historicalReport.archivedAt, archivedAt);
assert.equal(historicalReport.archivedBy, archivedBy);

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

require("./prueba_logica_aprendida");
console.log("OK: utilidades, dominio, correo, CSV y compatibilidad de datos validados.");
