const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const rutas = require("../configuracion/rutas");
const { readJsonFile, loadCsvUsers, loadSqlTable } = require("../modulos/persistencia");

const clone = (value) => JSON.parse(JSON.stringify(value));

function loadLegacyState() {
    const trainingFile = path.join(rutas.datos, "formacion.json");
    const training = readJsonFile(trainingFile, null) || {
        fichas: loadSqlTable("fichas", ["id", "numero", "jornada", "modalidad", "estado", "programaId", "instructorId"]),
        horarios: loadSqlTable("horarios", ["id", "dia", "horaInicio", "horaFin", "fichaId", "ambienteId", "instructorId"]),
        ambientes: loadSqlTable("ambientes", ["id", "codigo", "nombre", "capacidad", "tipo", "estado", "zona"])
    };
    const programsFile = path.join(rutas.datos, "programas.json");
    const programs = fs.existsSync(programsFile)
        ? readJsonFile(programsFile, [])
        : loadSqlTable("programas", ["id", "nombre", "nivel", "duracion", "estado"]);
    return clone({
        users: loadCsvUsers(rutas.usuariosCsv),
        apprentices: readJsonFile(path.join(rutas.datos, "aprendices.json"), []),
        managedUsers: readJsonFile(path.join(rutas.datos, "usuarios_gestionados.json"), []),
        attendance: readJsonFile(path.join(rutas.datos, "asistencia.json"), []),
        programs,
        training,
        reports: readJsonFile(path.join(rutas.datos, "reportes_estadisticas.json"), []),
        audit: readJsonFile(path.join(rutas.datos, "auditoria.json"), []),
        excuses: readJsonFile(path.join(rutas.datos, "excusas.json"), [])
    });
}

const stable = (value) => {
    if (Array.isArray(value)) return value.map(stable).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
};
const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");

function validateRelations(state) {
    const errors = [];
    const programIds = new Set(state.programs.map((item) => String(item.id)));
    const fichaIds = new Set(state.training.fichas.map((item) => String(item.id)));
    const fichaNumbers = new Set(state.training.fichas.map((item) => String(item.numero)));
    const environmentIds = new Set(state.training.ambientes.map((item) => String(item.id)));
    for (const ficha of state.training.fichas) if (!programIds.has(String(ficha.programaId))) errors.push(`Ficha ${ficha.numero} referencia programa inexistente ${ficha.programaId}.`);
    for (const schedule of state.training.horarios) {
        if (!fichaIds.has(String(schedule.fichaId))) errors.push(`Horario ${schedule.id} referencia ficha inexistente ${schedule.fichaId}.`);
        if (!environmentIds.has(String(schedule.ambienteId))) errors.push(`Horario ${schedule.id} referencia ambiente inexistente ${schedule.ambienteId}.`);
    }
    for (const user of state.users) if (String(user.rol).toLowerCase() === "aprendiz" && user.ficha && !fichaNumbers.has(String(user.ficha))) errors.push(`Usuario ${user.identificacion} referencia ficha inexistente ${user.ficha}.`);
    return errors;
}

function compareStates(legacy, mysql) {
    const collections = {
        users: [legacy.users, mysql.users], apprentices: [legacy.apprentices, mysql.apprentices],
        managedUsers: [legacy.managedUsers, mysql.managedUsers], attendance: [legacy.attendance, mysql.attendance],
        programs: [legacy.programs, mysql.programs], fichas: [legacy.training.fichas, mysql.training.fichas],
        schedules: [legacy.training.horarios, mysql.training.horarios], environments: [legacy.training.ambientes, mysql.training.ambientes],
        reports: [legacy.reports, mysql.reports], audit: [legacy.audit, mysql.audit], excuses: [legacy.excuses || [], mysql.excuses || []]
    };
    const counts = {};
    const differences = [];
    for (const [name, [left, right]] of Object.entries(collections)) {
        counts[name] = { legacy: left.length, mysql: right.length };
        if (left.length !== right.length) differences.push(`${name}: ${left.length} en archivos y ${right.length} en MySQL.`);
        else if (digest(left) !== digest(right)) differences.push(`${name}: mismo conteo, pero contenido diferente.`);
    }
    const legacyRoles = Object.groupBy ? Object.groupBy(legacy.users, (item) => String(item.rol || "")) : null;
    const mysqlRoles = Object.groupBy ? Object.groupBy(mysql.users, (item) => String(item.rol || "")) : null;
    const relationErrors = [...validateRelations(legacy), ...validateRelations(mysql).map((item) => `MySQL: ${item}`)];
    return { ok: differences.length === 0 && relationErrors.length === 0, counts, differences, relationErrors, roleCounts: { legacy: roleCounts(legacy.users), mysql: roleCounts(mysql.users) } };
}

function roleCounts(users) {
    return users.reduce((result, item) => {
        const role = String(item.rol || item.role || "Sin rol");
        result[role] = (result[role] || 0) + 1;
        return result;
    }, {});
}

module.exports = { loadLegacyState, validateRelations, compareStates, digest };
