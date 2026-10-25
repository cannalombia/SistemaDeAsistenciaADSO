const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const verificador = path.join(
    __dirname,
    "..",
    "herramientas",
    "hostinger",
    "verificar_hostinger.js"
);

const carpeta_temporal = fs.mkdtempSync(
    path.join(os.tmpdir(), "hostinger-check-")
);

function ejecutar(cambios = {}) {
    const env = {
        ...process.env,
        NODE_ENV: "production",
        DATA_SOURCE: "mysql",
        PUBLIC_URL: "https://asistencia.example.com",
        COOKIE_SECURE: "1",
        TRUST_PROXY: "1",
        DB_HOST: "mysql.example.com",
        DB_PORT: "3306",
        DB_NAME: "sistema_asistencia_sena",
        DB_USER: "sena_app",
        DB_PASSWORD: "CLAVE_SECRETA_PRUEBA",
        DB_MIGRATION_USER: "sena_migrator",
        DB_MIGRATION_PASSWORD: "CLAVE_MIGRACION_PRUEBA",
        BIOMETRIC_ENABLED: "0",
        ...cambios
    };

    return spawnSync(process.execPath, [verificador], {
        cwd: carpeta_temporal,
        env,
        encoding: "utf8"
    });
}

try {
    const correcto = ejecutar();

    assert.equal(correcto.status, 0);

    assert.match(correcto.stdout, /OK\s+DB_HOST/);
    assert.match(correcto.stdout, /OK\s+DB_PORT/);
    assert.match(correcto.stdout, /OK\s+DB_NAME/);
    assert.match(correcto.stdout, /OK\s+DB_USER/);
    assert.match(correcto.stdout, /OK\s+DB_PASSWORD/);
    assert.match(correcto.stdout, /OK\s+DB_MIGRATION_USER/);
    assert.match(correcto.stdout, /OK\s+DB_MIGRATION_PASSWORD/);
    assert.match(correcto.stdout, /RESULTADO: LISTO PARA PRODUCCION/);

    assert.doesNotMatch(
        correcto.stdout,
        /CLAVE_SECRETA_PRUEBA/
    );

    assert.doesNotMatch(
        correcto.stdout,
        /CLAVE_MIGRACION_PRUEBA/
    );

    const puerto_invalido = ejecutar({
        DB_PORT: "puerto-invalido"
    });

    assert.equal(puerto_invalido.status, 1);
    assert.match(puerto_invalido.stdout, /FAIL DB_PORT/);

    console.log(
        "OK: verificador Hostinger valida MySQL sin exponer contrasenas."
    );
} finally {
    fs.rmSync(carpeta_temporal, {
        recursive: true,
        force: true
    });
}