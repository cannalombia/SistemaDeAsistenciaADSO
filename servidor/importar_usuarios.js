const fs = require("fs");
const path = require("path");
const { loadCsvUsers } = require("./modulos/persistencia");

const root = path.resolve(__dirname, "..");
const databaseFile = path.join(root, "datos", "aprendices.json");
function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}

function importUsers() {
    const csvUsers = loadCsvUsers();
    const existing = fs.existsSync(databaseFile)
        ? JSON.parse(fs.readFileSync(databaseFile, "utf8"))
        : [];
    const activeApprentices = csvUsers.filter((user) =>
        String(user.rol || "").trim().toLowerCase() === "aprendiz"
        && String(user.estado || "").trim().toLowerCase() === "activo"
    );

    const documents = new Set();
    const emails = new Set();
    const imported = activeApprentices.map((user) => {
        const email = normalizeEmail(user.correo);
        const document = String(user.identificacion || "").replace(/\D/g, "");
        if (!document || !email) throw new Error(`Registro incompleto para ${user.nombre || "aprendiz"}.`);
        if (documents.has(document)) throw new Error(`Cédula duplicada: ${document}.`);
        if (emails.has(email)) throw new Error(`Correo duplicado: ${email}.`);
        documents.add(document);
        emails.add(email);

        const previous = existing.find((item) => item.document === document || normalizeEmail(item.email) === email) || {};
        const ficha = String(user.ficha || previous.program?.ficha || "").trim();
        return {
            id: `aprendiz-${document}`,
            document,
            name: String(user.nombre || previous.name || "Aprendiz").trim(),
            email,
            phone: previous.phone || "",
            address: previous.address || "",
            role: "Aprendiz",
            program: {
                code: previous.program?.code || ficha,
                name: previous.program?.name || "Análisis y Desarrollo de Software",
                level: previous.program?.level || "Tecnólogo",
                ficha,
                schedule: previous.program?.schedule || "Por definir",
                mode: previous.program?.mode || "Presencial",
                status: previous.program?.status || "En formación"
            },
            attendance: Array.isArray(previous.attendance) ? previous.attendance : []
        };
    });

    const temporary = `${databaseFile}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(imported, null, 2)}\n`, "utf8");
    fs.renameSync(temporary, databaseFile);
    return {
        imported: imported.length,
        fichas: [...new Set(imported.map((item) => item.program.ficha))].sort()
    };
}

if (require.main === module) {
    try {
        const result = importUsers();
        console.log(`Importación completada: ${result.imported} aprendices activos.`);
        console.log(`Fichas: ${result.fichas.join(", ")}.`);
    } catch (error) {
        console.error(`La importación falló: ${error.message}`);
        process.exitCode = 1;
    }
}

module.exports = { importUsers };
