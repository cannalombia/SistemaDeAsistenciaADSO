(() => {
    "use strict";
    const API_TIMEOUT_MS = 12000;
    async function api(url, body) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
        try {
            const response = await fetch(url, { method: body ? "POST" : "GET", credentials: "same-origin", headers: { "Content-Type": "application/json" }, signal: controller.signal, ...(body ? { body: JSON.stringify(body) } : {}) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "No se pudo completar la solicitud.");
            return data;
        } catch (error) {
            if (error.name === "AbortError") throw new Error("El servidor tardó demasiado en responder.");
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }
    const result = document.getElementById("qr-result");
    if (result) {
        (async () => {
            try {
                const token = new URLSearchParams(location.search).get("token");
                if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new Error("QR inválido. Escanea el QR actual.");
                const session = await api("/api/auth/session");
                if (!session.authenticated) {
                    const login = document.getElementById("qr-login");
                    login.href = `login.html?returnTo=${encodeURIComponent("asistencia_qr.html" + location.search)}`;
                    login.hidden = false;
                    result.textContent = "Inicia sesión como aprendiz para registrar tu asistencia. Si el QR vence durante el ingreso, vuelve a escanearlo.";
                    return;
                }
                result.textContent = (await api("/api/attendance/qr/register", { token })).message;
            } catch (error) { result.textContent = error.message; }
        })();
        return;
    }
    const modal = document.getElementById("attendance-qr");
    if (!modal) return;
    const ficha = document.getElementById("qr-ficha");
    const jornada = document.getElementById("qr-jornada");
    const image = document.getElementById("qr-image");
    const link = document.getElementById("qr-link");
    const status = document.getElementById("qr-status");
    let timer, version = 0, fichas = [], generating = false, pending = false;
    async function generate() {
        clearInterval(timer);
        image.hidden = link.hidden = true;
        const current = ++version;
        if (generating) { pending = true; return; }
        if (!modal.open || !ficha.value) return;
        generating = true;
        status.textContent = "Generando QR…";
        try {
            const data = await api("/api/attendance/qr", { ficha: ficha.value, jornada: jornada.value });
            if (current !== version || !modal.open) return;
            image.src = data.image;
            link.href = data.url;
            image.hidden = link.hidden = false;
            const deadline = performance.now() + data.remainingMs;
            const tick = () => {
                const seconds = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
                status.textContent = `Vence en ${seconds} segundos. Renovación automática.`;
                if (!seconds) generate();
            };
            timer = setInterval(tick, 250);
            tick();
        } catch (error) {
            if (current === version && modal.open) {
                console.error("No fue posible generar el QR de asistencia:", error);
                status.textContent = `${error.message} Reintentando en 5 segundos…`;
                timer = setTimeout(generate, 5000);
            }
        } finally {
            generating = false;
            if (pending) { pending = false; generate(); }
        }
    }
    function selectJourney() {
        const selected = fichas.find((item) => item.codigo === ficha.value);
        if (["Mañana", "Tarde", "Noche"].includes(selected?.jornada)) jornada.value = selected.jornada;
    }
    document.getElementById("generate-qr").addEventListener("click", async () => {
        modal.showModal();
        status.textContent = "Cargando fichas…";
        const current = ++version;
        try {
            fichas = (await api("/api/attendance")).fichas;
            if (!modal.open || current !== version) return;
            ficha.replaceChildren(...fichas.map((item) => new Option(`${item.codigo} · ${item.programa}`, item.codigo)));
            if (!fichas.length) { status.textContent = "No hay fichas con aprendices activos."; return; }
            selectJourney();
            generate();
        } catch (error) {
            console.error("No fue posible cargar las fichas para el QR:", error);
            status.textContent = error.message;
        }
    });
    ficha.addEventListener("change", () => { selectJourney(); generate(); });
    jornada.addEventListener("change", generate);
    document.getElementById("close-qr").addEventListener("click", () => modal.close());
    modal.addEventListener("close", () => { ++version; clearInterval(timer); image.hidden = link.hidden = true; });
})();
