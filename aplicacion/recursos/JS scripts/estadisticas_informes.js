(function () {
    "use strict";
    const $ = (id) => document.getElementById(id);
    const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const number = (value) => new Intl.NumberFormat("es-CO").format(value);
    const date = (value) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
    const stamp = (value) => new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
    let current = null, reports = [], studentPage = 0, reportPage = 0, saving = false, canManageReports = false;

    function message(text, error = false) {
        $("report-message").textContent = text;
        $("report-message").hidden = false;
        $("report-message").classList.toggle("error", error);
    }

    function studentRows(students) {
        return students.map((student) => `<tr><td><strong>${esc(student.nombre)}</strong><small>${esc(student.identificacion)}</small></td><td>${esc(student.ficha)}</td><td>${student.counts.presente}</td><td>${student.counts.tardanza}</td><td>${student.counts.ausente}</td><td>${student.counts.justificado}</td><td><span class="rate-chip ${student.attendance < 70 ? "low" : ""}">${student.attendance}%</span></td></tr>`).join("");
    }

    function renderStudents() {
        const query = $("statistics-search").value.trim().toLocaleLowerCase("es");
        const students = (current?.students || []).filter((student) => `${student.nombre} ${student.identificacion}`.toLocaleLowerCase("es").includes(query));
        studentPage = Math.min(studentPage, Math.max(0, Math.ceil(students.length / 10) - 1));
        $("statistics-students").innerHTML = studentRows(students.slice(studentPage * 10, studentPage * 10 + 10)) || '<tr><td colspan="7" class="report-empty">No hay aprendices con registros para esta consulta.</td></tr>';
        $("student-count").textContent = `${students.length} aprendices · Página ${studentPage + 1} de ${Math.max(1, Math.ceil(students.length / 10))}`;
        $("students-prev").disabled = studentPage === 0;
        $("students-next").disabled = (studentPage + 1) * 10 >= students.length;
    }

    function renderFichaOptions(data) {
        const options = [new Option("Todas las fichas", "")];
        (data.filters.fichas || []).forEach((ficha) => options.push(new Option(`${ficha.codigo} · ${ficha.programa}`, ficha.codigo)));
        $("dashboard-ficha").replaceChildren(...options);
        $("dashboard-ficha").value = data.filters.ficha || "";
    }

    window.addEventListener("dashboard:data", ({ detail: data }) => {
        current = data;
        renderFichaOptions(data);
        $("dashboard-sync").textContent = `Actualizado ${new Intl.DateTimeFormat("es-CO", { timeStyle: "short" }).format(new Date(data.generatedAt))} · cada 30 s`;
        $("dashboard-scope").textContent = `${data.filters.ficha ? `Ficha ${data.filters.ficha}` : "Todas las fichas"} · ${date(data.filters.from)} — ${date(data.filters.to)}`;
        renderStudents();
    });

    function renderReports() {
        const query = $("report-search").value.trim().toLocaleLowerCase("es");
        const status = $("report-status").value;
        const list = reports.filter((report) => (status === "all" || report.status === status) && `${report.filters.ficha || "Todas las fichas"} ${report.filters.from} ${report.filters.to} ${report.createdBy}`.toLocaleLowerCase("es").includes(query));
        reportPage = Math.min(reportPage, Math.max(0, Math.ceil(list.length / 6) - 1));
        $("reports-list").innerHTML = list.slice(reportPage * 6, reportPage * 6 + 6).map((report) => `<article class="saved-report ${report.status === "archived" ? "is-archived" : ""}"><span class="saved-file-icon"><i class="far fa-file-pdf" aria-hidden="true"></i></span><div><h3>${report.filters.ficha ? `Ficha ${esc(report.filters.ficha)}` : "Informe general"}</h3><p>${esc(date(report.filters.from))} — ${esc(date(report.filters.to))}${report.filters.jornada ? ` · ${esc(report.filters.jornada)}` : ""}</p><small>${esc(report.createdBy)} · ${esc(stamp(report.createdAt))} · ${report.students} aprendices · ${report.total} registros${report.archivedAt ? ` · Archivado ${esc(stamp(report.archivedAt))}` : ""}</small></div><span class="saved-badge">${report.status === "archived" ? "Archivado" : "Activo"}</span><div class="saved-actions"><button class="report-btn secondary" data-preview="${report.id}">Ver</button><button class="report-btn primary" data-pdf="${report.id}"><i class="fas fa-download" aria-hidden="true"></i> PDF</button>${canManageReports ? `<button class="report-btn secondary" data-${report.status === "archived" ? "restore" : "archive"}="${report.id}">${report.status === "archived" ? "Restaurar" : "Archivar"}</button><button class="report-btn danger" data-delete="${report.id}">Eliminar</button>` : ""}</div></article>`).join("") || '<div class="report-empty"><i class="far fa-folder-open" aria-hidden="true"></i><strong>No hay informes para mostrar</strong><p>Ajusta la búsqueda o el filtro de estado.</p></div>';
        $("report-count").textContent = `${list.length} informes · Página ${reportPage + 1} de ${Math.max(1, Math.ceil(list.length / 6))}`;
        $("reports-prev").disabled = reportPage === 0;
        $("reports-next").disabled = (reportPage + 1) * 6 >= list.length;
    }

    async function loadReports() {
        try {
            const data = await SenaReports.request("/api/reports");
            reports = data.reports;
            canManageReports = Boolean(data.permissions?.manage);
            $("report-retention").textContent = `Retención: máximo ${data.retention.limit} informes. ${data.retention.strategy}`;
            renderReports();
        } catch (error) {
            $("reports-list").textContent = error.message;
        }
    }

    $("dashboard-filters").addEventListener("submit", async (event) => {
        event.preventDefault();
        if (saving) return;
        saving = true;
        const button = $("generate-report");
        button.disabled = true;
        try {
            const data = await window.SenaDashboard.refresh();
            if (!data) throw new Error("Revisa los filtros y vuelve a intentar.");
            const result = await SenaReports.create(data.filters);
            message(`Informe guardado: ${result.report.students} aprendices y ${result.report.total} registros. Ya puedes descargarlo en PDF desde el historial.`);
            reportPage = 0;
            $("report-search").value = "";
            await loadReports();
            $("saved-reports").scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (error) {
            message(error.message, true);
        } finally {
            saving = false;
            button.disabled = false;
        }
    });

    $("reports-list").addEventListener("click", async (event) => {
        const button = event.target.closest("[data-pdf], [data-preview], [data-archive], [data-restore], [data-delete]");
        if (!button) return;
        button.disabled = true;
        try {
            if (button.dataset.pdf) {
                await SenaReports.download(button.dataset.pdf);
                message("PDF descargado. El informe permanece disponible en el historial.");
            } else if (button.dataset.archive) {
                await SenaReports.archive(button.dataset.archive);
                message("Informe archivado. Puedes restaurarlo desde el filtro Archivados.");
                await loadReports();
            } else if (button.dataset.restore) {
                await SenaReports.restore(button.dataset.restore);
                message("Informe restaurado al historial activo.");
                await loadReports();
            } else if (button.dataset.delete) {
                if (!window.confirm("¿Eliminar permanentemente este informe? Esta acción no se puede deshacer.")) return;
                await SenaReports.remove(button.dataset.delete);
                message("Informe eliminado permanentemente.");
                await loadReports();
            } else {
                const { report } = await SenaReports.request(`/api/reports/${button.dataset.preview}`);
                $("preview-title").textContent = report.filters.ficha ? `Ficha ${report.filters.ficha}` : "Informe general";
                $("preview-content").innerHTML = `<p>${esc(date(report.filters.from))} — ${esc(date(report.filters.to))} · ${esc(report.createdBy)}</p><p class="preview-summary">${report.students.length} aprendices · ${report.distribution.total} registros · ${report.distribution.attendance}% presentes</p><p>Generado ${esc(stamp(report.createdAt))}. Copia del corte original.</p><div class="report-table-wrap"><table class="report-table"><thead><tr><th>Aprendiz</th><th>Ficha</th><th>Presentes</th><th>Tardanzas</th><th>Ausentes</th><th>Justificados</th><th>Asistencia</th></tr></thead><tbody>${studentRows(report.students)}</tbody></table></div>`;
                $("preview-pdf").href = `/api/reports/${report.id}/pdf`;
                $("preview-pdf").setAttribute("download", "");
                $("report-preview").showModal();
            }
        } catch (error) {
            message(error.message, true);
        } finally {
            button.disabled = false;
        }
    });

    $("close-preview").addEventListener("click", () => $("report-preview").close());
    $("statistics-search").addEventListener("input", () => { studentPage = 0; renderStudents(); });
    $("report-search").addEventListener("input", () => { reportPage = 0; renderReports(); });
    $("report-status").addEventListener("change", () => { reportPage = 0; renderReports(); });
    $("students-prev").addEventListener("click", () => { studentPage--; renderStudents(); });
    $("students-next").addEventListener("click", () => { studentPage++; renderStudents(); });
    $("reports-prev").addEventListener("click", () => { reportPage--; renderReports(); });
    $("reports-next").addEventListener("click", () => { reportPage++; renderReports(); });
    $("refresh-reports").addEventListener("click", loadReports);
    loadReports();
})();
