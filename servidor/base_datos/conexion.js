const mysql = require("mysql2/promise");

function createDatabasePool(config, { migrations = false } = {}) {
    const pool = mysql.createPool({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        waitForConnections: true,
        connectionLimit: config.connectionLimit,
        queueLimit: 0,
        charset: "utf8mb4_unicode_ci",
        timezone: "Z",
        dateStrings: true,
        multipleStatements: migrations
    });
    pool.on("connection", (connection) => {
        connection.query("SET time_zone = '+00:00'");
        connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    });
    return pool;
}

async function checkDatabase(pool) {
    const started = Date.now();
    const connection = await pool.getConnection();
    try {
        await connection.query("SET time_zone = '+00:00'");
        await connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
        const [rows] = await connection.query("SELECT 1 AS ok, @@character_set_connection AS charset, @@collation_connection AS collation, @@session.time_zone AS timezone");
        const status = rows[0] || {};
        if (status.charset !== "utf8mb4" || status.collation !== "utf8mb4_unicode_ci" || status.timezone !== "+00:00") throw new Error(`MySQL negoció ${status.charset || "charset desconocido"}/${status.collation || "collation desconocida"}/${status.timezone || "zona desconocida"}; se requiere utf8mb4/utf8mb4_unicode_ci/+00:00.`);
        return { ready: status.ok === 1, latencyMs: Date.now() - started, charset: status.charset, collation: status.collation, timezone: status.timezone };
    } finally { connection.release(); }
}

module.exports = { createDatabasePool, checkDatabase };
