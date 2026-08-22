const fs = require("fs");
const path = require("path");
const rutas = require("../configuracion/rutas");

function readJsonFile(file, fallback) {
    if (!file || !fs.existsSync(file)) return fallback;
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (_error) {
        return fallback;
    }
}

function writeJsonFileAtomic(file, value) {
    if (!file) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.renameSync(temporary, file);
}

function ensureOperationalFile(file, exampleFile, fallback = "") {
    if (!file || fs.existsSync(file)) return false;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (exampleFile && fs.existsSync(exampleFile)) fs.copyFileSync(exampleFile, file);
    else fs.writeFileSync(file, fallback, "utf8");
    return true;
}

function detectCsvDelimiter(text) {
    const header = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] || "";
    const semicolons = (header.match(/;/g) || []).length;
    const commas = (header.match(/,/g) || []).length;
    return semicolons >= commas ? ";" : ",";
}

function parseDelimitedCsv(text, delimiter = detectCsvDelimiter(text)) {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;
    const source = String(text || "").replace(/^\uFEFF/, "");
    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];
        if (character === '"') {
            if (quoted && source[index + 1] === '"') {
                value += '"';
                index += 1;
            } else {
                quoted = !quoted;
            }
        } else if (character === delimiter && !quoted) {
            row.push(value.trim());
            value = "";
        } else if ((character === "\n" || character === "\r") && !quoted) {
            if (character === "\r" && source[index + 1] === "\n") index += 1;
            row.push(value.trim());
            if (row.some(Boolean)) rows.push(row);
            row = [];
            value = "";
        } else {
            value += character;
        }
    }
    if (value || row.length) {
        row.push(value.trim());
        if (row.some(Boolean)) rows.push(row);
    }
    if (!rows.length) return [];
    const headers = rows.shift().map((header) => header.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s-]+/g, "_"));
    return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function parseSemicolonCsv(text) {
    return parseDelimitedCsv(text, ";");
}

function serializeCsvUsers(users) {
    const headers = ["identificacion", "tipo_documento", "nombre", "correo", "rol", "estado", "ficha"];
    const escape = (value) => {
        const text = String(value ?? "").replace(/\r?\n/g, " ").trim();
        return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    };
    return `${[headers, ...users.map((user) => headers.map((header) => user[header] || ""))]
        .map((row) => row.map(escape).join(";"))
        .join("\n")}\n`;
}

function loadCsvUsers(file = rutas.usuariosCsv) {
    if (!fs.existsSync(file)) return [];
    return parseSemicolonCsv(fs.readFileSync(file, "utf8"));
}

function parseSqlValueRows(valueSource) {
    const rows = [];
    let row = null;
    let value = "";
    let quoted = false;
    for (let index = 0; index < valueSource.length; index += 1) {
        const character = valueSource[index];
        if (character === "'" && quoted && valueSource[index + 1] === "'") {
            value += "'";
            index += 1;
        } else if (character === "'") {
            quoted = !quoted;
        } else if (!quoted && character === "(") {
            row = [];
            value = "";
        } else if (!quoted && character === "," && row) {
            row.push(value.trim());
            value = "";
        } else if (!quoted && character === ")" && row) {
            row.push(value.trim());
            rows.push(row.map((item) => {
                if (/^NULL$/i.test(item)) return null;
                return /^-?\d+(?:\.\d+)?$/.test(item) ? Number(item) : item;
            }));
            row = null;
            value = "";
        } else if (row) {
            value += character;
        }
    }
    return rows;
}

function loadSqlTable(tableName, columns, file = rutas.estructuraSql) {
    if (!fs.existsSync(file)) return [];
    const source = fs.readFileSync(file, "utf8");
    const match = source.match(new RegExp("INSERT INTO `" + tableName + "` VALUES ([\\s\\S]*?);", "i"));
    if (!match) return [];
    return parseSqlValueRows(match[1]).map((values) => Object.fromEntries(columns.map((column, index) => [column, values[index] ?? null])));
}

function normalizeSqlText(value) {
    return String(value || "")
        .replaceAll("Ma?ana", "Mañana")
        .replaceAll("Mi?rcoles", "Miércoles");
}

module.exports = {
    readJsonFile,
    writeJsonFileAtomic,
    ensureOperationalFile,
    detectCsvDelimiter,
    parseDelimitedCsv,
    parseSemicolonCsv,
    serializeCsvUsers,
    loadCsvUsers,
    loadSqlTable,
    normalizeSqlText
};
