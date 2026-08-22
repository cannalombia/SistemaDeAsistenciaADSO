// Registro diario de asistencia. Consume la API protegida del servidor del proyecto.
(function () {
    "use strict";

    const tableBody = document.getElementById("attendance-table-body");
    if (!tableBody) return;

    const fichaSelect = document.getElementById("attendance-ficha");
    const dateInput = document.getElementById("attendance-date");
    const journeySelect = document.getElementById("attendance-journey");
    const roleSelect = document.getElementById("attendance-role");
    const searchInput = document.getElementById("attendance-search");
    const pageSizeSelect = document.getElementById("attendance-page-size");
    const pages = document.getElementById("attendance-pages");
    const countText = document.getElementById("attendance-count");
    const markAllButton = document.querySelector('[data-action="mark-all-present"]');
    const saveButton = document.querySelector('[data-action="save-attendance"]');
    const statusLabels = {
        presente: "Presente",
        tardanza: "Tardanza",
        ausente: "Ausente",
        justificado: "Justificado"
    };
    const statusColors = {
        presente: "#39b54a",
        tardanza: "#f5a609",
        ausente: "#ff454d",
        justificado: "#2475d9"
    };
    const state = {
        aprendices: [],
        fichas: [],
        page: 1,
        pageSize: Number(pageSizeSelect.value),
        lastUpdated: null,
        requestNumber: 0
    };

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function normalized(value) {
        return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
    }

    function initials(name) {
        return String(name || "").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
    }

    function showMessage(message, type = "success") {
        let toast = document.getElementById("app-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "app-toast";
            toast.className = "app-toast";
            toast.setAttribute("role", "status");
            toast.setAttribute("aria-live", "polite");
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.dataset.type = type;
        toast.classList.add("show");
        window.clearTimeout(showMessage.timer);
        showMessage.timer = window.setTimeout(() => toast.classList.remove("show"), 3400);
    }

    async function apiRequest(url, options = {}) {
        const response = await fetch(url, {
            credentials: "same-origin",
            ...options,
            headers: { "Content-Type": "application/json", ...(options.headers || {}) }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "No fue posible consultar la asistencia.");
        return data;
    }

    function today() {
        const local = new Date();
        local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
        return local.toISOString().slice(0, 10);
    }

    function filteredApprentices() {
        const query = normalized(searchInput.value.trim());
        if (!query) return state.aprendices;
        return state.aprendices.filter((item) => normalized(`${item.nombre} ${item.identificacion} ${item.ficha}`).includes(query));
    }

    function statusOptions(selected) {
        return Object.entries(statusLabels).map(([value, label]) =>
            `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`
        ).join("");
    }

    function renderTable() {
        const filtered = filteredApprentices();
        const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
        if (state.page > totalPages) state.page = totalPages;
        const start = (state.page - 1) * state.pageSize;
        const visible = filtered.slice(start, start + state.pageSize);

        tableBody.innerHTML = visible.map((item, index) => `
            <tr data-document="${escapeHtml(item.identificacion)}">
                <td>${start + index + 1}</td>
                <td><span class="attendance-student"><span class="attendance-avatar">${escapeHtml(initials(item.nombre))}</span><strong title="${escapeHtml(item.nombre)}">${escapeHtml(item.nombre)}</strong></span></td>
                <td>${escapeHtml(item.identificacion)}</td>
                <td>${escapeHtml(item.ficha)}</td>
                <td><select class="attendance-status status-${escapeHtml(item.estado)}" data-status-for="${escapeHtml(item.identificacion)}" aria-label="Estado de ${escapeHtml(item.nombre)}">${statusOptions(item.estado)}</select></td>
                <td><input class="attendance-observation" data-observation-for="${escapeHtml(item.identificacion)}" type="text" maxlength="200" value="${escapeHtml(item.observacion)}" placeholder="Observación (opcional)" aria-label="Observación de ${escapeHtml(item.nombre)}"></td>
            </tr>`).join("") || '<tr><td colspan="6" class="attendance-empty"><i class="far fa-folder-open"></i> No se encontraron aprendices.</td></tr>';

        countText.textContent = `Mostrando ${visible.length} de ${filtered.length} aprendices`;
        renderPages(totalPages);
        markAllButton.disabled = filtered.length === 0;
        saveButton.disabled = state.aprendices.length === 0;
    }

    function renderPages(totalPages) {
        const buttons = [];
        buttons.push(`<button type="button" data-page="${Math.max(1, state.page - 1)}" ${state.page === 1 ? "disabled" : ""} aria-label="Página anterior"><i class="fas fa-chevron-left"></i></button>`);
        for (let page = 1; page <= totalPages; page += 1) {
            buttons.push(`<button type="button" data-page="${page}" class="${page === state.page ? "active" : ""}" ${page === state.page ? 'aria-current="page"' : ""}>${page}</button>`);
        }
        buttons.push(`<button type="button" data-page="${Math.min(totalPages, state.page + 1)}" ${state.page === totalPages ? "disabled" : ""} aria-label="Página siguiente"><i class="fas fa-chevron-right"></i></button>`);
        pages.innerHTML = buttons.join("");
    }

    function renderSummary() {
        const counts = { presente: 0, tardanza: 0, ausente: 0, justificado: 0 };
        state.aprendices.forEach((item) => { if (counts[item.estado] !== undefined) counts[item.estado] += 1; });
        const total = state.aprendices.length;
        document.getElementById("summary-total").textContent = total;
        document.getElementById("summary-ficha").textContent = fichaSelect.value ? `Ficha ${fichaSelect.value}` : "Seleccione una ficha";
        document.getElementById("summary-journey").textContent = journeySelect.value;
        Object.keys(counts).forEach((status) => {
            document.querySelector(`[data-summary-count="${status}"]`).textContent = counts[status];
            document.querySelector(`[data-summary-percent="${status}"]`).textContent = `${total ? Math.round(counts[status] / total * 100) : 0}%`;
        });

        const donut = document.getElementById("attendance-donut");
        if (!total) {
            donut.style.background = "#e8edf0";
            donut.setAttribute("aria-label", "No hay aprendices para resumir");
        } else {
            let accumulated = 0;
            const segments = Object.keys(counts).map((status) => {
                const start = accumulated;
                accumulated += counts[status] / total * 100;
                return `${statusColors[status]} ${start}% ${accumulated}%`;
            });
            donut.style.background = `conic-gradient(${segments.join(",")})`;
            donut.setAttribute("aria-label", `Total ${total}. Presentes ${counts.presente}, tardanzas ${counts.tardanza}, ausentes ${counts.ausente}, justificados ${counts.justificado}.`);
        }
        document.getElementById("summary-updated").textContent = state.lastUpdated
            ? new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(state.lastUpdated))
            : "Sin guardar";
    }

    function setLoading(isLoading) {
        fichaSelect.disabled = isLoading;
        dateInput.disabled = isLoading;
        journeySelect.disabled = isLoading;
        markAllButton.disabled = isLoading || filteredApprentices().length === 0;
        saveButton.disabled = isLoading || state.aprendices.length === 0;
        if (isLoading) tableBody.innerHTML = '<tr><td colspan="6" class="attendance-empty"><i class="fas fa-circle-notch fa-spin"></i> Cargando aprendices...</td></tr>';
    }

    async function loadSelectedFicha() {
        const requestNumber = ++state.requestNumber;
        if (!fichaSelect.value) {
            state.aprendices = [];
            state.lastUpdated = null;
            renderTable();
            renderSummary();
            return;
        }
        setLoading(true);
        try {
            const params = new URLSearchParams({ ficha: fichaSelect.value, fecha: dateInput.value, jornada: journeySelect.value });
            const data = await apiRequest(`/api/attendance?${params}`);
            if (requestNumber !== state.requestNumber) return;
            state.aprendices = data.aprendices || [];
            state.lastUpdated = data.ultima_actualizacion || null;
            state.page = 1;
            renderTable();
            renderSummary();
        } catch (error) {
            state.aprendices = [];
            tableBody.innerHTML = `<tr><td colspan="6" class="attendance-empty"><i class="fas fa-triangle-exclamation"></i> ${escapeHtml(error.message)}</td></tr>`;
            renderSummary();
            showMessage(error.message, "error");
        } finally {
            if (requestNumber === state.requestNumber) setLoading(false);
        }
    }

    async function initialize() {
        dateInput.value = today();
        setLoading(true);
        try {
            const data = await apiRequest("/api/attendance");
            state.fichas = data.fichas || [];
            const role = data.usuario?.role || "Instructor";
            roleSelect.value = role;
            fichaSelect.innerHTML = state.fichas.map((item) => `<option value="${escapeHtml(item.codigo)}">${escapeHtml(item.codigo)} - ${escapeHtml(item.programa)}</option>`).join("");
            if (!state.fichas.length) fichaSelect.innerHTML = '<option value="">No hay fichas disponibles</option>';
            const firstJourney = state.fichas[0]?.jornada;
            if (["Mañana", "Tarde", "Noche"].includes(firstJourney)) journeySelect.value = firstJourney;
            await loadSelectedFicha();
        } catch (error) {
            fichaSelect.innerHTML = '<option value="">No se pudieron cargar las fichas</option>';
            tableBody.innerHTML = `<tr><td colspan="6" class="attendance-empty"><i class="fas fa-triangle-exclamation"></i> ${escapeHtml(error.message)}</td></tr>`;
            showMessage(error.message, "error");
            setLoading(false);
        }
    }

    tableBody.addEventListener("change", (event) => {
        const select = event.target.closest("[data-status-for]");
        if (!select) return;
        const student = state.aprendices.find((item) => item.identificacion === select.dataset.statusFor);
        if (!student) return;
        student.estado = select.value;
        select.className = `attendance-status status-${select.value}`;
        renderSummary();
    });

    tableBody.addEventListener("input", (event) => {
        const input = event.target.closest("[data-observation-for]");
        if (!input) return;
        const student = state.aprendices.find((item) => item.identificacion === input.dataset.observationFor);
        if (student) student.observacion = input.value;
    });

    pages.addEventListener("click", (event) => {
        const button = event.target.closest("[data-page]");
        if (!button || button.disabled) return;
        state.page = Number(button.dataset.page);
        renderTable();
    });

    searchInput.addEventListener("input", () => { state.page = 1; renderTable(); });
    pageSizeSelect.addEventListener("change", () => { state.pageSize = Number(pageSizeSelect.value); state.page = 1; renderTable(); });
    fichaSelect.addEventListener("change", loadSelectedFicha);
    dateInput.addEventListener("change", loadSelectedFicha);
    journeySelect.addEventListener("change", loadSelectedFicha);

    markAllButton.addEventListener("click", () => {
        const visible = filteredApprentices();
        visible.forEach((item) => { item.estado = "presente"; });
        renderTable();
        renderSummary();
        showMessage(`${visible.length} aprendices marcados como presentes.`);
    });

    saveButton.addEventListener("click", async () => {
        saveButton.disabled = true;
        const original = saveButton.innerHTML;
        saveButton.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando...';
        try {
            const data = await apiRequest("/api/attendance", {
                method: "POST",
                body: JSON.stringify({
                    ficha: fichaSelect.value,
                    fecha: dateInput.value,
                    jornada: journeySelect.value,
                    aprendices: state.aprendices.map((item) => ({
                        identificacion: item.identificacion,
                        estado: item.estado,
                        observacion: item.observacion
                    }))
                })
            });
            state.lastUpdated = data.ultima_actualizacion;
            renderSummary();
            showMessage(data.message || "Asistencia guardada correctamente.");
        } catch (error) {
            showMessage(error.message, "error");
        } finally {
            saveButton.innerHTML = original;
            saveButton.disabled = state.aprendices.length === 0;
        }
    });

    initialize();
})();
