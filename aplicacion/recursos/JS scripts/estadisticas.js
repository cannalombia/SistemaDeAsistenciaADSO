// Dashboard administrativo conectado a la API agregada del servidor.
(function () {
    "use strict";

    const dateFrom = document.getElementById("dashboard-date-from");
    if (!dateFrom) return;

    const dateTo = document.getElementById("dashboard-date-to");
    const periodSelect = document.getElementById("dashboard-period");
    const compositionLimit = document.getElementById("dashboard-composition-limit");
    const loading = document.getElementById("dashboard-loading");
    const errorBox = document.getElementById("dashboard-error");
    const state = { data: null, controller: null, resizeTimer: null, requestId: 0, debounce: null };

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function localDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function formatNumber(value) {
        return new Intl.NumberFormat("es-CO").format(Number(value) || 0);
    }

    function formatPercentage(value) {
        const number = Number(value) || 0;
        return `${Number.isInteger(number) ? number : number.toFixed(1)}%`;
    }

    function formatShortDate(value) {
        const date = new Date(`${value}T12:00:00`);
        return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(date).replace(".", "");
    }

    function setLoading(active) {
        loading.hidden = !active;
        document.getElementById("generate-report").disabled = active;
    }

    async function requestDashboard() {
        window.clearTimeout(state.debounce);
        state.controller?.abort();
        const requestId = ++state.requestId;
        if (!dateFrom.value || !dateTo.value || dateFrom.value > dateTo.value || (new Date(dateTo.value) - new Date(dateFrom.value)) / 86400000 > 366) {
            errorBox.textContent = "Selecciona un rango válido de hasta 367 días; la fecha inicial no puede superar la final.";
            errorBox.hidden = false;
            setLoading(false);
            document.getElementById("generate-report").disabled = true;
            document.getElementById("dashboard-sync").textContent = "Filtros pendientes: revisa las fechas";
            return null;
        }
        state.controller = new AbortController();
        setLoading(true);
        errorBox.hidden = true;
        const params = new URLSearchParams({
            from: dateFrom.value,
            to: dateTo.value,
            period: periodSelect.value,
            ficha: document.getElementById("dashboard-ficha").value
        });
        try {
            const response = await fetch(`/api/statistics?${params}`, { credentials: "same-origin", signal: state.controller.signal });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || "No fue posible consultar las estadísticas.");
            if (requestId !== state.requestId) return null;
            state.data = data;
            renderDashboard(data);
            window.dispatchEvent(new CustomEvent("dashboard:data", { detail: data }));
            return data;
        } catch (error) {
            if (error.name === "AbortError") return null;
            document.getElementById("dashboard-sync").textContent = "Sin actualizar: revisa la conexión";
            errorBox.textContent = error.message || "Error de conexión con el servidor.";
            errorBox.hidden = false;
        } finally {
            if (requestId === state.requestId) setLoading(false);
        }
    }

    function renderPeriods(filters) {
        const options = ['<option value="custom">Rango personalizado</option>'];
        (filters.periods || []).forEach((period) => options.push(`<option value="${escapeHtml(period.value)}">${escapeHtml(period.label)}</option>`));
        periodSelect.innerHTML = options.join("");
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
        attendanceComparison.textContent = summary.attendanceDelta === null
            ? "Sin comparación histórica"
            : `${summary.attendanceDelta >= 0 ? "↑" : "↓"} ${Math.abs(summary.attendanceDelta).toFixed(1)} puntos vs. periodo anterior`;
        attendanceComparison.style.color = summary.attendanceDelta === null ? "#66758a" : summary.attendanceDelta >= 0 ? "#16862b" : "#d4323b";
    }

    function prepareCanvas(canvas, height) {
        const ratio = window.devicePixelRatio || 1;
        const width = Math.max(1, canvas.clientWidth);
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        const context = canvas.getContext("2d");
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        return { context, width, height };
    }

    // Recibe los valores finitos de la gráfica y calcula su escala en un recorrido.
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
        const { context, width, height } = prepareCanvas(canvas, 26);
        context.clearRect(0, 0, width, height);
        const valid = values.map(Number).filter(Number.isFinite);
        if (!valid.length) {
            context.strokeStyle = "#dce2e7";
            context.beginPath(); context.moveTo(2, height - 4); context.lineTo(width - 2, height - 4); context.stroke();
            return;
        }
        const { minimo: min, maximo: max } = calcular_extremos(valid);
        context.beginPath();
        values.forEach((value, index) => {
            const x = 2 + index / Math.max(1, values.length - 1) * (width - 4);
            const y = height - 4 - ((Number(value) - min) / Math.max(1, max - min)) * (height - 9);
            if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
        });
        context.lineTo(width - 2, height - 2); context.lineTo(2, height - 2); context.closePath();
        const gradient = context.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, `${color}35`); gradient.addColorStop(1, `${color}00`);
        context.fillStyle = gradient; context.fill();
        context.beginPath();
        values.forEach((value, index) => {
            const x = 2 + index / Math.max(1, values.length - 1) * (width - 4);
            const y = height - 4 - ((Number(value) - min) / Math.max(1, max - min)) * (height - 9);
            if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
        });
        context.strokeStyle = color; context.lineWidth = 1.5; context.stroke();
    }

    function obtener_porcentajes_tendencia(tendencia) {
            const porcentajes = [];
            for (let i = 0; i < tendencia.length; i++) {

                if (tendencia[i].percentage === null) {
                    continue;
                }

                porcentajes.push(tendencia[i].percentage);
    }

    return porcentajes;
}

   function drawSparklines(data) {
    const trendValues = obtener_porcentajes_tendencia(data.trend);

    const definitions = {
        apprentices: { values: [data.summary.apprentices], color: "#15952b" },
        instructors: { values: [data.summary.instructors], color: "#2879e8" },
        fichas: { values: [data.summary.fichas], color: "#7c3aed" },
        environments: {
            values: [
                data.summary.environmentsAvailable,
                data.summary.environmentsTotal
            ],
            color: "#ff8a00"
        },
        attendance: { values: trendValues, color: "#15952b" }
    };

    document.querySelectorAll("[data-dashboard-sparkline]").forEach((canvas) => {
        const definition = definitions[canvas.dataset.dashboardSparkline];

        drawSparkline(
            canvas,
            definition?.values || [],
            definition?.color || "#15952b"
        );
    });
}

    function segment(status, value) {
        const percentage = Number(value) || 0;
        if (!percentage) return "";
        const label = percentage >= 7 ? `${Math.round(percentage)}%` : "";
        return `<span class="composition-segment ${status}" style="width:${percentage}%">${label}</span>`;
    }

    function renderComposition(items) {
        const container = document.getElementById("dashboard-composition");
        const limit = compositionLimit.value === "all" ? items.length : Number(compositionLimit.value || 5);
        const visible = items.slice(0, limit);
        container.innerHTML = visible.map((item) => `
            <div class="composition-row">
                <span class="composition-name" title="${escapeHtml(item.ficha)} - ${escapeHtml(item.programa)}">${escapeHtml(item.ficha)} - ${escapeHtml(item.programa)}</span>
                <div class="composition-bar" aria-label="Composición de ficha ${escapeHtml(item.ficha)}">
                    ${segment("presente", item.percentages.presente)}${segment("tardanza", item.percentages.tardanza)}${segment("ausente", item.percentages.ausente)}${segment("justificado", item.percentages.justificado)}
                </div>
                <strong class="composition-rate">${formatPercentage(item.attendance)}</strong>
            </div>`).join("") || '<p class="dashboard-empty">Sin asistencias por ficha en el rango seleccionado.</p>';
        document.getElementById("composition-count").textContent = `${items.length} ficha${items.length === 1 ? "" : "s"} con registros`;
    }

    function renderDashboard(data) {
        renderPeriods(data.filters);
        renderSummary(data.summary);
        stat("apprentices", formatNumber(data.students.length));
        stat("fichas", formatNumber(data.composition.length));
        renderComposition(data.composition || []);
        window.requestAnimationFrame(() => drawSparklines(data));
    }

    const today = new Date();
    const sixDaysAgo = new Date(today); sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
    dateFrom.value = localDateKey(sixDaysAgo);
    dateTo.value = localDateKey(today);

    function scheduleRefresh() { window.clearTimeout(state.debounce); state.debounce = window.setTimeout(requestDashboard, 300); }
    dateFrom.addEventListener("change", () => { periodSelect.value = "custom"; scheduleRefresh(); });
    dateTo.addEventListener("change", () => { periodSelect.value = "custom"; scheduleRefresh(); });
    document.getElementById("dashboard-ficha").addEventListener("change", scheduleRefresh);
    document.querySelectorAll("[data-days]").forEach((button) => button.addEventListener("click", () => {
        const end = new Date(); const start = new Date(end); start.setDate(start.getDate() - Number(button.dataset.days) + 1);
        dateFrom.value = localDateKey(start); dateTo.value = localDateKey(end); periodSelect.value = "custom"; requestDashboard();
    }));
    window.SenaDashboard = { refresh: requestDashboard };
    window.addEventListener("focus", () => { if (!document.hidden) requestDashboard(); });
    window.addEventListener("storage", (event) => { if (event.key === "sena-attendance-updated") requestDashboard(); });
    window.setInterval(() => {
        if (document.hidden || document.getElementById("report-preview").open || !loading.hidden || document.getElementById("dashboard-filters").contains(document.activeElement)) return;
        requestDashboard();
    }, 30000);
    periodSelect.addEventListener("change", requestDashboard);
    compositionLimit.addEventListener("change", () => renderComposition(state.data?.composition || []));
    window.addEventListener("resize", () => {
        window.clearTimeout(state.resizeTimer);
        state.resizeTimer = window.setTimeout(() => { if (state.data) drawSparklines(state.data); }, 120);
    });

    requestDashboard();
})();
