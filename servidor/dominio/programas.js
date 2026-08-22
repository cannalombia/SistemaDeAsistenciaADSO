function normalizeProgramText(value) {
    return String(value || "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function canonicalProgramStatus(value) {
    const statuses = {
        activo: "Activo",
        inactivo: "Inactivo",
        "en revision": "En revisión"
    };
    return statuses[normalizeProgramText(value)] || "";
}

function displayProgramLevel(value) {
    const source = String(value || "").trim();
    const levels = {
        tecnico: "Técnico",
        tecnologo: "Tecnólogo",
        especializacion: "Especialización"
    };
    return levels[normalizeProgramText(source)] || source;
}

function validateProgramInput(body, currentCode = "") {
    const code = String(body.code || currentCode || "").trim();
    const name = String(body.name || "").trim();
    const level = String(body.level || "").trim();
    const duration = String(body.duration || "").trim();
    const status = canonicalProgramStatus(body.status);
    if (!/^\d{1,12}$/.test(code) || !name || !level || !duration || !status) {
        throw Object.assign(new Error("Completa el código, nombre, nivel, duración y estado con valores válidos."), { status: 400 });
    }
    if (name.length > 160 || level.length > 60 || duration.length > 60) {
        throw Object.assign(new Error("El nombre, nivel o duración supera la longitud permitida."), { status: 400 });
    }
    return { code, name, level, duration, status };
}

module.exports = {
    normalizeProgramText,
    canonicalProgramStatus,
    displayProgramLevel,
    validateProgramInput
};
