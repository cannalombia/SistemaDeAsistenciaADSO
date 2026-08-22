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
    const state = { data: null, controller: null, resizeTimer: null };

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
        [dateFrom, dateTo, periodSelect].forEach((control) => { control.disabled = active; });
    }

    async function requestDashboard() {
        state.controller?.abort();
        state.controller = new AbortController();
        setLoading(true);
        errorBox.hidden = true;
        const params = new URLSearchParams({
            from: dateFrom.value,
            to: dateTo.value,
            period: periodSelect.value
        });
        try {
            const response = await fetch(`/api/statistics?${params}`, { credentials: "same-origin", signal: state.controller.signal });
            const data = await response.json().catch(() => ({}));
            if (response.status === 403) {
                window.location.replace("asistencia.html");
                return;
            }
            if (!response.ok) throw new Error(data.message || "No fue posible consultar las estadísticas.");
            state.data = data;
            renderDashboard(data);
        } catch (error) {
            if (error.name === "AbortError") return;
            errorBox.textContent = error.message || "Error de conexión con el servidor.";
            errorBox.hidden = false;
        } finally {
            setLoading(false);
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
        stat("attendance", formatPercentage(summary.attendance));
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

    function drawSparkline(canvas, values, color) {
        const { context, width, height } = prepareCanvas(canvas, 26);
        context.clearRect(0, 0, width, height);
        const valid = values.map(Number).filter(Number.isFinite);
        if (!valid.length) {
            context.strokeStyle = "#dce2e7";
            context.beginPath(); context.moveTo(2, height - 4); context.lineTo(width - 2, height - 4); context.stroke();
            return;
        }
        const min = Math.min(...valid);
        const max = Math.max(...valid);
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

    function drawSparklines(data) {
        const trendValues = data.trend.map((item) => item.percentage).filter((value) => value !== null);
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

    function heatClass(value) {
        if (value === null) return "heatmap-empty";
        if (value < 70) return "heatmap-low";
        if (value < 90) return "heatmap-medium";
        return "heatmap-high";
    }

    function renderHeatmap(rows) {
        const container = document.getElementById("dashboard-heatmap");
        const days = rows[0]?.days.map((item) => item.day) || ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        const cells = ['<span class="heatmap-cell heatmap-day"></span>', ...days.map((day) => `<span class="heatmap-cell heatmap-day">${escapeHtml(day.slice(0, 3))}</span>`)];
        rows.forEach((row) => {
            cells.push(`<span class="heatmap-cell heatmap-label">${escapeHtml(row.journey)}</span>`);
            row.days.forEach((day) => cells.push(`<span class="heatmap-cell ${heatClass(day.percentage)}" title="${escapeHtml(row.journey)} · ${escapeHtml(day.day)} · ${day.total} registros">${day.percentage === null ? "—" : formatPercentage(day.percentage)}</span>`));
        });
        container.innerHTML = cells.join("");
    }

    function renderTopFichas(items) {
        document.getElementById("dashboard-top-fichas").innerHTML = items.map((item) => `
            <li><span class="top-ficha-name" title="${escapeHtml(item.ficha)} - ${escapeHtml(item.programa)}">${escapeHtml(item.ficha)} - ${escapeHtml(item.programa)}</span><strong class="top-ficha-rate">${formatPercentage(item.attendance)}</strong><span class="top-ficha-progress"><i style="width:${Math.max(0, Math.min(100, item.attendance))}%"></i></span></li>`).join("") || '<li class="dashboard-empty">Sin datos disponibles</li>';
    }

    function renderAlerts(alerts) {
        const container = document.getElementById("dashboard-alert-list");
        container.innerHTML = alerts.map((alert) => `
            <div class="dashboard-alert ${escapeHtml(alert.type)}"><span class="alert-dot"></span><i class="fas ${escapeHtml(alert.icon)}"></i><div><strong>${escapeHtml(alert.title)}</strong><p>${escapeHtml(alert.description)}</p></div><time>${escapeHtml(alert.time)}</time></div>`).join("") || '<p class="dashboard-empty">No hay novedades pendientes.</p>';
        const badge = document.getElementById("dashboard-notification-count");
        badge.textContent = alerts.length;
        badge.hidden = alerts.length === 0;
    }

    function journeyClass(value) {
        return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    }

    function renderSessions(sessions) {
        document.getElementById("dashboard-sessions").innerHTML = sessions.map((session) => `
            <div class="dashboard-session"><i class="far fa-calendar"></i><div><strong>${escapeHtml(session.ficha)} - ${escapeHtml(session.programa)}</strong><p>${escapeHtml(session.dia)}, ${escapeHtml(formatShortDate(session.fecha))} · ${escapeHtml(session.horaInicio)} - ${escapeHtml(session.horaFin)}</p></div><span class="session-journey ${journeyClass(session.jornada)}">${escapeHtml(session.jornada)}</span><small>${escapeHtml(session.ambiente)}</small></div>`).join("") || '<p class="dashboard-empty">Sin sesiones programadas.</p>';
    }

    function renderDashboard(data) {
        renderPeriods(data.filters);
        renderSummary(data.summary);
        renderComposition(data.composition || []);
        renderHeatmap(data.weeklyPerformance || []);
        renderTopFichas(data.topFichas || []);
        renderAlerts(data.alerts || []);
        renderSessions(data.nextSessions || []);
        window.requestAnimationFrame(() => drawSparklines(data));
    }

    const today = new Date();
    const sixDaysAgo = new Date(today); sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
    dateFrom.value = localDateKey(sixDaysAgo);
    dateTo.value = localDateKey(today);

    dateFrom.addEventListener("change", () => { periodSelect.value = "custom"; requestDashboard(); });
    dateTo.addEventListener("change", () => { periodSelect.value = "custom"; requestDashboard(); });
    dateTo.addEventListener("click", () => dateTo.showPicker?.());
    periodSelect.addEventListener("change", requestDashboard);
    compositionLimit.addEventListener("change", () => renderComposition(state.data?.composition || []));
    document.getElementById("dashboard-notifications").addEventListener("click", () => document.getElementById("dashboard-alerts").scrollIntoView({ behavior: "smooth", block: "center" }));
    window.addEventListener("resize", () => {
        window.clearTimeout(state.resizeTimer);
        state.resizeTimer = window.setTimeout(() => { if (state.data) drawSparklines(state.data); }, 120);
    });

    requestDashboard();
})();
