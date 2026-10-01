const { loadEnv } = require("./comun");
const { validateDatabaseEnv } = require("../../servidor/base_datos/configuracion");
const { createDatabasePool, checkDatabase } = require("../../servidor/base_datos/conexion");
const { migrateUp } = require("../../servidor/base_datos/migraciones");

(async () => {
    loadEnv();
    const config = validateDatabaseEnv({ ...process.env, DATA_SOURCE: "mysql" }, { test: process.env.NODE_ENV === "test", migrations: true });
    const pool = createDatabasePool(config, { migrations: true });
    try {
        await checkDatabase(pool);
        const applied = await migrateUp(pool);
        console.log(applied.length ? `Migraciones aplicadas: ${applied.join(", ")}` : "Esquema MySQL actualizado; no había migraciones pendientes.");
    } finally { await pool.end(); }
})().catch((error) => { console.error(`ERROR DE MIGRACIÓN: ${error.message}`); process.exitCode = 1; });
