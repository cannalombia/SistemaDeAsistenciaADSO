"use strict";

const { loadEnv } = require("./base_datos/comun");
const { validateDatabaseEnv } = require("../servidor/base_datos/configuracion");
const { createDatabasePool, checkDatabase } = require("../servidor/base_datos/conexion");
const { assertMigrationsCurrent } = require("../servidor/base_datos/migraciones");

async function main() {
    loadEnv();
    const config = validateDatabaseEnv(process.env);
    if (config.source !== "mysql") {
        console.log("[OK] DATA_SOURCE=legacy: MySQL no es obligatorio para este arranque.");
        return;
    }
    const pool = createDatabasePool(config);
    try {
        const health = await checkDatabase(pool);
        await assertMigrationsCurrent(pool);
        console.log(`[OK] MySQL disponible en ${config.host}:${config.port}/${config.database} (${health.latencyMs} ms); migraciones vigentes.`);
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error(`[ERROR] MySQL no está listo: ${error.message}`);
    process.exitCode = 1;
});
