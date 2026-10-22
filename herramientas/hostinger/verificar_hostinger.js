const fs = require("fs");
const path = require("path");

function cargar_env() {
    const ruta_env = path.join(process.cwd(), ".env");

    if (!fs.existsSync(ruta_env)) {
        console.log("AVISO: No se encontro el archivo .env");
        return;
    }

    const contenido = fs.readFileSync(ruta_env, "utf8");
    const lineas = contenido.split(/\r?\n/);

    for (const linea of lineas) {
        const texto = linea.trim();

        if (!texto || texto.startsWith("#")) {
            continue;
        }

        const posicion = texto.indexOf("=");

        if (posicion === -1) {
            continue;
        }

        const clave = texto.slice(0, posicion).trim();
        const valor = texto.slice(posicion + 1).trim();

        if (!process.env[clave]) {
            process.env[clave] = valor;
        }
    }
}

function valor_activo(valor) {
    return ["1", "true", "yes", "si"].includes(
        String(valor || "").toLowerCase()
    );
}

function comprobar(nombre, condicion, mensaje) {
    if (condicion) {
        console.log(`OK   ${nombre}`);
        return 0;
    }

    console.log(`FAIL ${nombre}: ${mensaje}`);
    return 1;
}

cargar_env();

console.log("");
console.log("======================================");
console.log(" VERIFICACION PARA PRODUCCION");
console.log("======================================");
console.log("");

let fallos = 0;

fallos += comprobar(
    "NODE_ENV",
    process.env.NODE_ENV === "production",
    "debe ser production"
);

fallos += comprobar(
    "DATA_SOURCE",
    process.env.DATA_SOURCE === "mysql",
    "debe utilizar mysql"
);

const public_url = process.env.PUBLIC_URL || "";

fallos += comprobar(
    "PUBLIC_URL",
    public_url.startsWith("https://") &&
        !public_url.includes("localhost") &&
        !public_url.includes("127.0.0.1") &&
        !public_url.includes(".lhr.life"),
    "debe ser el dominio HTTPS definitivo"
);

fallos += comprobar(
    "COOKIE_SECURE",
    valor_activo(process.env.COOKIE_SECURE),
    "debe estar activado en produccion"
);

fallos += comprobar(
    "TRUST_PROXY",
    valor_activo(process.env.TRUST_PROXY),
    "debe estar activado detras del proxy del hosting"
);

fallos += comprobar(
    "DB_HOST",
    Boolean(process.env.DB_HOST),
    "falta configurar el servidor MySQL"
);

fallos += comprobar(
    "DB_NAME",
    Boolean(process.env.DB_NAME),
    "falta configurar el nombre de la base de datos"
);

fallos += comprobar(
    "DB_USER",
    Boolean(process.env.DB_USER),
    "falta configurar el usuario MySQL"
);

fallos += comprobar(
    "DB_PASSWORD",
    Boolean(process.env.DB_PASSWORD),
    "falta configurar la contrasena MySQL"
);

if (valor_activo(process.env.BIOMETRIC_ENABLED)) {
    console.log(
        "AVISO: La biometria esta activa. Verificar comunicacion con el PC del lector."
    );
} else {
    console.log(
        "OK   BIOMETRIA: desactivada para el primer despliegue en hosting"
    );
}

console.log("");
console.log("======================================");

if (fallos === 0) {
    console.log("RESULTADO: LISTO PARA PRODUCCION");
    console.log("======================================");
    process.exit(0);
}

console.log(`RESULTADO: ${fallos} configuracion(es) pendiente(s)`);
console.log("======================================");
process.exit(1);