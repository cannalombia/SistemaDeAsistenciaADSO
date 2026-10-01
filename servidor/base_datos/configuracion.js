const REQUIRED_MYSQL_KEYS = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"];

function validateDatabaseEnv(env = process.env, { test = env.NODE_ENV === "test", migrations = false } = {}) {
    const source = String(env.DATA_SOURCE || "legacy").trim().toLowerCase();
    if (!["legacy", "mysql"].includes(source)) {
        throw new Error("DATA_SOURCE debe ser 'legacy' o 'mysql'.");
    }
    if (source === "legacy") return { source };
    const missing = REQUIRED_MYSQL_KEYS.filter((key) => !String(env[key] || "").trim());
    if (missing.length) throw new Error(`Faltan variables MySQL obligatorias: ${missing.join(", ")}.`);
    const user = String((migrations ? env.DB_MIGRATION_USER : env.DB_USER) || "").trim();
    const password = String((migrations ? env.DB_MIGRATION_PASSWORD : env.DB_PASSWORD) || "");
    if (migrations && (!user || !password)) throw new Error("DB_MIGRATION_USER y DB_MIGRATION_PASSWORD son obligatorios para cambiar el esquema.");
    if (!migrations && user.toLowerCase() === "root") throw new Error("DB_USER no puede ser root. Usa el usuario exclusivo de la aplicación con permisos mínimos.");
    const port = Number(env.DB_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("DB_PORT debe ser un puerto válido.");
    const database = test ? String(env.DB_NAME_TEST || "").trim() : String(env.DB_NAME).trim();
    if (test && !database) throw new Error("DB_NAME_TEST es obligatorio al ejecutar pruebas con MySQL.");
    if (test && database === String(env.DB_NAME).trim()) throw new Error("DB_NAME_TEST debe ser diferente de DB_NAME para proteger la base real.");
    return {
        source, host: String(env.DB_HOST).trim(), port, user,
        password, database,
        connectionLimit: Math.max(2, Math.min(20, Number(env.DB_POOL_SIZE) || 10))
    };
}

module.exports = { validateDatabaseEnv, REQUIRED_MYSQL_KEYS };
