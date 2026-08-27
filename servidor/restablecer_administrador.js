const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const projectRoot = path.resolve(__dirname, "..");
const credentialsFile = path.join(projectRoot, "datos", "credenciales_administrador.json");

function readHidden(prompt) {
    return new Promise((resolve, reject) => {
        const input = process.stdin;
        const output = process.stdout;
        if (!input.isTTY || typeof input.setRawMode !== "function") {
            reject(new Error("Ejecuta este comando desde una terminal interactiva de PowerShell o Visual Studio Code."));
            return;
        }

        let value = "";
        const previousRawMode = Boolean(input.isRaw);
        const finish = (error) => {
            input.removeListener("data", onData);
            input.setRawMode(previousRawMode);
            input.pause();
            output.write("\n");
            if (error) reject(error);
            else resolve(value);
        };
        const onData = (chunk) => {
            for (const character of String(chunk)) {
                if (character === "\u0003") return finish(new Error("Operación cancelada."));
                if (character === "\r" || character === "\n") return finish();
                if (character === "\b" || character === "\u007f") {
                    if (value) {
                        value = value.slice(0, -1);
                        output.write("\b \b");
                    }
                    continue;
                }
                if (character >= " " && character !== "\u001b") {
                    value += character;
                    output.write("*");
                }
            }
        };

        output.write(prompt);
        input.setEncoding("utf8");
        input.setRawMode(true);
        input.resume();
        input.on("data", onData);
    });
}

async function main() {
    const password = await readHidden("Nueva contraseña del administrador: ");
    if (password.length < 10) throw new Error("La contraseña debe tener al menos 10 caracteres.");
    const confirmation = await readHidden("Repite la nueva contraseña: ");
    if (password !== confirmation) throw new Error("Las contraseñas no coinciden.");

    const salt = crypto.randomBytes(24).toString("hex");
    const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");
    let previous = {};
    if (fs.existsSync(credentialsFile)) {
        try {
            previous = JSON.parse(fs.readFileSync(credentialsFile, "utf8"));
        } catch (_error) {
            previous = {};
        }
    }
    fs.mkdirSync(path.dirname(credentialsFile), { recursive: true });
    fs.writeFileSync(credentialsFile, `${JSON.stringify({
        username: "admin",
        salt,
        passwordHash,
        name: String(previous.name || "Administrador SENA"),
        email: String(previous.email || "admin@sena.edu.co"),
        updatedAt: new Date().toISOString()
    }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });

    console.log("Contraseña administrativa restablecida correctamente.");
    console.log("Reinicia el servidor con npm.cmd start para aplicar el cambio.");
}

main().catch((error) => {
    console.error(`No se pudo restablecer la contraseña: ${error.message}`);
    process.exitCode = 1;
});
