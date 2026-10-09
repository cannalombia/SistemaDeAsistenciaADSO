// Dashboard administrativo conectado a la API agregada del servidor.
(function () {
    "use strict";

    const dateFrom = document.getElementById("dashboard-date-from");
    if (!dateFrom) return;

    const dateTo = document.getElementById("dashboard-date-to");
    const periodSelect = document.getElementById("dashboard-period");
    const fichaSelect = document.getElementById("dashboard-ficha");
    const loading = document.getElementById("dashboard-loading");
    const errorBox = document.getElementById("dashboard-error");
    const autoNote = document.getElementById("dashboard-auto-note");
    const state = {
        data: null,
        controller: null,
        resizeTimer: null,
        requestId: 0,
        debounce: null,
        autoRange: true,
        bootstrapping: false
    };

    function wait(milliseconds, signal) {
        return new Promise((resolve, reject) => {
            const timer = window.setTimeout(resolve, milliseconds);
            if (!signal) return;
            signal.addEventListener("abort", () => {
                window.clearTimeout(timer);
                reject(new DOMException("Solicitud cancelada", "AbortError"));
            }, { once: true });
        });
    }

    async function fetchDashboard(url, signal) {
        if (navigator.onLine === false) throw new Error("Sin conexión de red. Verifica la conexión y vuelve a intentar.");
        let lastError = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
            if (signal?.aborted) throw new DOMException("Solicitud cancelada", "AbortError");
            const timeoutController = new AbortController();
            const relayAbort = () => timeoutController.abort();
            signal?.addEventListener("abort", relayAbort, { once: true });
            let timedOut = false;
            const timeout = window.setTimeout(() => { timedOut = true; timeoutController.abort(); }, 12000);
            try {
                return await fetch(url, { credentials: "same-origin", cache: "no-store", signal: timeoutController.signal });
            } catch (_error) {
                if (signal?.aborted) throw new DOMException("Solicitud cancelada", "AbortError");
                lastError = timedOut
                    ? new Error("La consulta de estadísticas tardó demasiado. El sistema la reintentó automáticamente.")
                    : new Error("No fue posible conectar con el servidor de estadísticas. Se intentó restablecer la consulta automáticamente.");
                if (attempt === 0) await wait(450, signal);
            } finally {
                window.clearTimeout(timeout);
                signal?.removeEventListener("abort", relayAbort);
            }
        }
        throw lastError || new Error("No fue posible consultar las estadísticas.");
    }

    function showDashboardError(message) {
        errorBox.replaceChildren();
        const text = document.createElement("span");
        text.textContent = message;
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "report-btn secondary dashboard-retry";
        retry.textContent = "Reintentar";
        retry.addEventListener("click", () => {
            if (state.autoRange) bootstrapLatestDashboard();
            else requestDashboard();
        }, { once: true });
        errorBox.append(text, retry);
        errorBox.hidden = false;
    }

    function localDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function addDays(value, amount) {
        const date = value instanceof Date ? new Date(value) : new Date(`${value}T12:00:00`);
        date.setDate(date.getDate() + amount);
        return date;
    }

    function formatNumber(value) {
        return new Intl.NumberFormat("es-CO").format(Number(value) || 0);
    }

    function formatPercentage(value) {
        const number = Number(value) || 0;
        return `${Number.isInteger(number) ? number : number.toFixed(1)}%`;
    }

    function setLoading(active) {
        loading.hidden = !active;
        const reportButton = document.getElementById("generate-report");
        if (reportButton) reportButton.disabled = active;
        window.dispatchEvent(new CustomEvent("dashboard:loading", { detail: { active } }));
    }

    function validRange() {
        if (!dateFrom.value || !dateTo.value || dateFrom.value > dateTo.value) return false;
        const difference = (new Date(`${dateTo.value}T12:00:00`) - new Date(`${dateFrom.value}T12:00:00`)) / 86400000;
        return difference <= 366;
    }

    function buildUrl({ from, to, period = "custom", ficha = "" }) {
        const params = new URLSearchParams({ from, to, period, ficha });
        return `/api/statistics?${params}`;
    }

    async function readStatistics(url, signal) {
        const response = await fetchDashboard(url, signal);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "No fue posible consultar las estadísticas.");
        return data;
    }

    function renderPeriods(filters) {
        const options = [new Option("Rango personalizado", "custom")];
        (filters.periods || []).forEach((period) => options.push(new Option(period.label, period.value)));
        periodSelect.replaceChildren(...options);
        periodSelect.value = filters.period || "custom";
        dateFrom.value = filters.from;
        dateTo.value = filters.to;
    }

    function stat(name, value) {
        const element = document.querySelector(`[data-dashboard-stat="${name}"]`);
        if (element) element.textContent = value;
    }

    function renderSummary(summary) {
        stat("apprentices", formatNumber(summary.apprentices));
        stat("instructors", formatNumber(summary.instructors));
        stat("fichas", formatNumber(summary.fichas));
        stat("environments", `${formatNumber(summary.environmentsAvailable)} / ${formatNumber(summary.environmentsTotal)}`);
        stat("environment-occupancy", `${formatPercentage(summary.environmentOccupancy)} ocupación`);
        stat("attendance", summary.attendanceRecords ? formatPercentage(summary.attendance) : "—");
        const attendanceComparison = document.querySelector('[data-dashboard-comparison="attendance"]');
        if (attendanceComparison) {
            attendanceComparison.textContent = summary.attendanceDelta === null
                ? "Sin comparación histórica"
                : `${summary.attendanceDelta >= 0 ? "↑" : "↓"} ${Math.abs(summary.attendanceDelta).toFixed(1)} puntos vs. periodo anterior`;
            attendanceComparison.style.color = summary.attendanceDelta === null ? "#66758a" : summary.attendanceDelta >= 0 ? "#16862b" : "#d4323b";
        }
    }

    function prepareCanvas(canvas, height) {
        const ratio = window.devicePixelRatio || 1;
        const width = Math.max(1, canvas.clientWidth || 120);
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        const context = canvas.getContext?.("2d");
        if (!context) return null;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        return { context, width, height };
    }

    // Compatibilidad con la lógica histórica y con conjuntos grandes: evita
    // expandir arreglos completos dentro de Math.min/Math.max.
    function calcular_extremos(valores) {
        let minimo = Infinity;
        let maximo = -Infinity;
        let indice = 0;
        while (indice < valores.length) {
            minimo = Math.min(minimo, valores[indice]);
            maximo = Math.max(maximo, valores[indice]);
            indice += 1;
        }
        return { minimo, maximo };
    }

    function drawSparkline(canvas, values, color) {
        const prepared = prepareCanvas(canvas, 26);
        if (!prepared) return;
        const { context, width, height } = prepared;
        context.clearRect(0, 0, width, height);
        const valid = values.map(Number).filter(Number.isFinite);
        if (!valid.length) {
            context.strokeStyle = "#dce2e7";
            context.beginPath(); context.moveTo(2, height - 4); context.lineTo(width - 2, height - 4); context.stroke();
            return;
        }
        const { minimo: min, maximo: max } = calcular_extremos(valid);
        const point = (value, index) => ({
            x: 2 + index / Math.max(1, values.length - 1) * (width - 4),
            y: height - 4 - ((Number(value) - min) / Math.max(1, max - min)) * (height - 9)
        });
        context.beginPath();
        values.forEach((value, index) => {
            const current = point(value, index);
            if (index === 0) context.moveTo(current.x, current.y); else context.lineTo(current.x, current.y);
        });
        context.lineTo(width - 2, height - 2); context.lineTo(2, height - 2); context.closePath();
        const gradient = context.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, `${color}35`); gradient.addColorStop(1, `${color}00`);
        context.fillStyle = gradient; context.fill();
        context.beginPath();
        values.forEach((value, index) => {
            const current = point(value, index);
            if (index === 0) context.moveTo(current.x, current.y); else context.lineTo(current.x, current.y);
        });
        context.strokeStyle = color; context.lineWidth = 1.5; context.stroke();
    }

    function drawSparklines(data) {
        const trendValues = (data.trend || []).filter((item) => item.percentage !== null).map((item) => item.percentage);
        const definitions = {
            apprentices: { values: [data.summary.apprentices], color: "#15952b" },
            instructors: { values: [data.summary.instructors], color: "#2879e8" },
            fichas: { values: [data.summary.fichas], color: "#7c3aed" },
            environments: { values: [data.summary.environmentsAvailable, data.summary.environmentsTotal], color: "#ff8a00" },
            attendance: { values: trendValues, color: "#15952b" }
        };
        document.querySelectorAll("[data-dashboard-sparkline]").forEach((canvas) => {
            const definition = definitions[canvas.dataset.dashboardSparkline];
            drawSparkline(canvas, definition?.values || [], definition?.color || "#15952b");
        });
    }

    function updateAutoNote() {
        if (!autoNote) return;
        autoNote.textContent = state.autoRange
            ? "Vista automática · últimos registros guardados"
            : "Rango seleccionado manualmente";
        autoNote.classList.toggle("is-auto", state.autoRange);
    }

    function applyDashboardData(data) {
        state.data = data;
        renderPeriods(data.filters);
        renderSummary(data.summary);
        stat("apprentices", formatNumber(data.students.length));
        stat("fichas", formatNumber(data.composition.length));
        updateAutoNote();
        window.requestAnimationFrame(() => drawSparklines(data));
        window.dispatchEvent(new CustomEvent("dashboard:data", { detail: data }));
        return data;
    }

    async function requestDashboard() {
        window.clearTimeout(state.debounce);
        state.controller?.abort();
        const requestId = ++state.requestId;
        if (!validRange()) {
            showDashboardError("Selecciona un rango válido de hasta 366 días; la fecha inicial no puede superar la final.");
            setLoading(false);
            const reportButton = document.getElementById("generate-report");
            if (reportButton) reportButton.disabled = true;
            document.getElementById("dashboard-sync").textContent = "Filtros pendientes: revisa las fechas";
            return null;
        }
        state.controller = new AbortController();
        setLoading(true);
        errorBox.hidden = true;
        try {
            const data = await readStatistics(buildUrl({
                from: dateFrom.value,
                to: dateTo.value,
                period: periodSelect.value,
                ficha: fichaSelect.value
            }), state.controller.signal);
            if (requestId !== state.requestId) return null;
            return applyDashboardData(data);
        } catch (error) {
            if (error.name === "AbortError") return null;
            document.getElementById("dashboard-sync").textContent = "Sin actualizar: revisa la conexión";
            showDashboardError(error.message || "No fue posible actualizar las estadísticas. Reintenta la consulta.");
            window.dispatchEvent(new CustomEvent("dashboard:error", { detail: { message: error.message } }));
            return null;
        } finally {
            if (requestId === state.requestId) setLoading(false);
        }
    }

    function latestDateFromRecords(records) {
        let latest = "";
        for (const record of records || []) {
            const value = String(record?.fecha || "");
            if (/^\d{4}-\d{2}-\d{2}$/.test(value) && value > latest) latest = value;
        }
        return latest || null;
    }

    async function bootstrapLatestDashboard() {
        if (state.bootstrapping) return null;
        state.bootstrapping = true;
        state.autoRange = true;
        updateAutoNote();
        state.controller?.abort();
        const requestId = ++state.requestId;
        state.controller = new AbortController();
        errorBox.hidden = true;
        setLoading(true);

        const today = new Date();
        const todayKey = localDateKey(today);
        const ficha = fichaSelect.value;
        const windows = [7, 30, 90, 366];
        let firstResponse = null;
        try {
            for (const days of windows) {
                const from = localDateKey(addDays(today, -(days - 1)));
                const data = await readStatistics(buildUrl({ from, to: todayKey, ficha }), state.controller.signal);
                if (!firstResponse) firstResponse = data;
                const latest = latestDateFromRecords(data.records);
                if (!latest) continue;

                const finalFrom = localDateKey(addDays(latest, -6));
                const probeIsFinal = data.filters.from === finalFrom && data.filters.to === latest;
                const finalData = probeIsFinal
                    ? data
                    : await readStatistics(buildUrl({ from: finalFrom, to: latest, ficha }), state.controller.signal);
                if (requestId !== state.requestId) return null;
                return applyDashboardData(finalData);
            }

            if (requestId !== state.requestId) return null;
            if (firstResponse) return applyDashboardData(firstResponse);
            return null;
        } catch (error) {
            if (error.name === "AbortError") return null;
            document.getElementById("dashboard-sync").textContent = "Sin actualizar: revisa la conexión";
            showDashboardError(error.message || "No fue posible cargar los últimos registros guardados.");
            window.dispatchEvent(new CustomEvent("dashboard:error", { detail: { message: error.message } }));
            return null;
        } finally {
            state.bootstrapping = false;
            if (requestId === state.requestId) setLoading(false);
        }
    }

    function scheduleRefresh() {
        window.clearTimeout(state.debounce);
        state.debounce = window.setTimeout(requestDashboard, 300);
    }

    const today = new Date();
    const sixDaysAgo = addDays(today, -6);
    dateFrom.value = localDateKey(sixDaysAgo);
    dateTo.value = localDateKey(today);

    dateFrom.addEventListener("change", () => { state.autoRange = false; periodSelect.value = "custom"; updateAutoNote(); scheduleRefresh(); });
    dateTo.addEventListener("change", () => { state.autoRange = false; periodSelect.value = "custom"; updateAutoNote(); scheduleRefresh(); });
    fichaSelect.addEventListener("change", () => { state.autoRange = true; updateAutoNote(); bootstrapLatestDashboard(); });
    document.querySelectorAll("[data-days]").forEach((button) => button.addEventListener("click", () => {
        const end = new Date();
        const start = addDays(end, -Number(button.dataset.days) + 1);
        dateFrom.value = localDateKey(start);
        dateTo.value = localDateKey(end);
        periodSelect.value = "custom";
        state.autoRange = false;
        updateAutoNote();
        requestDashboard();
    }));
    periodSelect.addEventListener("change", () => { state.autoRange = false; updateAutoNote(); requestDashboard(); });

    window.SenaDashboard = {
        refresh: requestDashboard,
        refreshLatest: bootstrapLatestDashboard,
        selectFicha(ficha) {
            fichaSelect.value = String(ficha || "");
            state.autoRange = true;
            updateAutoNote();
            return bootstrapLatestDashboard();
        },
        isAutoRange: () => state.autoRange
    };

    window.addEventListener("storage", (event) => {
        if (event.key !== "sena-attendance-updated") return;
        if (state.autoRange) bootstrapLatestDashboard(); else requestDashboard();
    });
    window.setInterval(() => {
        if (document.hidden || document.getElementById("report-preview").open || !loading.hidden || document.getElementById("dashboard-filters").contains(document.activeElement)) return;
        if (state.autoRange) bootstrapLatestDashboard();
        else requestDashboard();
    }, 30000);
    window.addEventListener("resize", () => {
        window.clearTimeout(state.resizeTimer);
        state.resizeTimer = window.setTimeout(() => { if (state.data) drawSparklines(state.data); }, 120);
    });

    updateAutoNote();
    bootstrapLatestDashboard();
})();
