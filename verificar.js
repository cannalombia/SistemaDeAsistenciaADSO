const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const { dirname, join } = require("node:path");

const npmCli = process.env.npm_execpath || join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");

if (!existsSync(npmCli)) {
  console.error("No fue posible localizar npm para ejecutar la verificación.");
  process.exit(1);
}

const proceso = spawn(process.execPath, [npmCli, "test"], {
  cwd: __dirname,
  stdio: "inherit",
  shell: false
});

proceso.on("error", (error) => {
  console.error(`No fue posible iniciar la verificación: ${error.message}`);
  process.exit(1);
});

proceso.on("exit", (codigo, senal) => {
  if (senal) {
    console.error(`La verificación terminó por la señal ${senal}.`);
    process.exit(1);
  }

  process.exit(codigo ?? 1);
});
