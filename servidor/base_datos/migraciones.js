const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const migrationsDirectory = path.join(__dirname, "..", "..", "base_datos", "migraciones");
const checksum = (source) => crypto.createHash("sha256").update(source).digest("hex");

function migrationFiles() {
    return fs.readdirSync(migrationsDirectory)
        .filter((name) => /^\d+_.+\.up\.sql$/.test(name))
        .sort()
        .map((name) => ({
            version: name.replace(/\.up\.sql$/, ""),
            up: fs.readFileSync(path.join(migrationsDirectory, name), "utf8"),
            down: fs.readFileSync(path.join(migrationsDirectory, name.replace(".up.sql", ".down.sql")), "utf8")
        }));
}

async function ensureMigrationTable(pool) {
    await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(100) NOT NULL PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

async function migrateUp(pool) {
    await ensureMigrationTable(pool);
    const [rows] = await pool.query("SELECT version, checksum FROM schema_migrations");
    const applied = new Map(rows.map((row) => [row.version, row.checksum]));
    const completed = [];
    for (const migration of migrationFiles()) {
        const expected = checksum(migration.up);
        if (applied.has(migration.version)) {
            if (applied.get(migration.version) !== expected) throw new Error(`La migración aplicada ${migration.version} fue modificada; restaura el archivo original.`);
            continue;
        }
        await pool.query(migration.up);
        await pool.execute("INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)", [migration.version, expected]);
        completed.push(migration.version);
    }
    return completed;
}

async function migrateDown(pool, version) {
    await ensureMigrationTable(pool);
    const migrations = migrationFiles();
    const selected = version ? migrations.find((item) => item.version === version) : migrations.at(-1);
    if (!selected) throw new Error("No se encontró la migración solicitada.");
    const [rows] = await pool.execute("SELECT version FROM schema_migrations WHERE version = ?", [selected.version]);
    if (!rows.length) return null;
    await pool.query(selected.down);
    await pool.execute("DELETE FROM schema_migrations WHERE version = ?", [selected.version]);
    return selected.version;
}

async function assertMigrationsCurrent(pool) {
    let rows;
    try { [rows] = await pool.query("SELECT version, checksum FROM schema_migrations"); }
    catch (_) { throw new Error("El esquema no está inicializado. Ejecuta npm run db:migrate con la cuenta de migraciones."); }
    const applied = new Map(rows.map((row) => [row.version, row.checksum]));
    for (const migration of migrationFiles()) {
        const expected = checksum(migration.up);
        if (!applied.has(migration.version)) throw new Error(`Falta la migración ${migration.version}. Ejecuta npm run db:migrate.`);
        if (applied.get(migration.version) !== expected) throw new Error(`La migración aplicada ${migration.version} no coincide con su archivo versionado.`);
    }
    return true;
}

module.exports = { migrateUp, migrateDown, assertMigrationsCurrent, migrationFiles, checksum };
