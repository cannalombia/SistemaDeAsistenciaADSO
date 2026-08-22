const { normalizeEmail } = require("../modulos/utilidades");

function canonicalRole(value) {
    const roles = {
        administrador: "Administrador",
        instructor: "Instructor",
        aprendiz: "Aprendiz",
        coordinador: "Coordinador"
    };
    return roles[String(value || "").trim().toLowerCase()] || "Usuario";
}

function canonicalUserStatus(value) {
    const statuses = { activo: "Activo", inactivo: "Inactivo" };
    return statuses[String(value || "").trim().toLowerCase()] || "";
}

function csvValue(row, ...names) {
    for (const name of names) {
        const value = row[name];
        if (value !== undefined && String(value).trim()) return String(value).trim();
    }
    return "";
}

function registryRowFromUser(user) {
    return {
        identificacion: String(user.document || "").trim(),
        tipo_documento: String(user.documentType || "Cédula de Ciudadanía").trim(),
        nombre: String(user.name || "").trim(),
        correo: normalizeEmail(user.email),
        rol: canonicalRole(user.role).toLowerCase(),
        estado: (canonicalUserStatus(user.status) || "Activo").toLowerCase(),
        ficha: String(user.ficha || "").trim()
    };
}

module.exports = { canonicalRole, canonicalUserStatus, csvValue, registryRowFromUser };
