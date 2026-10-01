const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { validateDatabaseEnv } = require("../servidor/base_datos/configuracion");
const { compareStates, validateRelations } = require("../servidor/base_datos/legado");
const { migrationFiles } = require("../servidor/base_datos/migraciones");

assert.deepEqual(validateDatabaseEnv({ DATA_SOURCE: "legacy" }), { source: "legacy" });
assert.throws(() => validateDatabaseEnv({ DATA_SOURCE: "mysql" }), /Faltan variables/);
assert.throws(() => validateDatabaseEnv({ DATA_SOURCE: "mysql", DB_HOST: "localhost", DB_PORT: "3306", DB_USER: "root", DB_PASSWORD: "x", DB_NAME: "real" }), /root/);
assert.throws(() => validateDatabaseEnv({ DATA_SOURCE: "mysql", DB_HOST: "localhost", DB_PORT: "3306", DB_USER: "app", DB_PASSWORD: "x", DB_NAME: "real", DB_NAME_TEST: "real", NODE_ENV: "test" }), /diferente/);
assert.throws(() => validateDatabaseEnv({ DATA_SOURCE: "mysql", DB_HOST: "localhost", DB_PORT: "3306", DB_USER: "app", DB_PASSWORD: "x", DB_NAME: "real" }, { migrations: true }), /DB_MIGRATION_USER/);

const state = { users: [{ identificacion: "1", rol: "Aprendiz", ficha: "10" }], apprentices: [], managedUsers: [], attendance: [], programs: [{ id: 1 }], reports: [], audit: [], excuses: [], training: { fichas: [{ id: 1, numero: 10, programaId: 1 }], horarios: [{ id: 1, fichaId: 1, ambienteId: 1 }], ambientes: [{ id: 1 }] } };
assert.deepEqual(validateRelations(state), []);
assert.equal(compareStates(state, JSON.parse(JSON.stringify(state))).ok, true);
const broken = JSON.parse(JSON.stringify(state)); broken.training.horarios[0].ambienteId = 999;
assert.equal(compareStates(state, broken).ok, false);

const migrations = migrationFiles();
assert.ok(migrations.length >= 1);
assert.match(migrations[0].up, /DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci/);
assert.match(migrations[0].up, /ON UPDATE CASCADE ON DELETE RESTRICT/);
assert.match(migrations[0].up, /idx_attendance_lookup/);
assert.ok(fs.existsSync(path.join(__dirname, "..", "base_datos", "migraciones", "001_esquema_aplicacion.down.sql")));
console.log("OK: configuración, validación comparativa, relaciones y migraciones MySQL.");
