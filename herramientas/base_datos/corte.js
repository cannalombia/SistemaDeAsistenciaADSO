const { loadEnv } = require("./comun");
const { validateDatabaseEnv } = require("../../servidor/base_datos/configuracion");
const { createDatabasePool, checkDatabase } = require("../../servidor/base_datos/conexion");
const { assertMigrationsCurrent } = require("../../servidor/base_datos/migraciones");
const { createMysqlRepository } = require("../../servidor/base_datos/repositorio");
const { loadLegacyState, compareStates, validateRelations } = require("../../servidor/base_datos/legado");

(async () => {
    loadEnv();
    const activate = process.argv.includes("--activate");
    const validateOnly = process.argv.includes("--validate-only");
    const config = validateDatabaseEnv({ ...process.env, DATA_SOURCE: "mysql" }, { test: process.env.NODE_ENV === "test" });
    const pool = createDatabasePool(config, { migrations: true });
    try {
        await checkDatabase(pool);
        await assertMigrationsCurrent(pool);
        const repository = createMysqlRepository(pool);
        const legacy = loadLegacyState();
        const errors = validateRelations(legacy);
        if (errors.length) throw new Error(`Los archivos de origen tienen relaciones inválidas:\n- ${errors.join("\n- ")}`);
        if (!validateOnly) await repository.saveSnapshot(legacy);
        const comparison = compareStates(legacy, await repository.loadState());
        console.log(JSON.stringify(comparison, null, 2));
        if (!comparison.ok) throw new Error("La comparación falló. MySQL NO fue activado.");
        if (activate) {
            await repository.activate();
            console.log("VALIDACIÓN CORRECTA: MySQL quedó marcado como fuente definitiva.");
        } else {
            console.log("Validación correcta. MySQL aún NO está activo; usa --activate después de completar la lista funcional final.");
        }
    } finally { await pool.end(); }
})().catch((error) => { console.error(`ERROR DE CORTE: ${error.message}`); process.exitCode = 1; });
