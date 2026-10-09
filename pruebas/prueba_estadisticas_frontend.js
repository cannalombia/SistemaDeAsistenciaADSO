"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const statsSource = fs.readFileSync(path.join(root, "aplicacion", "recursos", "JS scripts", "estadisticas.js"), "utf8");
const bannerSource = fs.readFileSync(path.join(root, "aplicacion", "recursos", "JS scripts", "estadisticas_banner.js"), "utf8");
const statsHtml = fs.readFileSync(path.join(root, "aplicacion", "paginas HTML", "estadisticas.html"), "utf8");
const attendanceHtml = fs.readFileSync(path.join(root, "aplicacion", "paginas HTML", "asistencia.html"), "utf8");

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

function element(initial = {}) {
    const listeners = new Map();
    return {
        value: "",
        hidden: false,
        disabled: false,
        textContent: "",
        className: "",
        classList: classList(),
        style: { setProperty() {}, removeProperty() {} },
        children: [],
        ...initial,
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        removeEventListener(type, handler) {
            listeners.set(type, (listeners.get(type) || []).filter((item) => item !== handler));
        },
        dispatch(type) {
            for (const handler of [...(listeners.get(type) || [])]) handler({ type, target: this });
        },
        contains() { return false; },
        replaceChildren(...children) { this.children = children; this.textContent = ""; },
        append(...children) { this.children.push(...children); },
        getContext() { return null; }
    };
}

function payload(params, records = []) {
    const count = records.length;
    return {
        ok: true,
        filters: {
            from: params.get("from"),
            to: params.get("to"),
            period: params.get("period") || "custom",
            periods: [],
            ficha: params.get("ficha") || ""
        },
        summary: {
            apprentices: count ? 14 : 0,
            instructors: 1,
            fichas: count ? 1 : 0,
            environmentsAvailable: 1,
            environmentsTotal: 1,
            environmentOccupancy: 100,
            attendanceRecords: count,
            attendance: count ? 83.7 : 0,
            attendanceDelta: null
        },
        students: count ? [{ id: "1" }] : [],
        composition: count ? [{ ficha: "3349881", total: count, attendance: 83.7, counts: { presente: count, tardanza: 0, ausente: 0, justificado: 0 }, percentages: { presente: 100, tardanza: 0, ausente: 0, justificado: 0 } }] : [],
        trend: [],
        timeline: [],
        distribution: { total: count, attendance: count ? 83.7 : 0, counts: { presente: count, tardanza: 0, ausente: 0, justificado: 0 }, percentages: { presente: count ? 100 : 0, tardanza: 0, ausente: 0, justificado: 0 } },
        records
    };
}

function createHarness(fetchImpl) {
    const elements = {
        "dashboard-date-from": element(),
        "dashboard-date-to": element(),
        "dashboard-period": element({ value: "custom" }),
        "dashboard-loading": element({ hidden: true }),
        "dashboard-error": element({ hidden: true }),
        "generate-report": element(),
        "dashboard-sync": element(),
        "dashboard-ficha": element({ value: "" }),
        "dashboard-filters": element(),
        "report-preview": element({ open: false }),
        "dashboard-auto-note": element()
    };
    const generic = new Map();
    const document = {
        hidden: false,
        activeElement: null,
        getElementById(id) {
            if (!elements[id]) elements[id] = element();
            return elements[id];
        },
        querySelector(selector) {
            if (!generic.has(selector)) generic.set(selector, element());
            return generic.get(selector);
        },
        querySelectorAll() { return []; },
        createElement() { return element(); }
    };
    const events = [];
    const windowObject = {
        clearTimeout,
        setTimeout,
        setInterval() { return 1; },
        clearInterval() {},
        addEventListener() {},
        dispatchEvent(event) { events.push(event); },
        requestAnimationFrame(callback) { callback(); return 1; },
        cancelAnimationFrame() {},
        devicePixelRatio: 1,
        SenaDashboard: null
    };
    const context = {
        console,
        document,
        window: windowObject,
        navigator: { onLine: true },
        fetch: fetchImpl,
        AbortController,
        DOMException,
        URLSearchParams,
        Intl,
        Date,
        Option: function Option(text, value) { this.text = text; this.value = value; },
        CustomEvent: function CustomEvent(type, options) { this.type = type; this.detail = options?.detail; }
    };
    return { context, elements, events, windowObject };
}

(async () => {
    assert.match(statsHtml, /class="insight-banner insight-banner-live"/, "Estadísticas debe usar el banner vivo.");
    assert.match(statsHtml, /id="insight-attendance"/, "El banner debe exponer la asistencia real.");
    assert.match(statsHtml, /id="insight-absence"/, "El banner debe exponer las ausencias reales.");
    assert.match(statsHtml, /id="analytics-selection-bar"/, "Debe existir una barra única de selección analítica.");
    assert.match(statsHtml, /src="estadisticas_analitica\.js"/, "La página debe cargar el módulo analítico propio.");
    assert.match(statsHtml, /id="dashboard-auto-note"/, "Debe informar que la vista inicial carga registros recientes.");
    assert.match(bannerSource, /window\.addEventListener\("dashboard:data"/, "El banner debe alimentarse del evento real del dashboard.");
    assert.match(bannerSource, /data\.summary\?\.attendance/, "El porcentaje del banner debe venir del resumen real.");
    assert.match(bannerSource, /data\.distribution\?\.percentages\?\.ausente/, "Las ausencias deben venir de la distribución real.");

    const dateField = attendanceHtml.match(/<label class="attendance-field field-date">[\s\S]*?<\/label>/)?.[0] || "";
    assert.match(dateField, /type="date"/, "El campo Fecha debe conservar el selector nativo de fecha.");
    assert.doesNotMatch(dateField, /<i\b/, "Fecha no debe duplicar un icono encima del selector nativo.");

    let latestCalls = 0;
    const latestFetch = async (url) => {
        latestCalls += 1;
        const params = new URL(url, "http://localhost").searchParams;
        let records = [];
        if (latestCalls === 2) records = [{ fecha: "2026-09-24" }];
        if (latestCalls >= 3) records = [{ fecha: "2026-09-24" }, { fecha: "2026-09-23" }];
        return { ok: true, status: 200, json: async () => payload(params, records) };
    };
    const latest = createHarness(latestFetch);
    vm.createContext(latest.context);
    vm.runInContext(statsSource, latest.context, { filename: "estadisticas.js" });
    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.equal(latestCalls, 3, "La entrada debe ampliar la búsqueda solo hasta localizar la última asistencia y luego cargar su corte final.");
    assert.equal(latest.elements["dashboard-date-from"].value, "2026-09-18", "El corte automático debe iniciar seis días antes del último registro.");
    assert.equal(latest.elements["dashboard-date-to"].value, "2026-09-24", "El corte automático debe terminar en la última fecha realmente guardada.");
    assert.match(latest.elements["dashboard-auto-note"].textContent, /últimos registros guardados/i, "La interfaz debe dejar claro que el rango inicial es automático.");
    assert.ok(latest.events.some((event) => event.type === "dashboard:data"), "La carga automática debe publicar los datos al resto de módulos.");

    let failureCalls = 0;
    const failure = createHarness(async () => { failureCalls += 1; throw new TypeError("Failed to fetch"); });
    vm.createContext(failure.context);
    vm.runInContext(statsSource, failure.context, { filename: "estadisticas.js" });
    await new Promise((resolve) => setTimeout(resolve, 700));

    assert.equal(failureCalls, 2, "Una caída transitoria de estadísticas debe reintentarse una vez automáticamente.");
    const errorChildren = failure.elements["dashboard-error"].children || [];
    assert.ok(errorChildren.length >= 2, "El fallo de conexión debe ofrecer un botón Reintentar.");
    assert.doesNotMatch(errorChildren[0].textContent || "", /Failed to fetch/i, "La interfaz no debe exponer el error técnico Failed to fetch.");
    assert.match(errorChildren[0].textContent || "", /servidor de estadísticas/i, "El error debe explicar el problema de conexión en lenguaje útil.");
    assert.equal(errorChildren[1].textContent, "Reintentar", "El usuario debe poder relanzar la consulta.");

    console.log("OK: banner real, carga automática reciente, fecha limpia y recuperación de estadísticas validados.");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
