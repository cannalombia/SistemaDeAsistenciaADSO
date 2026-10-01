const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Expone funciones locales solo en la copia evaluada en pruebas: el navegador
// conserva su encapsulación y no recibe interfaces ni dependencias nuevas.
function cargarFunciones(archivo, nombres, document = {}) {
    const fuente = fs.readFileSync(path.join(__dirname, "../aplicacion/recursos/JS scripts", archivo), "utf8");
    const contexto = vm.createContext({ document });
    vm.runInContext(fuente.replace('"use strict";', `"use strict"; globalThis.funciones = { ${nombres.join(",")} }; return;`), contexto);
    return contexto.funciones;
}
const plano = (valor) => JSON.parse(JSON.stringify(valor));
const { contar_usuarios, filtrar_usuarios, buscar_usuario } = cargarFunciones("usuarios.js", ["contar_usuarios", "filtrar_usuarios", "buscar_usuario"]);
const usuarios = [
    { id: "1", role: "Instructor", name: "Ana", document: "123", email: "ana@example.com", username: "ana", status: "Inactivo" },
    { id: "2", role: "Aprendiz", name: "Luis", document: "456", email: "luis@example.com", username: "luis", status: "Activo" },
    { id: "3", role: "Administrador", name: "Sol", document: "789", email: "sol@example.com", username: "sol" }
];
const original = JSON.stringify(usuarios);
assert.deepEqual(plano(contar_usuarios([])), { total: 0, instructors: 0, students: 0 });
assert.deepEqual(plano(contar_usuarios(usuarios)), { total: 3, instructors: 1, students: 1 });
assert.equal(buscar_usuario(usuarios, "2"), usuarios[1]);
assert.equal(buscar_usuario(usuarios, "inexistente"), undefined);
assert.equal(buscar_usuario([], "1"), undefined);
assert.equal(buscar_usuario([usuarios[0], { ...usuarios[0] }], "1"), usuarios[0]);
assert.equal(filtrar_usuarios(usuarios, "Instructor", "ana")[0], usuarios[0]); // No excluir inactivos.
assert.equal(filtrar_usuarios(usuarios, "Aprendiz", "ana").length, 0);
assert.equal(filtrar_usuarios(usuarios, "all", "456")[0], usuarios[1]);
assert.equal(filtrar_usuarios(usuarios, "all", "EXAMPLE").length, 0); // La interfaz normaliza la consulta.
assert.equal(filtrar_usuarios(usuarios, "all", "").length, 3);
assert.equal(filtrar_usuarios([], "all", "").length, 0);
assert.equal(JSON.stringify(usuarios), original);

const { contar_estados } = cargarFunciones("asistencia.js", ["contar_estados"]);
assert.deepEqual(plano(contar_estados([])), { presente: 0, tardanza: 0, ausente: 0, justificado: 0 });
assert.deepEqual(plano(contar_estados(["presente", "tardanza", "presente", "ausente", "justificado", "desconocido"].map(estado => ({ estado })))), { presente: 2, tardanza: 1, ausente: 1, justificado: 1 });

const { calcular_extremos } = cargarFunciones("estadisticas.js", ["calcular_extremos"]);
for (const valores of [[], [4], [2, 2], [-9, -2, -5], [0, -0], [1.5, 9, -2, 9]]) {
    const extremos = calcular_extremos(valores);
    assert.equal(extremos.minimo, Math.min(...valores));
    assert.equal(extremos.maximo, Math.max(...valores));
}
const larga = Array.from({ length: 200000 }, (_, indice) => indice);
assert.equal(calcular_extremos(larga).maximo, 199999);

// Comprueba texto literal y conservación de selección sin interpretar HTML.
const document = { createElement: (tag) => ({ tag, value: "", textContent: "" }) };
const { programFilterOptions } = cargarFunciones("programas.js", ["programFilterOptions"], document);
const select = {
    value: "Técnico", children: [],
    set textContent(texto) { this.children = []; this.value = ""; },
    appendChild(opcion) { this.children.push(opcion); }
};
programFilterOptions(select, ["Técnico", "<b>&texto</b>"], "Todos");
assert.equal(select.value, "Técnico");
assert.deepEqual(select.children.map(opcion => opcion.textContent), ["Todos", "Técnico", "<b>&texto</b>"]);
programFilterOptions(select, [], "Todos");
assert.equal(select.value, "");
assert.equal(select.children.length, 1);
console.log("OK: lógica de usuarios, estados, extremos y opciones DOM; casos vacíos, búsqueda, selección y texto literal.");
