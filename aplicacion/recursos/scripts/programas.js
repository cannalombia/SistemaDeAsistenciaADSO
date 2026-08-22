// Funciones exclusivas del directorio de programas.
(function () {
    "use strict";

    const { escapeHtml, showToast, openDialog } = window.SenaInterfaz;

    function normalizeProgramSearch(value) {
        return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
    }

    async function requestProgramApi(path = "", options = {}) {
        const response = await fetch(`/api/programs${path}`, {
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", ...(options.headers || {}) },
            ...options
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "No fue posible consultar los programas.");
        return data;
    }

    function programStatusClass(status) {
        const normalized = normalizeProgramSearch(status);
        if (normalized === "activo") return "program-status-active";
        if (normalized === "en revision") return "program-status-review";
        return "program-status-inactive";
    }

    function programFilterOptions(select, values, placeholder) {
        const selected = select.value;
        select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` + values
            .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
            .join("");
        if (values.includes(selected)) select.value = selected;
    }

    function programFichaFilterOptions(select, fichas) {
        const selected = select.value;
        select.innerHTML = '<option value="">Todas las fichas</option>' + fichas
            .map((ficha) => `<option value="${escapeHtml(ficha.number)}">Ficha ${escapeHtml(ficha.number)} · ${escapeHtml(ficha.programName)}</option>`)
            .join("");
        if (fichas.some((ficha) => ficha.number === selected)) select.value = selected;
    }

    function programPaginationMarkup(current, total) {
        const pageButton = (page) => `<button type="button" data-program-page="${page}" class="${page === current ? "active" : ""}" ${page === current ? 'aria-current="page"' : ""}>${page}</button>`;
        const pages = [];
        for (let page = 1; page <= total; page += 1) {
            if (total <= 7 || page === 1 || page === total || Math.abs(page - current) <= 1) pages.push(pageButton(page));
            else if (pages.at(-1) !== '<span class="program-page-gap">…</span>') pages.push('<span class="program-page-gap">…</span>');
        }
        return `<button type="button" data-program-page="${current - 1}" ${current === 1 ? "disabled" : ""} aria-label="Página anterior"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>${pages.join("")}<button type="button" data-program-page="${current + 1}" ${current === total ? "disabled" : ""} aria-label="Página siguiente"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>`;
    }

    function programRowMarkup(program, workflowStates) {
        const statusOptions = workflowStates.filter((status) => status !== program.status).map((status) => `
            <button type="button" data-program-action="status" data-code="${escapeHtml(program.code)}" data-status="${escapeHtml(status)}">
                <i class="fas ${status === "Activo" ? "fa-circle-check" : status === "Inactivo" ? "fa-circle-pause" : "fa-clock-rotate-left"}" aria-hidden="true"></i>
                Cambiar a ${escapeHtml(status)}
            </button>`).join("");
        return `
            <tr>
                <td data-label="Código"><span class="program-code">${escapeHtml(program.code)}</span></td>
                <td data-label="Programa"><div class="program-name-cell"><span class="program-row-icon"><i class="fas fa-book" aria-hidden="true"></i></span><div><strong>${escapeHtml(program.name)}</strong><small>${program.instructors ? `${escapeHtml(program.instructors)} instructor${program.instructors === 1 ? "" : "es"} vinculado${program.instructors === 1 ? "" : "s"}` : "Sin instructores vinculados"}</small></div></div></td>
                <td data-label="Nivel">${escapeHtml(program.level)}</td>
                <td data-label="Duración">${escapeHtml(program.duration)}</td>
                <td data-label="Modalidad"><span class="program-modality"><i class="fas fa-location-dot" aria-hidden="true"></i>${escapeHtml(program.modality)}</span></td>
                <td data-label="Fichas"><span class="program-ficha-count">${escapeHtml(program.fichas)}</span></td>
                <td data-label="Estado"><span class="program-status ${programStatusClass(program.status)}"><i aria-hidden="true"></i>${escapeHtml(program.status)}</span></td>
                <td class="program-actions-cell" data-label="Acciones">
                    <button type="button" class="program-icon-button" data-program-action="view" data-code="${escapeHtml(program.code)}" aria-label="Ver detalle de ${escapeHtml(program.name)}"><i class="fas fa-eye" aria-hidden="true"></i></button>
                    <button type="button" class="program-icon-button" data-program-action="edit" data-code="${escapeHtml(program.code)}" aria-label="Editar ${escapeHtml(program.name)}"><i class="fas fa-pen" aria-hidden="true"></i></button>
                    <div class="program-more-wrap">
                        <button type="button" class="program-icon-button" data-program-action="more" data-code="${escapeHtml(program.code)}" aria-label="Más acciones para ${escapeHtml(program.name)}" aria-expanded="false"><i class="fas fa-ellipsis-vertical" aria-hidden="true"></i></button>
                        <div class="program-action-menu" hidden>
                            ${statusOptions}
                            ${program.fichas ? `<button type="button" data-program-action="view" data-code="${escapeHtml(program.code)}"><i class="fas fa-folder-open" aria-hidden="true"></i>Ver fichas vinculadas</button>` : ""}
                        </div>
                    </div>
                </td>
            </tr>`;
    }

    function openProgramDetail(program) {
        const fichas = program.linkedFichas || [];
        const fichaMarkup = fichas.length ? `
            <div class="program-detail-fichas"><h3>Fichas vinculadas (${fichas.length})</h3>
                <div class="program-detail-table-wrap"><table><thead><tr><th>Ficha</th><th>Jornada</th><th>Modalidad</th><th>Estado</th></tr></thead><tbody>
                    ${fichas.map((ficha) => `<tr><td>${escapeHtml(ficha.number)}</td><td>${escapeHtml(ficha.journey)}</td><td>${escapeHtml(ficha.modality)}</td><td>${escapeHtml(ficha.status)}</td></tr>`).join("")}
                </tbody></table></div>
                <a class="program-detail-link" href="fichas.html">Abrir módulo de fichas <i class="fas fa-arrow-right" aria-hidden="true"></i></a>
            </div>` : '<p class="program-detail-empty"><i class="fas fa-folder-open" aria-hidden="true"></i>Este programa todavía no tiene fichas vinculadas.</p>';
        openDialog({
            title: "Detalle del programa",
            dialogClass: "program-detail-dialog",
            content: `<div class="program-detail-hero"><span class="program-detail-icon"><i class="fas fa-book-open" aria-hidden="true"></i></span><div><span class="program-code">Código ${escapeHtml(program.code)}</span><h3>${escapeHtml(program.name)}</h3><span class="program-status ${programStatusClass(program.status)}"><i aria-hidden="true"></i>${escapeHtml(program.status)}</span></div></div>
                <dl class="program-detail-grid"><div><dt>Nivel</dt><dd>${escapeHtml(program.level)}</dd></div><div><dt>Duración</dt><dd>${escapeHtml(program.duration)}</dd></div><div><dt>Modalidad</dt><dd>${escapeHtml(program.modality)}</dd></div><div><dt>Instructores</dt><dd>${escapeHtml(program.instructors)}</dd></div></dl>${fichaMarkup}`
        });
    }

    function openProgramForm(program, workflowStates, onSaved) {
        const editing = Boolean(program);
        openDialog({
            title: editing ? "Editar programa" : "Nuevo programa",
            submitLabel: editing ? "Guardar cambios" : "Crear programa",
            dialogClass: "program-form-dialog",
            fields: [
                { name: "code", label: "Código", value: program?.code || "", readonly: editing, maxlength: 12, placeholder: "Ej. 1" },
                { name: "name", label: "Nombre del programa", value: program?.name || "", maxlength: 160, placeholder: "Nombre académico" },
                { name: "level", label: "Nivel de formación", value: program?.level || "", maxlength: 60, placeholder: "Ej. Tecnólogo" },
                { name: "duration", label: "Duración", value: program?.duration || "", maxlength: 60, placeholder: "Ej. 27 Meses" },
                { name: "status", label: "Estado", type: "select", value: program?.status || "Activo", options: workflowStates }
            ],
            onSubmit: async (values) => {
                const data = await requestProgramApi(editing ? `/${encodeURIComponent(program.code)}` : "", {
                    method: editing ? "PATCH" : "POST",
                    body: JSON.stringify(values)
                });
                onSaved(data);
                showToast(data.message || `Programa ${editing ? "actualizado" : "creado"} correctamente.`);
            }
        });
    }

    function downloadProgramCsv(programs) {
        if (!programs.length) return showToast("No hay programas visibles para exportar.", "error");
        const cell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
        const rows = [
            ["Código", "Programa", "Nivel", "Duración", "Modalidad", "Fichas", "Instructores", "Estado"],
            ...programs.map((program) => [program.code, program.name, program.level, program.duration, program.modality, program.fichas, program.instructors, program.status])
        ];
        const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `programas-formacion-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 0);
        showToast(`${programs.length} programa${programs.length === 1 ? "" : "s"} exportado${programs.length === 1 ? "" : "s"}.`);
    }

    function setupPrograms() {
        const table = document.getElementById("tablaProgramas");
        if (!table) return;
        const elements = {
            search: document.getElementById("program-search"), level: document.getElementById("program-level-filter"),
            ficha: document.getElementById("program-ficha-filter"),
            status: document.getElementById("program-status-filter"), modality: document.getElementById("program-modality-filter"),
            clear: document.getElementById("program-clear-filters"), export: document.getElementById("program-export"),
            pageSize: document.getElementById("program-page-size"), pagination: document.getElementById("program-pagination"),
            paginationSummary: document.getElementById("program-pagination-summary"), listSummary: document.getElementById("program-list-summary"),
            distribution: document.getElementById("program-distribution"), featured: document.getElementById("program-featured")
        };
        const state = { programs: [], filtered: [], featured: null, workflowStates: ["Activo", "Inactivo", "En revisión"], page: 1, pageSize: 10 };

        const renderDistribution = () => {
            const counts = new Map();
            state.filtered.forEach((program) => counts.set(program.level, (counts.get(program.level) || 0) + 1));
            const total = state.filtered.length;
            elements.distribution.innerHTML = [...counts.entries()].sort((left, right) => right[1] - left[1]).map(([level, count], index) => {
                const percentage = total ? Math.round(count / total * 100) : 0;
                return `<div class="program-distribution-row"><div><span>${escapeHtml(level)}</span><strong>${count} · ${percentage}%</strong></div><div class="program-distribution-track"><i class="distribution-tone-${index % 4}" style="width:${percentage}%"></i></div></div>`;
            }).join("") || '<p class="program-empty-state">No hay niveles para los filtros seleccionados.</p>';
        };

        const renderFeatured = () => {
            const program = state.featured;
            elements.featured.innerHTML = program ? `
                <div class="program-featured-hero"><span><i class="fas fa-graduation-cap" aria-hidden="true"></i></span><div><small>Mayor vinculación de fichas</small><h3>${escapeHtml(program.name)}</h3><p>Código ${escapeHtml(program.code)}</p></div></div>
                <div class="program-featured-stats"><div><strong>${escapeHtml(program.duration)}</strong><span>Duración</span></div><div><strong>${escapeHtml(program.fichas)}</strong><span>Fichas</span></div><div><strong>${escapeHtml(program.instructors)}</strong><span>Instructores</span></div></div>
                <div class="program-featured-meta"><span><i class="fas fa-location-dot" aria-hidden="true"></i>${escapeHtml(program.modality)}</span><span class="program-status ${programStatusClass(program.status)}"><i aria-hidden="true"></i>${escapeHtml(program.status)}</span></div>
                <button type="button" class="program-featured-link" data-featured-code="${escapeHtml(program.code)}">Ver detalle del programa <i class="fas fa-arrow-right" aria-hidden="true"></i></button>`
                : '<p class="program-empty-state">No hay un programa destacado disponible.</p>';
        };

        const renderTable = () => {
            const totalPages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
            state.page = Math.min(state.page, totalPages);
            const start = (state.page - 1) * state.pageSize;
            const visible = state.filtered.slice(start, start + state.pageSize);
            table.innerHTML = visible.map((program) => programRowMarkup(program, state.workflowStates)).join("")
                || '<tr><td colspan="8" class="program-empty-state"><i class="fas fa-magnifying-glass" aria-hidden="true"></i>No hay programas que coincidan con la consulta.</td></tr>';
            elements.listSummary.textContent = `${state.filtered.length} programa${state.filtered.length === 1 ? "" : "s"} encontrado${state.filtered.length === 1 ? "" : "s"}`;
            elements.paginationSummary.textContent = state.filtered.length
                ? `Mostrando ${start + 1}-${Math.min(start + state.pageSize, state.filtered.length)} de ${state.filtered.length} programas`
                : "Mostrando 0 de 0 programas";
            elements.pagination.innerHTML = programPaginationMarkup(state.page, totalPages);
        };

        const applyFilters = () => {
            const query = normalizeProgramSearch(elements.search.value);
            state.filtered = state.programs.filter((program) => {
                const linkedFichas = Array.isArray(program.linkedFichas) ? program.linkedFichas : [];
                const searchableFichas = linkedFichas.map((ficha) => `${ficha.number} ${ficha.journey} ${ficha.modality}`).join(" ");
                const matchesQuery = !query || normalizeProgramSearch(`${program.code} ${program.name} ${searchableFichas}`).includes(query);
                return matchesQuery && (!elements.level.value || program.level === elements.level.value)
                    && (!elements.ficha.value || linkedFichas.some((ficha) => ficha.number === elements.ficha.value))
                    && (!elements.status.value || program.status === elements.status.value)
                    && (!elements.modality.value || program.modality === elements.modality.value);
            });
            renderTable();
            renderDistribution();
        };

        const applyPayload = (data) => {
            state.programs = Array.isArray(data.programs) ? data.programs : [];
            state.featured = data.featured || null;
            state.workflowStates = data.workflowStates || state.workflowStates;
            programFichaFilterOptions(elements.ficha, data.filters?.fichas || []);
            programFilterOptions(elements.level, data.filters?.levels || [], "Todos los niveles");
            programFilterOptions(elements.status, data.filters?.states || [], "Todos los estados");
            programFilterOptions(elements.modality, data.filters?.modalities || [], "Todas las modalidades");
            document.getElementById("program-stat-active").textContent = data.summary?.active ?? 0;
            document.getElementById("program-stat-levels").textContent = data.summary?.levels ?? 0;
            document.getElementById("program-stat-fichas").textContent = data.summary?.fichas ?? 0;
            document.getElementById("program-stat-review").textContent = data.summary?.review ?? 0;
            document.getElementById("program-stat-level-names").textContent = data.summary?.levelNames?.join(" · ") || "Sin niveles registrados";
            applyFilters();
            renderFeatured();
        };

        [elements.search, elements.ficha, elements.level, elements.status, elements.modality].forEach((control) => {
            control.addEventListener(control === elements.search ? "input" : "change", () => { state.page = 1; applyFilters(); });
        });
        elements.clear.addEventListener("click", () => {
            elements.search.value = "";
            elements.ficha.value = "";
            elements.level.value = "";
            elements.status.value = "";
            elements.modality.value = "";
            state.page = 1;
            applyFilters();
            elements.search.focus();
        });
        elements.pageSize.addEventListener("change", () => { state.pageSize = Number(elements.pageSize.value) || 10; state.page = 1; renderTable(); });
        elements.pagination.addEventListener("click", (event) => {
            const button = event.target.closest("[data-program-page]");
            if (!button || button.disabled) return;
            state.page = Number(button.dataset.programPage);
            renderTable();
        });
        elements.export.addEventListener("click", () => downloadProgramCsv(state.filtered));
        document.querySelector('[data-action="new-program"]')?.addEventListener("click", () => openProgramForm(null, state.workflowStates, applyPayload));
        elements.featured.addEventListener("click", (event) => {
            const button = event.target.closest("[data-featured-code]");
            const program = state.programs.find((item) => item.code === button?.dataset.featuredCode);
            if (program) openProgramDetail(program);
        });
        table.addEventListener("click", async (event) => {
            const button = event.target.closest("[data-program-action]");
            if (!button) return;
            const program = state.programs.find((item) => item.code === button.dataset.code);
            if (!program) return;
            if (button.dataset.programAction === "more") {
                const menu = button.nextElementSibling;
                document.querySelectorAll(".program-action-menu").forEach((item) => { if (item !== menu) item.hidden = true; });
                menu.hidden = !menu.hidden;
                button.setAttribute("aria-expanded", String(!menu.hidden));
            } else if (button.dataset.programAction === "view") {
                openProgramDetail(program);
            } else if (button.dataset.programAction === "edit") {
                openProgramForm(program, state.workflowStates, applyPayload);
            } else if (button.dataset.programAction === "status") {
                try {
                    const data = await requestProgramApi(`/${encodeURIComponent(program.code)}`, { method: "PATCH", body: JSON.stringify({ status: button.dataset.status }) });
                    applyPayload(data);
                    showToast(data.message || "Estado actualizado correctamente.");
                } catch (error) {
                    showToast(error.message, "error");
                }
            }
        });
        document.addEventListener("click", (event) => {
            if (event.target.closest(".program-more-wrap")) return;
            document.querySelectorAll(".program-action-menu").forEach((menu) => { menu.hidden = true; });
        });

        requestProgramApi().then(applyPayload).catch((error) => {
            table.innerHTML = `<tr><td colspan="8" class="program-empty-state program-load-error"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i>${escapeHtml(error.message)}</td></tr>`;
            elements.listSummary.textContent = "No fue posible cargar la información";
            showToast(error.message, "error");
        });
    }

    setupPrograms();
})();
