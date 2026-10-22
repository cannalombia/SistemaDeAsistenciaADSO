"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const pages = path.join(root, "aplicacion", "paginas HTML");
const scripts = path.join(root, "aplicacion", "recursos", "JS scripts");
const styles = path.join(root, "aplicacion", "recursos", "estilos CCS");
const images = path.join(root, "aplicacion", "recursos", "imagenes");

const staffPages = [
    "estadisticas.html",
    "asistencia.html",
    "crear_usuario.html",
    "programa_formacion.html",
    "fichas.html",
    "horario.html",
    "ambiente.html",
    "ajustes.html"
];

for (const name of staffPages) {
    const html = fs.readFileSync(path.join(pages, name), "utf8");
    assert.match(html, /data-navegacion-principal/, `${name} debe usar la navegación lateral compartida.`);
    assert.match(html, /src="navegacion\.js"/, `${name} debe cargar navegacion.js.`);
}

const navigation = fs.readFileSync(path.join(scripts, "navegacion.js"), "utf8");
for (const [file, label] of [
    ["estadisticas.html", "Estadísticas"],
    ["asistencia.html", "Asistencia"],
    ["crear_usuario.html", "Crear usuario"],
    ["programa_formacion.html", "Programa de formación"],
    ["fichas.html", "Fichas"],
    ["horario.html", "Horario"],
    ["ambiente.html", "Ambientes"],
    ["ajustes.html", "Configuración"]
]) {
    assert.match(navigation, new RegExp(file.replace(".", "\\.")), `La navegación debe incluir ${label}.`);
}
assert.match(navigation, /class="logout"/, "La navegación debe conservar Cerrar sesión.");

const css = fs.readFileSync(path.join(styles, "navegacion_aprendiz.css"), "utf8");
assert.match(css, /sidebar_campus_20261008\.png/, "El sidebar debe usar el fondo vertical aprobado.");
assert.match(css, /\.menu a::after/, "Los módulos deben mostrar el indicador lateral de navegación.");
assert.match(css, /rgba\(61,195,235,.36\)/, "Los módulos deben conservar el borde tecnológico definido.");
assert.ok(fs.existsSync(path.join(images, "sidebar_campus_20261008.png")), "La imagen del fondo del sidebar debe viajar dentro del proyecto.");

const auth = fs.readFileSync(path.join(scripts, "autenticacion.js"), "utf8");
assert.match(auth, /logout-chevron/, "Cerrar sesión debe usar el mismo lenguaje visual de los módulos.");

console.log("OK: sidebar profesional aplicado de forma central a Estadísticas, Asistencia, Usuarios, Programas, Fichas, Horario, Ambientes y Configuración.");
