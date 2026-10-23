#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = __dirname;
const checks = [];
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const add = (name, ok, detail = "") => checks.push({ name, ok: Boolean(ok), detail });
const run = (command, args) => execFileSync(command, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const section = (text, heading) => {
  const start = text.indexOf(`## ${heading}`);
  const end = text.indexOf("\n## ", start + 1);
  return start < 0 ? "" : text.slice(start, end < 0 ? undefined : end);
};
const acceptanceCriteria = (text) => text.match(/^\s*- \[[ xX]\] Dado\b.*\bcuando\b.*\bentonces\b.*$/gim) || [];

function frontMatter(text) {
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  return Object.fromEntries(match[1].split(/\r?\n/).map((line) => {
    const pair = line.match(/^(\w+):\s*(.*)$/);
    return pair ? [pair[1], pair[2].replace(/^['"]|['"]$/g, "")] : null;
  }).filter(Boolean));
}

for (const file of ["historia-de-usuario.md", "reporte-de-bug.md"]) {
  const relative = `.github/ISSUE_TEMPLATE/${file}`;
  const text = read(relative);
  const meta = frontMatter(text);
  add(`${relative}: name/about/labels validos`, meta.name && meta.about && meta.labels, "Completa el YAML de la plantilla.");
  add(`${relative}: sin TODO`, !/\bTODO\b/i.test(text), "Elimina marcadores pendientes.");
}
add("config.yml presente", fs.existsSync(path.join(root, ".github/ISSUE_TEMPLATE/config.yml")));

const backlog = read("planeacion/backlog.md");
for (let number = 1; number <= 6; number += 1) {
  const id = String(number).padStart(2, "0");
  const block = section(backlog, `HU-${id}`);
  const criteria = acceptanceCriteria(block);
  add(`HU-${id}: historia INVEST y 3 criterios`, Boolean(block) && /\*\*Historia:\*\* Como\b.*\bquiero\b.*\bpara\b/i.test(block) && criteria.length >= 3);
  add(`HU-${id}: numero real de issue`, /\*\*Issue:\*\* #\d+/.test(block), "Publica el issue y sincroniza el numero.");
}

const documentationStory = section(backlog, "DOC-01");
add("DOC-01: historia y 3 criterios", /\*\*Historia:\*\* Como\b.*\bquiero\b.*\bpara\b/i.test(documentationStory) && acceptanceCriteria(documentationStory).length >= 3);
add("DOC-01: issue #11 sincronizado", /\*\*Issue:\*\* #11\b/.test(documentationStory));

for (let number = 1; number <= 5; number += 1) {
  const id = String(number).padStart(2, "0");
  const block = section(backlog, `BUG-${id}`);
  add(`BUG-${id}: 3 criterios comprobables`, acceptanceCriteria(block).length >= 3);
}

for (const relative of [
  "AGENTS.md", "planeacion/etiquetas.md", "planeacion/incidencias.md",
  "planeacion/flujo_de_trabajo.md", "planeacion/historial_16_al_21_octubre.md",
  "ENTREGA.md", "RETO.md"
]) add(`${relative}: presente`, fs.existsSync(path.join(root, relative)));

const entrega = read("ENTREGA.md");
add("ENTREGA: repo real", /github\.com\/cannalombia\/SistemaDeAsistenciaADSO/.test(entrega));
add("ENTREGA: tablero real", /github\.com\/(users|orgs)\/[\w.-]+\/projects\/\d+/.test(entrega), "Sincroniza la URL creada por GitHub.");
add("Documentos sin marcadores de publicacion", !/(ISSUE_|PROJECT_URL|COMMIT_|TEST_\w+_RESULT)/.test(backlog + entrega + read("planeacion/incidencias.md")));

try {
  const status = run("git", ["status", "--porcelain"]);
  add("Repositorio Git detectado", true);
  const trackedSensitive = run("git", ["ls-files", ".env", "*.bio.json", "*.key", "datos/aprendices.json", "datos/asistencia.json"]);
  add("Sin secretos o biometria rastreados", trackedSensitive === "", trackedSensitive);
  add("Estado Git consultable", typeof status === "string");
} catch (error) {
  add("Repositorio Git detectado", false, error.message);
}

try {
  const auth = run("gh", ["auth", "status"]);
  const repo = JSON.parse(run("gh", ["repo", "view", "--json", "nameWithOwner,url"]));
  const issues = JSON.parse(run("gh", ["issue", "list", "--state", "all", "--limit", "100", "--json", "number,title,labels,assignees"]));
  const planned = issues.filter((issue) => /^(HU-0[1-6]|BUG-0[1-5]|DOC-01)\b/.test(issue.title));
  add("GitHub CLI autenticado", /Logged in|github\.com/i.test(auth));
  add("Remoto correcto en GitHub", repo.nameWithOwner === "cannalombia/SistemaDeAsistenciaADSO");
  add("6 HU, 5 bugs y DOC-01 reales", planned.filter((i) => /^HU-/.test(i.title)).length >= 6 && planned.filter((i) => /^BUG-/.test(i.title)).length >= 5 && planned.some((i) => /^DOC-01\b/.test(i.title)));
  add("Issues asignados y etiquetados", planned.length >= 12 && planned.every((i) => i.labels.length && i.assignees.length));
} catch (error) {
  add("Verificacion remota GitHub", false, "Autentica gh y publica antes de la entrega.");
}

let passed = 0;
for (const check of checks) {
  console.log(`${check.ok ? "OK" : "FALLO"} - ${check.name}${!check.ok && check.detail ? `: ${check.detail}` : ""}`);
  if (check.ok) passed += 1;
}
console.log(`\nResultado: ${passed}/${checks.length}`);
if (passed !== checks.length) process.exitCode = 1;
