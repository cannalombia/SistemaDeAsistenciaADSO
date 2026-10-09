"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "aplicacion", "recursos", "JS scripts", "asistencia_qr.js"), "utf8");

function createElement(initial = {}) {
    const listeners = new Map();
    const element = {
        hidden: false,
        value: "",
        textContent: "",
        href: "",
        open: false,
        complete: false,
        naturalWidth: 0,
        ...initial,
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        removeEventListener(type, handler) {
            const current = listeners.get(type) || [];
            listeners.set(type, current.filter((item) => item !== handler));
        },
        dispatch(type) {
            for (const handler of [...(listeners.get(type) || [])]) handler({ type, target: element });
        },
        replaceChildren(...options) {
            element.options = options;
            if (options.length) element.value = options[0].value;
        },
        showModal() { element.open = true; },
        close() { element.open = false; element.dispatch("close"); }
    };
    return element;
}

function createQrImage() {
    const image = createElement({ hidden: true, complete: false, naturalWidth: 0 });
    let src = "";
    Object.defineProperty(image, "src", {
        get: () => src,
        set(value) {
            src = value;
            image.complete = true;
            image.naturalWidth = 320;
            setTimeout(() => image.dispatch("load"), 0);
        }
    });
    return image;
}

async function runScenario(qrPayload) {
    const elements = {
        "attendance-qr": createElement(),
        "qr-ficha": createElement(),
        "qr-jornada": createElement({ value: "Mañana" }),
        "qr-image": createQrImage(),
        "qr-link": createElement({ hidden: true }),
        "qr-status": createElement(),
        "generate-qr": createElement(),
        "close-qr": createElement()
    };
    const calls = [];
    const fetch = async (url, options = {}) => {
        calls.push({ url, options });
        const data = url === "/api/attendance"
            ? {
                ok: true,
                fichas: Array.from({ length: 8 }, (_, index) => ({
                    codigo: String(3349882 + index),
                    programa: `Programa ${index + 1}`,
                    jornada: index < 4 ? "Mañana" : "Tarde"
                }))
            }
            : qrPayload;
        return { ok: true, status: url === "/api/attendance/qr" ? 201 : 200, json: async () => data };
    };
    const context = {
        console,
        document: { getElementById: (id) => elements[id] || null },
        fetch,
        Option: function Option(text, value) { this.text = text; this.value = value; },
        AbortController,
        URL,
        URLSearchParams,
        performance,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        location: { search: "" }
    };
    vm.createContext(context);
    vm.runInContext(source, context, { filename: "asistencia_qr.js" });
    elements["generate-qr"].dispatch("click");
    await new Promise((resolve) => setTimeout(resolve, 40));
    return { elements, calls };
}

(async () => {
    const success = await runScenario({
        ok: true,
        image: "data:image/png;base64,QUJDRA==",
        url: "http://192.168.1.20:3000/asistencia_qr.html?token=" + "a".repeat(64),
        expiresAt: Date.now() + 60000,
        remainingMs: 60000
    });
    assert.equal(success.elements["qr-image"].hidden, false, "El QR debe hacerse visible tras cargar la imagen.");
    assert.equal(success.elements["qr-link"].hidden, false, "El enlace del QR debe hacerse visible.");
    assert.match(success.elements["qr-status"].textContent, /^Vence en \d+ segundos\./);
    assert.ok(success.calls.some((call) => call.url === "/api/attendance/qr" && call.options.method === "POST"), "Debe solicitarse el QR por POST.");
    assert.equal(success.elements["qr-ficha"].options.length, 8, "El selector QR debe cargar las ocho fichas activas entregadas por el servidor.");
    success.elements["qr-ficha"].value = "3349889";
    success.elements["qr-ficha"].dispatch("change");
    await new Promise((resolve) => setTimeout(resolve, 40));
    const lastQrCall = success.calls.filter((call) => call.url === "/api/attendance/qr" && call.options.method === "POST").at(-1);
    assert.equal(JSON.parse(lastQrCall.options.body).ficha, "3349889", "Debe poder generar el QR para cualquiera de las ocho fichas, incluida la última.");
    assert.equal(JSON.parse(lastQrCall.options.body).jornada, "Tarde", "Al cambiar de ficha debe usar la jornada configurada para esa ficha.");
    success.elements["attendance-qr"].close();

    const invalid = await runScenario({ ok: true, image: "", url: "", remainingMs: 60000 });
    assert.match(invalid.elements["qr-status"].textContent, /imagen QR válida/i, "Una respuesta inválida debe salir del estado de carga y mostrar error.");
    assert.doesNotMatch(invalid.elements["qr-status"].textContent, /^Generando QR/);
    invalid.elements["attendance-qr"].close();

    console.log("OK: contrato frontend QR, renderizado visible y error controlado validados.");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
