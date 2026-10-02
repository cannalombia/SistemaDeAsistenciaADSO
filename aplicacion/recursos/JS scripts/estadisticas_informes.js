(function () {
    "use strict";
    const $ = (id) => document.getElementById(id);
    const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const number = (value) => new Intl.NumberFormat("es-CO").format(value);
    const date = (value) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
    const stamp = (value) => new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
    const statuses = { presente: "Presentes", tardanza: "Tardanzas", ausente: "Ausentes", justificado: "Justificados" };
    const colors = { presente: "#39b54a", tardanza: "#f5a609", ausente: "#ff454d", justificado: "#2475d9" };
    let current = null, reports = [], studentPage = 0, reportPage = 0, saving = false, canManageReports = false;
    function message(text, error = false) { $("report-message").textContent = text; $("report-message").hidden = false; $("report-message").classList.toggle("error", error); }
    function studentRows(students) {
        return students.map((s) => `<tr><td><strong>${esc(s.nombre)}</strong><small>${esc(s.identificacion)}</small></td><td>${esc(s.ficha)}</td><td>${s.counts.presente}</td><td>${s.counts.tardanza}</td><td>${s.counts.ausente}</td><td>${s.counts.justificado}</td><td><span class="rate-chip ${s.attendance < 70 ? "low" : ""}">${s.attendance}%</span></td></tr>`).join("");
    }
    function renderStudents() {
        const query = $("statistics-search").value.trim().toLocaleLowerCase("es");
        const students = (current?.students || []).filter((s) => `${s.nombre} ${s.identificacion}`.toLocaleLowerCase("es").includes(query));
        studentPage = Math.min(studentPage, Math.max(0, Math.ceil(students.length / 10) - 1));
        $("statistics-students").innerHTML = studentRows(students.slice(studentPage * 10, studentPage * 10 + 10)) || '<tr><td colspan="7" class="report-empty">No hay aprendices con registros para esta consulta.</td></tr>';
        $("student-count").textContent = `${students.length} aprendices · Página ${studentPage + 1} de ${Math.max(1, Math.ceil(students.length / 10))}`;
        $("students-prev").disabled = studentPage === 0; $("students-next").disabled = (studentPage + 1) * 10 >= students.length;
    }
    function renderTimeline(data) {
        const days = data.timeline;
        $("daily-chart").innerHTML = days.map((day, index) => `<button type="button" class="day-bar ${day.total ? "" : "no-data"}" data-day="${index}" aria-label="${esc(date(day.date))}: ${day.total ? `${day.percentage}% presentes, ${day.total} registros` : "sin registros"}"><span class="bar-value">${day.total ? `${day.percentage}%` : "—"}</span><span class="bar-track"><i style="height:${day.total ? Math.max(2, day.percentage) : 0}%"></i></span><span class="bar-label">${esc(day.date.slice(8))}/${esc(day.date.slice(5, 7))}</span></button>`).join("");
        $("chart-detail").textContent = "Selecciona un día. Los días sin registros no se incluyen en el porcentaje.";
    }
    function renderDistribution(data) {
        let offset = 0;
        const segments = Object.keys(statuses).map((key) => { const start = offset; offset += data.distribution.total ? data.distribution.counts[key] / data.distribution.total * 100 : 0; return `${colors[key]} ${start}% ${offset}%`; });
        $("statistics-donut").style.background = data.distribution.total ? `conic-gradient(${segments.join(",")})` : "#e7eeeb";
        $("records-total").textContent = number(data.distribution.total);
        $("statistics-donut").setAttribute("aria-label", Object.keys(statuses).map((key) => `${statuses[key]}: ${data.distribution.counts[key]}`).join(", "));
        $("statistics-distribution").innerHTML = Object.keys(statuses).map((key) => `<div><span><i style="background:${colors[key]}"></i>${statuses[key]}</span><strong>${number(data.distribution.counts[key])}</strong><small>${data.distribution.percentages[key]}%</small></div>`).join("");
    }
    window.addEventListener("dashboard:data", ({ detail: data }) => {
        current = data;
        $("dashboard-ficha").innerHTML = '<option value="">Todas las fichas</option>' + data.filters.fichas.map((f) => `<option value="${esc(f.codigo)}">${esc(f.codigo)} · ${esc(f.programa)}</option>`).join("");
        $("dashboard-ficha").value = data.filters.ficha;
        $("dashboard-sync").textContent = `Actualizado ${new Intl.DateTimeFormat("es-CO", { timeStyle: "short" }).format(new Date(data.generatedAt))} · cada 30 s`;
        $("dashboard-scope").textContent = `${data.filters.ficha ? `Ficha ${data.filters.ficha}` : "Todas las fichas"} · ${date(data.filters.from)} — ${date(data.filters.to)}`;
        renderTimeline(data); renderDistribution(data); renderStudents();
    });
    $("daily-chart").addEventListener("click", (event) => {
        const button = event.target.closest("[data-day]"); if (!button || !current) return;
        const day = current.timeline[Number(button.dataset.day)];
        document.querySelectorAll("[data-day]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
        $("chart-detail").textContent = `${date(day.date)} · ${day.total ? `${day.counts.presente} presentes, ${day.counts.tardanza} tardanzas, ${day.counts.ausente} ausentes y ${day.counts.justificado} justificados. ${day.percentage}% de presentes.` : "Sin asistencia guardada."}`;
    });
    function renderReports() {
        const query = $("report-search").value.trim().toLocaleLowerCase("es");
        const status = $("report-status").value;
        const list = reports.filter((r) => (status === "all" || r.status === status) && `${r.filters.ficha || "Todas las fichas"} ${r.filters.from} ${r.filters.to} ${r.createdBy}`.toLocaleLowerCase("es").includes(query));
        reportPage = Math.min(reportPage, Math.max(0, Math.ceil(list.length / 6) - 1));
        $("reports-list").innerHTML = list.slice(reportPage * 6, reportPage * 6 + 6).map((r) => `<article class="saved-report ${r.status === "archived" ? "is-archived" : ""}"><span class="saved-file-icon"><i class="far fa-file-pdf" aria-hidden="true"></i></span><div><h3>${r.filters.ficha ? `Ficha ${esc(r.filters.ficha)}` : "Informe general"}</h3><p>${esc(date(r.filters.from))} — ${esc(date(r.filters.to))}${r.filters.jornada ? ` · ${esc(r.filters.jornada)}` : ""}</p><small>${esc(r.createdBy)} · ${esc(stamp(r.createdAt))} · ${r.students} aprendices · ${r.total} registros${r.archivedAt ? ` · Archivado ${esc(stamp(r.archivedAt))}` : ""}</small></div><span class="saved-badge">${r.status === "archived" ? "Archivado" : "Activo"}</span><div class="saved-actions"><button class="report-btn secondary" data-preview="${r.id}">Ver</button><button class="report-btn primary" data-pdf="${r.id}"><i class="fas fa-download" aria-hidden="true"></i> PDF</button>${canManageReports ? `<button class="report-btn secondary" data-${r.status === "archived" ? "restore" : "archive"}="${r.id}">${r.status === "archived" ? "Restaurar" : "Archivar"}</button><button class="report-btn danger" data-delete="${r.id}">Eliminar</button>` : ""}</div></article>`).join("") || '<div class="report-empty"><i class="far fa-folder-open" aria-hidden="true"></i><strong>No hay informes para mostrar</strong><p>Ajusta la búsqueda o el filtro de estado.</p></div>';
        $("report-count").textContent = `${list.length} informes · Página ${reportPage + 1} de ${Math.max(1, Math.ceil(list.length / 6))}`;
        $("reports-prev").disabled = reportPage === 0; $("reports-next").disabled = (reportPage + 1) * 6 >= list.length;
    }
    async function loadReports() {
        try { const data = await SenaReports.request("/api/reports"); reports = data.reports; canManageReports = Boolean(data.permissions?.manage); $("report-retention").textContent = `Retención: máximo ${data.retention.limit} informes. ${data.retention.strategy}`; renderReports(); }
        catch (error) { $("reports-list").textContent = error.message; }
    }
    $("dashboard-filters").addEventListener("submit", async (event) => {
        event.preventDefault(); if (saving) return; saving = true;
        const button = $("generate-report"); button.disabled = true;
        try {
            const data = await window.SenaDashboard.refresh();
            if (!data) throw new Error("Revisa los filtros y vuelve a intentar.");
            button.disabled = true;
            const result = await SenaReports.create(data.filters);
            message(`Informe guardado: ${result.report.students} aprendices y ${result.report.total} registros. Ya puedes descargarlo en PDF desde el historial.`);
            reportPage = 0; $("report-search").value = ""; await loadReports();
            $("saved-reports").scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (error) { message(error.message, true); }
        finally { saving = false; button.disabled = false; }
    });
    $("reports-list").addEventListener("click", async (event) => {
        const button = event.target.closest("[data-pdf], [data-preview], [data-archive], [data-restore], [data-delete]"); if (!button) return;
        button.disabled = true;
        try {
            if (button.dataset.pdf) { await SenaReports.download(button.dataset.pdf); message("PDF descargado. El informe permanece disponible en el historial."); }
            else if (button.dataset.archive) { await SenaReports.archive(button.dataset.archive); message("Informe archivado. Puedes restaurarlo desde el filtro Archivados."); await loadReports(); }
            else if (button.dataset.restore) { await SenaReports.restore(button.dataset.restore); message("Informe restaurado al historial activo."); await loadReports(); }
            else if (button.dataset.delete) {
                if (!window.confirm("¿Eliminar permanentemente este informe? Esta acción no se puede deshacer.")) return;
                await SenaReports.remove(button.dataset.delete); message("Informe eliminado permanentemente."); await loadReports();
            } else {
                const { report } = await SenaReports.request(`/api/reports/${button.dataset.preview}`);
                $("preview-title").textContent = report.filters.ficha ? `Ficha ${report.filters.ficha}` : "Informe general";
                $("preview-content").innerHTML = `<p>${esc(date(report.filters.from))} — ${esc(date(report.filters.to))} · ${esc(report.createdBy)}</p><p class="preview-summary">${report.students.length} aprendices · ${report.distribution.total} registros · ${report.distribution.attendance}% presentes</p><p>Generado ${esc(stamp(report.createdAt))}. Copia del corte original.</p><div class="report-table-wrap"><table class="report-table"><thead><tr><th>Aprendiz</th><th>Ficha</th><th>Presentes</th><th>Tardanzas</th><th>Ausentes</th><th>Justificados</th><th>Asistencia</th></tr></thead><tbody>${studentRows(report.students)}</tbody></table></div>`;
                $("preview-pdf").href = `/api/reports/${report.id}/pdf`; $("preview-pdf").setAttribute("download", "");
                $("report-preview").showModal();
            }
        } catch (error) { message(error.message, true); }
        finally { button.disabled = false; }
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
