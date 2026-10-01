const fs = require("fs");
const path = require("path");
const { loadEnv } = require("./comun");
const { validateDatabaseEnv } = require("../../servidor/base_datos/configuracion");
const { createDatabasePool, checkDatabase } = require("../../servidor/base_datos/conexion");
const { migrateDown } = require("../../servidor/base_datos/migraciones");
const { createMysqlRepository } = require("../../servidor/base_datos/repositorio");
const { createBackup } = require("../../servidor/modulos/respaldo");

(async () => {
    loadEnv();
    if (!process.argv.includes("--confirm")) throw new Error("Rollback cancelado. Repite con --confirm tras detener el servidor.");
    const config = validateDatabaseEnv({ ...process.env, DATA_SOURCE: "mysql" }, { test: process.env.NODE_ENV === "test", migrations: true });
    const pool = createDatabasePool(config, { migrations: true });
    try {
        await checkDatabase(pool);
        const repository = createMysqlRepository(pool);
        const state = await repository.loadState();
        const directory = path.resolve(__dirname, "..", "..", "respaldos", "rollback");
        fs.mkdirSync(directory, { recursive: true });
        const name = `Pre_rollback_mysql_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        fs.writeFileSync(path.join(directory, name), `${JSON.stringify(createBackup(state), null, 2)}\n`, { encoding: "utf8", flag: "wx" });
        await repository.deactivate();
        const version = await migrateDown(pool, "001_esquema_aplicacion");
        console.log(`Respaldo creado: ${name}. Rollback aplicado: ${version || "no era necesario"}.`);
    } finally { await pool.end(); }
})().catch((error) => { console.error(`ERROR DE ROLLBACK: ${error.message}`); process.exitCode = 1; });
