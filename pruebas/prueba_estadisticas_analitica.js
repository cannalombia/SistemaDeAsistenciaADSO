"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const analytics = require(path.join(__dirname, "..", "aplicacion", "recursos", "JS scripts", "estadisticas_analitica.js"));

const base = [
    { ficha: "3349881", programa: "ADSO", attendance: 80, total: 10, counts: { presente: 8, tardanza: 1, ausente: 1, justificado: 0 }, percentages: { presente: 80, tardanza: 10, ausente: 10, justificado: 0 } },
    { ficha: "3349882", programa: "Contabilidad", attendance: 92, total: 13, counts: { presente: 12, tardanza: 0, ausente: 1, justificado: 0 }, percentages: { presente: 92.3, tardanza: 0, ausente: 7.7, justificado: 0 } },
    { ficha: "3349883", programa: "Gestión", attendance: 65, total: 14, counts: { presente: 6, tardanza: 4, ausente: 3, justificado: 1 }, percentages: { presente: 42.9, tardanza: 28.6, ausente: 21.4, justificado: 7.1 } },
    { ficha: "3349884", programa: "Sistemas", attendance: 88, total: 11, counts: { presente: 9, tardanza: 2, ausente: 0, justificado: 0 }, percentages: { presente: 81.8, tardanza: 18.2, ausente: 0, justificado: 0 } },
    { ficha: "3349885", programa: "Logística", attendance: 75, total: 12, counts: { presente: 7, tardanza: 1, ausente: 4, justificado: 0 }, percentages: { presente: 58.3, tardanza: 8.3, ausente: 33.4, justificado: 0 } },
    { ficha: "3349886", programa: "Multimedia", attendance: 84, total: 15, counts: { presente: 10, tardanza: 3, ausente: 2, justificado: 0 }, percentages: { presente: 66.7, tardanza: 20, ausente: 13.3, justificado: 0 } },
    { ficha: "3349887", programa: "Mercadeo", attendance: 71, total: 14, counts: { presente: 7, tardanza: 5, ausente: 2, justificado: 0 }, percentages: { presente: 50, tardanza: 35.7, ausente: 14.3, justificado: 0 } },
    { ficha: "3349888", programa: "Talento humano", attendance: 90, total: 13, counts: { presente: 11, tardanza: 1, ausente: 1, justificado: 0 }, percentages: { presente: 84.6, tardanza: 7.7, ausente: 7.7, justificado: 0 } }
];

assert.deepEqual(analytics.sortComposition(base, "attendance-desc").slice(0, 3).map((item) => item.ficha), ["3349882", "3349888", "3349884"], "Debe ordenar por mayor asistencia.");
assert.deepEqual(analytics.sortComposition(base, "attendance-asc").slice(0, 2).map((item) => item.ficha), ["3349883", "3349887"], "Debe ordenar por menor asistencia.");
assert.equal(analytics.sortComposition(base, "absences")[0].ficha, "3349885", "Debe priorizar la ficha con más ausencias.");
assert.equal(analytics.sortComposition(base, "tardiness")[0].ficha, "3349887", "Debe priorizar la ficha con más tardanzas.");
assert.equal(analytics.sortComposition(base, "attendance-desc", "ausente")[0].ficha, "3349885", "La selección de estado debe ordenar por ese estado antes del criterio secundario.");
assert.equal(analytics.limitComposition(base, "5").length, 5, "Top 5 debe limitar cinco fichas.");
assert.equal(analytics.limitComposition(base, "10").length, 8, "Top 10 no debe inventar filas si hay menos fichas.");
assert.equal(analytics.limitComposition(base, "all").length, 8, "Todas debe conservar las ocho fichas.");
assert.equal(analytics.nearestIndex(50, 0, 100, 5), 2, "La captura de puntero debe elegir el punto más cercano.");
assert.equal(analytics.nearestIndex(-50, 0, 100, 5), 0, "El índice de puntero debe limitarse al inicio.");
assert.equal(analytics.nearestIndex(200, 0, 100, 5), 4, "El índice de puntero debe limitarse al final.");

function classList() {
    const values = new Set();
    return {
        add(...names) { names.forEach((name) => values.add(name)); },
        remove(...names) { names.forEach((name) => values.delete(name)); },
        toggle(name, force) {
            if (force === true) { values.add(name); return true; }
            if (force === false) { values.delete(name); return false; }
            if (values.has(name)) { values.delete(name); return false; }
            values.add(name); return true;
        },
        contains(name) { return values.has(name); }
    };
}

function element(id = "") {
    const listeners = new Map();
    const attributes = new Map();
    const node = {
        id,
        value: "",
        hidden: false,
        textContent: "",
        className: "",
        classList: classList(),
        dataset: {},
        style: { setProperty() {}, removeProperty() {}, left: "", top: "", width: "" },
        children: [],
        clientWidth: 760,
        scrollLeft: 0,
        type: "",
        title: "",
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        removeEventListener(type, handler) {
            listeners.set(type, (listeners.get(type) || []).filter((item) => item !== handler));
        },
        emit(type, event = {}) {
            for (const handler of [...(listeners.get(type) || [])]) handler({ target: node, preventDefault() {}, clientX: 100, clientY: 100, key: "", ...event });
        },
        append(...children) { node.children.push(...children); },
        replaceChildren(...children) { node.children = [...children]; },
        setAttribute(name, value) {
            attributes.set(name, String(value));
            if (name.startsWith("data-")) node.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
        },
        getAttribute(name) { return attributes.get(name) ?? null; },
        getBoundingClientRect() { return { left: 0, top: 0, width: node.clientWidth, height: 300 }; },
        closest(selector) {
            if (selector === "[data-status]" && node.dataset.status) return node;
            if (selector === "[data-ficha]" && node.dataset.ficha) return node;
            if (selector === "[data-clear-selection]" && node.dataset.clearSelection) return node;
            return null;
        },
        click() { node.emit("click"); }
    };
    return node;
}

const ids = [
    "daily-chart", "daily-tooltip", "chart-detail", "statistics-donut", "statistics-distribution",
    "dashboard-composition", "composition-count", "dashboard-composition-limit", "dashboard-composition-sort",
    "analytics-selection-bar", "analytics-selection-chips", "analytics-clear-selection"
];
const elements = Object.fromEntries(ids.map((id) => [id, element(id)]));
elements["dashboard-composition-limit"].value = "5";
elements["dashboard-composition-sort"].value = "attendance-desc";

const windowListeners = new Map();
const documentListeners = new Map();
const documentObject = {
    getElementById(id) { return elements[id] || null; },
    createElement() { return element(); },
    createElementNS() { return element(); },
    querySelectorAll(selector) { return selector === ".analytics-module" ? [element(), element(), element()] : []; },
    addEventListener(type, handler) {
        if (!documentListeners.has(type)) documentListeners.set(type, []);
        documentListeners.get(type).push(handler);
    }
};
const windowObject = {
    document: documentObject,
    matchMedia() { return { matches: false }; },
    requestAnimationFrame(callback) { callback(); return 1; },
    cancelAnimationFrame() {},
    addEventListener(type, handler) {
        if (!windowListeners.has(type)) windowListeners.set(type, []);
        windowListeners.get(type).push(handler);
    },
    SenaDashboard: { selectFicha() { return Promise.resolve(); } }
};

analytics.mount(windowObject);
const timeline = [
    { date: "2026-10-02", percentage: 80, attendance: 80, total: 10, counts: { presente: 8, tardanza: 1, ausente: 1, justificado: 0 } },
    { date: "2026-10-03", percentage: null, attendance: 0, total: 0, counts: { presente: 0, tardanza: 0, ausente: 0, justificado: 0 } },
    { date: "2026-10-04", percentage: 90, attendance: 90, total: 10, counts: { presente: 9, tardanza: 0, ausente: 1, justificado: 0 } }
];
const distribution = { total: 20, attendance: 85, counts: { presente: 17, tardanza: 1, ausente: 2, justificado: 0 }, percentages: { presente: 85, tardanza: 5, ausente: 10, justificado: 0 } };
for (const handler of windowListeners.get("dashboard:data") || []) handler({ detail: { filters: { ficha: "" }, timeline, distribution, composition: base } });

assert.ok(elements["daily-chart"].children.length > 0, "El SVG de evolución debe renderizarse con datos reales del payload.");
assert.ok(elements["statistics-donut"].children.length > 0, "El donut debe renderizarse con la distribución recibida.");
assert.equal(elements["statistics-distribution"].children.length, 4, "La leyenda interactiva debe mostrar los cuatro estados semánticos.");
assert.equal(elements["dashboard-composition"].children.length, 5, "La vista inicial Top 5 debe mostrar cinco fichas.");
assert.match(elements["composition-count"].textContent, /8 fichas con registros/, "Debe conservar el total real de fichas aunque muestre Top 5.");

console.log("OK: orden, límites, navegación y renderizado base de la analítica validados.");
