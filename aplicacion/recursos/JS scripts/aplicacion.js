// Funciones compartidas del Sistema de Asistencia SENA.
(function () {
    "use strict";

    const page = window.location.pathname.split("/").pop() || "index.html";
    const DATA_PREFIX = "sena-app-data-v1:";

    const defaults = window.SenaDatosDemostracion || {
        fichas: [], schedules: [], environments: [], students: []
    };

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function loadData(key) {
        try {
            const stored = JSON.parse(localStorage.getItem(`${DATA_PREFIX}${key}`));
            return Array.isArray(stored) ? stored : clone(defaults[key]);
        } catch (_error) {
            return clone(defaults[key]);
        }
    }

    function saveData(key, value) {
        localStorage.setItem(`${DATA_PREFIX}${key}`, JSON.stringify(value));
    }

    async function trainingApi(path = "/training", options = {}) {
        const response = await fetch(`/api${path}`, {
            credentials: "same-origin",
            ...options,
            headers: { "Content-Type": "application/json", ...(options.headers || {}) }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "No fue posible consultar la formación.");
        return data;
    }

    function confirmTrainingDelete({ title, name, path, onDeleted, warning = "" }) {
        openDialog({
            title,
            dialogClass: "user-confirm-dialog user-delete-dialog",
            content: `<div class="user-confirm-content"><span><i class="fas fa-trash" aria-hidden="true"></i></span><p>Se intentará eliminar <strong>${escapeHtml(name)}</strong>. ${warning ? `<small class="dependency-warning"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i>${escapeHtml(warning)}</small>` : "No tiene dependencias detectadas y se puede eliminar con seguridad."}</p></div>`,
            actionLabel: "Eliminar definitivamente",
            actionClass: "dialog-danger-action",
            onAction: async () => {
                const data = await trainingApi(path, { method: "DELETE" });
                onDeleted(data);
                showToast(data.message);
            }
        });
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function showToast(message, type = "success") {
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
        clearTimeout(showToast.timer);
        showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
    }

    function openDialog({ title, fields = [], submitLabel = "Guardar", onSubmit, content = "", dialogClass = "", actionLabel = "", actionClass = "", onAction }) {
        const overlay = document.createElement("div");
        overlay.className = "app-dialog-overlay";
        const fieldMarkup = fields.map((field) => {
            const required = field.required === false ? "" : "required";
            const readonly = field.readonly ? "readonly" : "";
            const placeholder = field.placeholder ? `placeholder="${escapeHtml(field.placeholder)}"` : "";
            const maxlength = field.maxlength ? `maxlength="${Number(field.maxlength)}"` : "";
            const value = escapeHtml(field.value ?? "");
            if (field.type === "select") {
                const options = (field.options || []).map((option) => {
                    const optionValue = typeof option === "string" ? option : option.value;
                    const optionLabel = typeof option === "string" ? option : option.label;
                    return `<option value="${escapeHtml(optionValue)}" ${optionValue === field.value ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`;
                }).join("");
                return `<label>${escapeHtml(field.label)}<select name="${escapeHtml(field.name)}" ${required}>${options}</select></label>`;
            }
            return `<label>${escapeHtml(field.label)}<input name="${escapeHtml(field.name)}" type="${escapeHtml(field.type || "text")}" value="${value}" ${required} ${readonly} ${placeholder} ${maxlength}></label>`;
        }).join("");
        overlay.innerHTML = `
            <section class="app-dialog ${escapeHtml(dialogClass)}" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
                <div class="app-dialog-header">
                    <h2 id="dialog-title">${escapeHtml(title)}</h2>
                    <button type="button" class="dialog-close" aria-label="Cerrar">&times;</button>
                </div>
                ${content ? `<div class="dialog-content">${content}</div>` : ""}
                ${fields.length ? `<form class="dialog-form">${fieldMarkup}<div class="dialog-actions"><button type="button" class="btn dialog-cancel">Cancelar</button><button type="submit" class="btn">${escapeHtml(submitLabel)}</button></div></form>` : onAction ? `<div class="dialog-actions"><button type="button" class="btn dialog-cancel">Cancelar</button><button type="button" class="btn dialog-confirm ${escapeHtml(actionClass)}">${escapeHtml(actionLabel || "Confirmar")}</button></div>` : `<div class="dialog-actions"><button type="button" class="btn dialog-cancel">Cerrar</button></div>`}
            </section>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector(".dialog-close").addEventListener("click", close);
        overlay.querySelector(".dialog-cancel").addEventListener("click", close);
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) close();
        });
        document.addEventListener("keydown", function escape(event) {
            if (event.key === "Escape") {
                close();
                document.removeEventListener("keydown", escape);
            }
        });
        const form = overlay.querySelector("form");
        if (form) {
            form.addEventListener("submit", async (event) => {
                event.preventDefault();
                const submit = form.querySelector('[type="submit"]');
                submit.disabled = true;
                try {
                    const values = Object.fromEntries(new FormData(form).entries());
                    await onSubmit(values);
                    close();
                } catch (error) {
                    showToast(error.message || "No fue posible guardar.", "error");
                    submit.disabled = false;
                }
            });
            form.querySelector("input, select")?.focus();
        }
        const actionButton = overlay.querySelector(".dialog-confirm");
        if (actionButton) {
            actionButton.addEventListener("click", async () => {
                actionButton.disabled = true;
                try {
                    await onAction();
                    close();
                } catch (error) {
                    showToast(error.message || "No fue posible completar la acción.", "error");
                    actionButton.disabled = false;
                }
            });
        }
    }

    // Contrato pequeño para los módulos de pantalla cargados después de este archivo.
    window.SenaInterfaz = Object.freeze({ escapeHtml, showToast, openDialog });

    function addUniqueRecord(key, record, uniqueField) {
        const records = loadData(key);
        if (records.some((item) => String(item[uniqueField]).toLowerCase() === String(record[uniqueField]).toLowerCase())) {
            throw new Error("Ya existe un registro con ese código.");
        }
        records.push(record);
        saveData(key, records);
        showToast("Registro guardado correctamente.");
        return records;
    }

    function fillSelect(select, values, selected) {
        select.innerHTML = '<option value="">Seleccione...</option>' + values
            .map((value) => `<option value="${escapeHtml(value)}" ${String(value) === String(selected) ? "selected" : ""}>${escapeHtml(value)}</option>`)
            .join("");
    }

    async function setupFichas() {
        const select = document.getElementById("ficha");
        const table = document.getElementById("tablaFichas");
        if (!select || !table) return;
        let state;
        const render = () => {
            const records = state.fichas || [];
            fillSelect(select, records.map((item) => item.code), select.value);
            table.innerHTML = records.filter((item) => !select.value || item.code === select.value).map((item) => `<tr><td>${escapeHtml(item.code)}</td><td>${escapeHtml(item.program)}</td><td>${escapeHtml(item.schedule)}${item.plan ? `<small class="d-block">Lun–Vie · ${escapeHtml(item.plan.start)}–${escapeHtml(item.plan.end)} · ${Number(item.dependencies?.aprendices || 0)}/${item.plan.expectedApprentices} aprendices esperados</small>` : ""}</td><td>${escapeHtml(item.mode)}</td><td>${escapeHtml(item.status)}</td><td><div class="table-crud-actions"><button type="button" class="btn table-edit-action" data-edit-ficha="${escapeHtml(item.id)}" title="Editar"><i class="fas fa-pen"></i></button><button type="button" class="btn table-status-action" data-status-ficha="${escapeHtml(item.id)}" data-next-status="${item.status === "Activa" ? "Inactiva" : "Activa"}" title="${item.status === "Activa" ? "Desactivar" : "Activar"}"><i class="fas ${item.status === "Activa" ? "fa-circle-pause" : "fa-circle-check"}"></i></button><button type="button" class="btn table-delete-action" data-delete-ficha="${escapeHtml(item.id)}" title="Eliminar"><i class="fas fa-trash"></i></button></div></td></tr>`).join("") || '<tr><td colspan="6" class="empty-state">No hay fichas registradas.</td></tr>';
        };
        select.addEventListener("change", render);
        const dialog = (record = {}) => {
            const instructorOptions = [{ value: "", label: "Sin instructor asignado" }, ...state.instructors.map(item => ({ value: item.id, label: item.name }))];
            if (record.instructorId && !instructorOptions.some(item => item.value === record.instructorId)) instructorOptions.push({ value: record.instructorId, label: `Instructor actual #${record.instructorId}` });
            return openDialog({
            title: record.id ? "Editar ficha" : "Nueva ficha", submitLabel: record.id ? "Guardar cambios" : "Crear ficha", fields: [
                { name: "code", label: "Número de ficha", value: record.code || "" },
                { name: "programId", label: "Programa", type: "select", value: record.programId || state.programs[0]?.id, options: state.programs.map(item => ({ value: item.id, label: `${item.id} · ${item.name}` })) },
                { name: "schedule", label: "Jornada", type: "select", value: record.schedule || "Mañana", options: ["Mañana", "Tarde", "Noche", "Mixta"] },
                { name: "mode", label: "Modalidad", type: "select", value: record.mode || "Presencial", options: ["Presencial", "Virtual", "A distancia", "Mixta"] },
                { name: "status", label: "Estado", type: "select", value: record.status || "Activa", options: ["Activa", "Inactiva"] },
                { name: "instructorId", label: "Instructor de referencia (opcional)", type: "select", value: record.instructorId || "", required: false, options: instructorOptions }
            ], onSubmit: async values => {
                state = await trainingApi(record.id ? `/fichas/${encodeURIComponent(record.id)}` : "/fichas", { method: record.id ? "PATCH" : "POST", body: JSON.stringify(values) });
                select.value = values.code; render(); showToast(state.message);
            }
            });
        };
        document.querySelector('[data-action="new-ficha"]')?.addEventListener("click", () => dialog());
        table.addEventListener("click", async event => {
            const edit = event.target.closest("[data-edit-ficha]"); if (edit) return dialog(state.fichas.find(item => item.id === edit.dataset.editFicha));
            const status = event.target.closest("[data-status-ficha]");
            if (status) { try { state = await trainingApi(`/fichas/${encodeURIComponent(status.dataset.statusFicha)}`, { method: "PATCH", body: JSON.stringify({ status: status.dataset.nextStatus }) }); render(); showToast(state.message); } catch (error) { showToast(error.message, "error"); } return; }
            const remove = event.target.closest("[data-delete-ficha]");
            if (remove) { const record = state.fichas.find(item => item.id === remove.dataset.deleteFicha), dependency = record.dependencies || {}; const warning = Object.values(dependency).some(Boolean) ? `Tiene ${dependency.aprendices || 0} aprendiz(es), ${dependency.horarios || 0} horario(s) y ${dependency.asistencias || 0} asistencia(s). Debes desactivarla o resolver esas relaciones; el servidor impedirá el borrado.` : ""; confirmTrainingDelete({ title: "Eliminar ficha", name: `Ficha ${record.code}`, warning, path: `/fichas/${encodeURIComponent(record.id)}`, onDeleted: data => { state = data; select.value = ""; render(); } }); }
        });
        try { state = await trainingApi(); render(); } catch (error) { table.innerHTML = `<tr><td colspan="6" class="empty-state">${escapeHtml(error.message)}</td></tr>`; }
    }

    async function setupSchedules() {
        const select = document.getElementById("ficha");
        const table = document.getElementById("tablaHorarios");
        if (!select || !table) return;
        let state;
        const render = () => {
            const records = state.schedules || [];
            fillSelect(select, state.fichas.map(item => item.code), select.value);
            table.innerHTML = records.filter((item) => !select.value || item.ficha === select.value).map((item) => `<tr><td>${escapeHtml(item.environment)}</td><td>${escapeHtml(item.zone)}</td><td>${escapeHtml(item.day)}</td><td>${escapeHtml(item.instructor)}</td><td>${escapeHtml(item.time)}</td><td>${escapeHtml(item.status)}</td><td><div class="table-crud-actions"><button type="button" class="btn table-edit-action" data-edit-schedule="${escapeHtml(item.id)}" title="Editar"><i class="fas fa-pen"></i></button><button type="button" class="btn table-status-action" data-status-schedule="${escapeHtml(item.id)}" data-next-status="${item.status === "Activo" ? "Inactivo" : "Activo"}" title="${item.status === "Activo" ? "Desactivar" : "Activar"}"><i class="fas ${item.status === "Activo" ? "fa-circle-pause" : "fa-circle-check"}"></i></button><button type="button" class="btn table-delete-action" data-delete-schedule="${escapeHtml(item.id)}" title="Eliminar"><i class="fas fa-trash"></i></button></div></td></tr>`).join("") || '<tr><td colspan="7" class="empty-state">No hay horarios registrados.</td></tr>';
        };
        select.addEventListener("change", render);
        const dialog = (record = {}) => openDialog({
            title: record.id ? "Editar horario" : "Nuevo horario", submitLabel: record.id ? "Guardar cambios" : "Crear horario", fields: [
                { name: "fichaId", label: "Ficha", type: "select", value: state.fichas.find(item => item.code === record.ficha)?.id || state.fichas[0]?.id, options: state.fichas.map(item => ({ value: item.id, label: `${item.code} · ${item.program}` })) },
                { name: "environmentId", label: "Ambiente", type: "select", value: record.environmentId || state.environments[0]?.id, options: state.environments.map(item => ({ value: item.id, label: `${item.code} · ${item.name}` })) },
                { name: "instructorId", label: "Instructor", type: "select", value: record.instructorId || state.instructors[0]?.id, options: state.instructors.map(item => ({ value: item.id, label: item.name })) },
                { name: "day", label: "Día", type: "select", value: record.day || "Lunes", options: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] },
                { name: "start", label: "Hora inicial", type: "time", value: record.start || "07:00" }, { name: "end", label: "Hora final", type: "time", value: record.end || "13:00" },
                { name: "status", label: "Estado", type: "select", value: record.status || "Activo", options: ["Activo", "Inactivo"] }
            ], onSubmit: async values => {
                state = await trainingApi(record.id ? `/schedules/${encodeURIComponent(record.id)}` : "/schedules", { method: record.id ? "PATCH" : "POST", body: JSON.stringify(values) });
                const ficha = state.fichas.find(item => item.id === values.fichaId); if (ficha) select.value = ficha.code;
                render(); showToast(state.message);
            }
        });
        document.querySelector('[data-action="new-schedule"]')?.addEventListener("click", () => dialog());
        table.addEventListener("click", async event => {
            const edit = event.target.closest("[data-edit-schedule]"); if (edit) return dialog(state.schedules.find(item => item.id === edit.dataset.editSchedule));
            const status = event.target.closest("[data-status-schedule]");
            if (status) { try { state = await trainingApi(`/schedules/${encodeURIComponent(status.dataset.statusSchedule)}`, { method: "PATCH", body: JSON.stringify({ status: status.dataset.nextStatus }) }); render(); showToast(state.message); } catch (error) { showToast(error.message, "error"); } return; }
            const remove = event.target.closest("[data-delete-schedule]");
            if (remove) { const record = state.schedules.find(item => item.id === remove.dataset.deleteSchedule), count = record.dependencies?.asistencias || 0; confirmTrainingDelete({ title: "Eliminar horario", name: `${record.day} ${record.time}`, warning: count ? `Tiene ${count} asistencia(s) vinculada(s). Puedes desactivarlo; el servidor impedirá el borrado.` : "", path: `/schedules/${encodeURIComponent(record.id)}`, onDeleted: data => { state = data; render(); } }); }
        });
        try { state = await trainingApi(); render(); } catch (error) { table.innerHTML = `<tr><td colspan="6" class="empty-state">${escapeHtml(error.message)}</td></tr>`; }
    }

    async function setupEnvironments() {
        const table = document.getElementById("tablaAmbientes");
        if (!table) return;
        let state;
        const render = () => {
            table.innerHTML = state.environments.map((item) => `<tr><td>${escapeHtml(item.code)}</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.capacity)}</td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.zone)}</td><td><div class="table-crud-actions"><button type="button" class="btn table-edit-action" data-edit-environment="${escapeHtml(item.id)}" title="Editar"><i class="fas fa-pen"></i></button><button type="button" class="btn table-status-action" data-status-environment="${escapeHtml(item.id)}" data-next-status="${item.status === "Inactivo" ? "Disponible" : "Inactivo"}" title="${item.status === "Inactivo" ? "Activar" : "Desactivar"}"><i class="fas ${item.status === "Inactivo" ? "fa-circle-check" : "fa-circle-pause"}"></i></button><button type="button" class="btn table-delete-action" data-delete-environment="${escapeHtml(item.id)}" title="Eliminar"><i class="fas fa-trash"></i></button></div></td></tr>`).join("") || '<tr><td colspan="7" class="empty-state">No hay ambientes registrados.</td></tr>';
        };
        const dialog = (record = {}) => openDialog({
            title: record.id ? "Editar ambiente" : "Nuevo ambiente", submitLabel: record.id ? "Guardar cambios" : "Crear ambiente", fields: [
                { name: "code", label: "Código", value: record.code || "" }, { name: "name", label: "Nombre", value: record.name || "" },
                { name: "capacity", label: "Capacidad", type: "number", value: record.capacity || "" },
                { name: "type", label: "Tipo", type: "select", value: record.type || "Aula", options: ["Aula", "Laboratorio", "Especializado", "Taller", "Auditorio"] },
                { name: "status", label: "Estado", type: "select", value: record.status || "Disponible", options: ["Disponible", "Ocupado", "Mantenimiento", "Inactivo"] },
                { name: "zone", label: "Zona", value: record.zone || "" }
            ], onSubmit: async values => { state = await trainingApi(record.id ? `/environments/${encodeURIComponent(record.id)}` : "/environments", { method: record.id ? "PATCH" : "POST", body: JSON.stringify(values) }); render(); showToast(state.message); }
        });
        document.querySelector('[data-action="new-environment"]')?.addEventListener("click", () => dialog());
        table.addEventListener("click", async event => {
            const edit = event.target.closest("[data-edit-environment]"); if (edit) return dialog(state.environments.find(item => item.id === edit.dataset.editEnvironment));
            const status = event.target.closest("[data-status-environment]");
            if (status) { try { state = await trainingApi(`/environments/${encodeURIComponent(status.dataset.statusEnvironment)}`, { method: "PATCH", body: JSON.stringify({ status: status.dataset.nextStatus }) }); render(); showToast(state.message); } catch (error) { showToast(error.message, "error"); } return; }
            const remove = event.target.closest("[data-delete-environment]");
            if (remove) { const record = state.environments.find(item => item.id === remove.dataset.deleteEnvironment), count = record.dependencies?.horarios || 0; confirmTrainingDelete({ title: "Eliminar ambiente", name: record.name, warning: count ? `Tiene ${count} horario(s) vinculado(s). Puedes desactivarlo; el servidor impedirá el borrado.` : "", path: `/environments/${encodeURIComponent(record.id)}`, onDeleted: data => { state = data; render(); } }); }
        });
        try { state = await trainingApi(); render(); } catch (error) { table.innerHTML = `<tr><td colspan="7" class="empty-state">${escapeHtml(error.message)}</td></tr>`; }
    }

    function initials(name) {
        return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    }

    function setupAttendance() {
        const list = document.getElementById("student-list");
        const search = document.getElementById("student-search");
        if (!list || !search) return;
        const labels = { presente: "Presente", tarde: "Tardanza", ausente: "Ausente", justificado: "Justificado" };
        const statuses = Object.keys(labels);
        const render = () => {
            const students = loadData("students");
            const query = search.value.trim().toLocaleLowerCase("es");
            list.innerHTML = students.filter((item) => `${item.name} ${item.ficha}`.toLocaleLowerCase("es").includes(query)).map((item) => `
                <button type="button" class="student-card" data-student-id="${escapeHtml(item.id)}" title="Cambiar estado de asistencia">
                    <span class="avatar">${escapeHtml(initials(item.name))}</span>
                    <span class="student-info"><strong>${escapeHtml(item.name)}</strong><small>Ficha ${escapeHtml(item.ficha)}</small></span>
                    <span class="attendance-badge ${escapeHtml(item.status)}">${escapeHtml(labels[item.status])}</span>
                </button>`).join("") || '<p class="empty-state">No se encontraron estudiantes.</p>';
            const counts = Object.fromEntries(statuses.map((status) => [status, students.filter((item) => item.status === status).length]));
            const attended = counts.presente + counts.tarde;
            const percentage = students.length ? Math.round(attended / students.length * 100) : 0;
            document.querySelector('[data-attendance="percentage"]').textContent = `${percentage}%`;
            document.querySelector('[data-attendance="summary"]').textContent = `${attended} / ${students.length} estudiantes`;
            statuses.forEach((status) => {
                const element = document.querySelector(`[data-attendance="${status}"]`);
                if (element) element.textContent = counts[status];
            });
        };
        list.addEventListener("click", (event) => {
            const card = event.target.closest("[data-student-id]");
            if (!card) return;
            const students = loadData("students");
            const student = students.find((item) => item.id === card.dataset.studentId);
            student.status = statuses[(statuses.indexOf(student.status) + 1) % statuses.length];
            saveData("students", students);
            showToast(`${student.name}: ${labels[student.status]}.`);
            render();
        });
        search.addEventListener("input", render);
        document.querySelector('[data-action="save-attendance"]')?.addEventListener("click", () => showToast("La asistencia quedó guardada en este dispositivo."));
        render();
    }

    function setupSettings() {
        const current = () => window.SenaAuth?.getCurrentUser();
        document.querySelector('[data-action="edit-profile"]')?.addEventListener("click", () => {
            const user = current();
            if (!user) return showToast("No se encontró una sesión activa.", "error");
            openDialog({ title: "Editar perfil", fields: [
                { name: "name", label: "Nombre completo", value: user.name },
                { name: "email", label: "Correo", type: "email", value: user.email }
            ], onSubmit: async (values) => {
                const result = await window.SenaAuth.updateProfile(values);
                showToast(result.message || "Perfil actualizado.");
            } });
        });
        document.querySelector('[data-action="change-password"]')?.addEventListener("click", () => openDialog({
            title: "Cambiar contraseña", fields: [
                { name: "current", label: "Contraseña actual", type: "password" },
                { name: "newPassword", label: "Nueva contraseña", type: "password" }
            ], onSubmit: async (values) => {
                const result = await window.SenaAuth.changePassword(values.current, values.newPassword);
                showToast(result.message || "Contraseña actualizada.");
            }
        }));
        document.querySelector('[data-action="toggle-theme"]')?.addEventListener("click", () => {
            document.body.classList.toggle("dark-mode");
            localStorage.setItem("sena-dark-mode", document.body.classList.contains("dark-mode") ? "1" : "0");
            showToast("Apariencia actualizada.");
        });
        const emailState = document.getElementById("email-service-state");
        const emailDetail = document.getElementById("email-service-detail");
        const requestEmailData = async (url) => {
            const response = await fetch(url, { credentials: "same-origin" });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || "No fue posible consultar el servicio de correo.");
            return data;
        };
        const formatDeliveryDate = (value) => value
            ? new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
            : "Sin entregas registradas";
        const refreshEmailStatus = async () => {
            if (!emailState || !emailDetail) return;
            try {
                const data = await requestEmailData("/api/auth/email/status");
                const ready = data.configured && data.ready === true;
                emailState.className = ready ? "is-ready" : "is-warning";
                emailState.textContent = ready ? "Servicio disponible" : data.ready === null ? "Validando servicio" : "Servicio requiere atención";
                emailDetail.textContent = `${data.provider === "gmail" ? "Gmail" : "Resend"} · ${data.mode === "test" ? "modo de prueba" : "modo de producción"} · ${formatDeliveryDate(data.lastSuccessAt)}`;
                emailDetail.title = data.message || "";
            } catch (error) {
                emailState.className = "is-error";
                emailState.textContent = "No fue posible consultar el servicio";
                emailDetail.textContent = error.message;
            }
        };
        document.querySelector('[data-action="view-email-history"]')?.addEventListener("click", async (event) => {
            event.currentTarget.disabled = true;
            try {
                const data = await requestEmailData("/api/auth/email/history");
                const deliveries = data.deliveries || [];
                const content = deliveries.length ? `<div class="email-delivery-history">${deliveries.map((delivery) => `
                    <article class="email-delivery-entry ${delivery.status === "accepted" ? "is-accepted" : "is-failed"}">
                        <span class="email-delivery-dot" aria-hidden="true"></span>
                        <div><strong>${delivery.status === "accepted" ? "Entrega aceptada" : "Entrega fallida"}</strong><small>${escapeHtml(delivery.recipient)} · ${escapeHtml(delivery.provider)} · ${delivery.attempts} intento${delivery.attempts === 1 ? "" : "s"}</small></div>
                        <time>${escapeHtml(formatDeliveryDate(delivery.timestamp))}</time>
                        ${delivery.message ? `<p>${escapeHtml(delivery.message)}</p>` : ""}
                    </article>`).join("")}</div>` : '<p class="email-history-empty">Todavía no hay entregas registradas desde la última actualización.</p>';
                openDialog({ title: "Historial de correos de acceso", content, dialogClass: "email-history-dialog" });
            } catch (error) {
                showToast(error.message, "error");
            } finally {
                event.currentTarget.disabled = false;
            }
        });
        document.querySelector('[data-action="view-audit"]')?.addEventListener("click", async (event) => {
            event.currentTarget.disabled = true;
            try {
                const response = await fetch("/api/audit?limit=100", { credentials: "same-origin" });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.message || "No fue posible consultar la auditoría.");
                const labels = { create: "Creó", update: "Modificó", delete: "Eliminó", activate: "Activó", deactivate: "Desactivó", import: "Importó", register_qr: "Registró por QR" };
                const content = data.entries.length ? `<div class="audit-history">${data.entries.map(entry => {
                    const before = entry.before && typeof entry.before === "object" && !Array.isArray(entry.before) ? entry.before : {};
                    const after = entry.after && typeof entry.after === "object" && !Array.isArray(entry.after) ? entry.after : {};
                    const changes = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]) && !["protected", "createdAt"].includes(key)).slice(0, 5);
                    return `<article class="audit-entry"><span class="audit-icon"><i class="fas fa-pen-to-square" aria-hidden="true"></i></span><div><strong>${escapeHtml(labels[entry.action] || entry.action)} ${escapeHtml(entry.entity)}</strong><p>${escapeHtml(entry.actor.name)} · ${escapeHtml(entry.actor.role)} · ${escapeHtml(entry.entityId)}</p>${changes.length ? `<small>Cambios: ${changes.map(escapeHtml).join(", ")}</small>` : ""}</div><time>${escapeHtml(formatDeliveryDate(entry.timestamp))}</time></article>`;
                }).join("")}</div>` : '<p class="email-history-empty">Todavía no hay acciones registradas.</p>';
                openDialog({ title: "Auditoría de acciones", content, dialogClass: "audit-dialog" });
            } catch (error) { showToast(error.message, "error"); }
            finally { event.currentTarget.disabled = false; }
        });
        refreshEmailStatus();
        const backupButton = document.querySelector('[data-action="backup"]');
        const restoreInput = document.getElementById("restore-backup-file");
        const backupStatus = document.getElementById("backup-operation-status");
        backupButton?.addEventListener("click", async () => {
            const original = backupButton.innerHTML;
            backupButton.disabled = true;
            backupButton.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Preparando';
            backupStatus.textContent = "Generando respaldo integral…";
            try {
                const response = await fetch("/api/backup", { credentials: "same-origin" });
                if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.message || "No se pudo generar el respaldo."); }
                const disposition = response.headers.get("content-disposition") || "";
                const name = disposition.match(/filename="([^"]+)"/)?.[1] || `Respaldo_integral_SENA_${new Date().toISOString().slice(0, 10)}.json`;
                const url = URL.createObjectURL(await response.blob());
                const link = document.createElement("a"); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 30000);
                backupStatus.textContent = `${name} descargado correctamente.`;
                showToast("Respaldo integral generado correctamente.");
            } catch (error) { backupStatus.textContent = error.message; showToast(error.message, "error"); }
            finally { backupButton.disabled = false; backupButton.innerHTML = original; }
        });
        restoreInput?.addEventListener("change", () => {
            const file = restoreInput.files?.[0];
            if (!file) return;
            if (!/\.json$/i.test(file.name) || !file.size || file.size > 25 * 1024 * 1024) {
                backupStatus.textContent = "Selecciona un respaldo .json válido de máximo 25 MB.";
                showToast(backupStatus.textContent, "error"); restoreInput.value = ""; return;
            }
            backupStatus.textContent = `${file.name} · ${Math.ceil(file.size / 1024)} KB`;
            openDialog({
                title: "Restaurar respaldo integral",
                dialogClass: "user-confirm-dialog user-delete-dialog",
                content: `<div class="user-confirm-content"><span><i class="fas fa-database" aria-hidden="true"></i></span><p>La restauración reemplazará usuarios, formación, asistencia, reportes y auditoría con el contenido de <strong>${escapeHtml(file.name)}</strong>. Antes se creará una copia automática del estado actual. Las credenciales y secretos no forman parte del respaldo.</p></div>`,
                actionLabel: "Validar y restaurar",
                actionClass: "dialog-danger-action",
                onAction: async () => {
                    backupStatus.textContent = "Validando y restaurando el respaldo…";
                    const body = new FormData(); body.append("BACKUPFILE", file, file.name);
                    const response = await fetch("/api/restore", { method: "POST", credentials: "same-origin", body });
                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(data.message || "No se pudo restaurar el respaldo.");
                    backupStatus.textContent = `${data.message} ${data.summary.users} usuarios, ${data.summary.fichas} fichas y ${data.summary.attendance} asistencias. Copia previa: ${data.automaticBackup}.`;
                    restoreInput.value = "";
                    showToast("Respaldo restaurado correctamente.");
                }
            });
        });
        document.querySelector('[data-action="show-info"]')?.addEventListener("click", () => openDialog({
            title: "Sistema de Asistencia SENA", content: "<p>Versión 2.0</p><p>Gestión local de usuarios, programas, fichas, horarios, ambientes y asistencia.</p>"
        }));
    }

    function setupDashboard() {
        const search = document.getElementById("dashboard-search");
        if (!search) return;
        search.addEventListener("input", () => {
            const query = search.value.trim().toLocaleLowerCase("es");
            document.querySelectorAll(".table-container tbody tr").forEach((row) => {
                row.hidden = !row.textContent.toLocaleLowerCase("es").includes(query);
            });
        });
    }

    function setupNotifications() {
        const button = document.querySelector('[data-action="notifications"]');
        if (!button) return;
        const badge = button.querySelector("[data-notification-count]");
        let current = [];
        const refresh = async () => {
            try {
                const response = await fetch("/api/notifications", { credentials: "same-origin" });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || "No fue posible cargar las notificaciones.");
                current = data.notifications || [];
                badge.textContent = String(data.count || 0);
                badge.hidden = !data.count;
                button.classList.toggle("has-notifications", Boolean(data.count));
                button.title = data.count ? `${data.count} notificación${data.count === 1 ? "" : "es"}` : "Sin notificaciones pendientes";
            } catch (_error) {
                badge.hidden = true;
            }
        };
        button.addEventListener("click", async () => {
            button.disabled = true;
            await refresh();
            button.disabled = false;
            const content = current.length
                ? `<div class="notification-list">${current.map(item => `<a class="notification-entry ${escapeHtml(item.type)}" href="${escapeHtml(item.href)}"><span><i class="fas ${escapeHtml(item.icon)}" aria-hidden="true"></i></span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p></div><i class="fas fa-chevron-right" aria-hidden="true"></i></a>`).join("")}</div>`
                : '<div class="notification-empty"><i class="fas fa-circle-check" aria-hidden="true"></i><strong>Todo está al día</strong><p>No hay situaciones pendientes en este momento.</p></div>';
            openDialog({ title: "Notificaciones del sistema", content, dialogClass: "notification-dialog" });
        });
        refresh();
        const timer = setInterval(refresh, 60000);
        window.addEventListener("pagehide", () => clearInterval(timer), { once: true });
    }

    async function setupStatistics() {
        if (!document.querySelector('[data-stat="fichas"], [data-stat="environments"]')) return;
        try {
            const data = await trainingApi();
            const stats = { fichas: data.fichas.length, environments: data.environments.length };
            Object.entries(stats).forEach(([name, value]) => document.querySelectorAll(`[data-stat="${name}"]`).forEach(element => { element.textContent = value; }));
        } catch (_error) { /* estadisticas.js muestra el estado de su propia API. */ }
    }

    function setupApprenticePortal() {
        const attendanceTable = document.getElementById("apprentice-attendance-table");
        const profileForm = document.getElementById("apprentice-profile-form");
        const excuseForm = document.getElementById("apprentice-excuse-form");
        const excusesTable = document.getElementById("apprentice-excuses");
        if (!attendanceTable || !profileForm) return;
        let currentApprentice = null;

        const showSection = (name) => {
            document.querySelectorAll("[data-apprentice-section]").forEach((button) => {
                const selected = button.dataset.apprenticeSection === name;
                button.closest("li")?.classList.toggle("active", selected);
                button.setAttribute("aria-current", selected ? "page" : "false");
            });
            document.querySelectorAll(".apprentice-section").forEach((section) => {
                const selected = section.id === `apprentice-${name}`;
                section.hidden = !selected;
                section.classList.toggle("active", selected);
            });
        };

        const requestProfile = async (options = {}) => {
            const response = await fetch("/api/apprentice/me", {
                credentials: "same-origin",
                headers: { "Content-Type": "application/json", ...(options.headers || {}) },
                ...options
            });
            const data = await response.json().catch(() => ({}));
            if (response.status === 401 || response.status === 403) {
                window.location.replace("login.html?returnTo=aprendiz.html");
                throw new Error("Tu sesión de aprendiz terminó.");
            }
            if (!response.ok) throw new Error(data.message || "No fue posible cargar tus datos.");
            return data;
        };

        const showAcademicAlert = (alert) => {
            if (!alert) return;
            openDialog({
                title: alert.title || "Alerta de asistencia",
                dialogClass: "academic-committee-dialog",
                content: `
                    <div class="academic-committee-alert" role="alert">
                        <div class="academic-alert-icon" aria-hidden="true"><i class="fas fa-triangle-exclamation"></i></div>
                        <p class="academic-alert-eyebrow">Seguimiento de asistencia</p>
                        <p class="academic-alert-count"><strong>${escapeHtml(alert.unjustifiedAbsences)}</strong> fallas sin justificación</p>
                        <p>${escapeHtml(alert.message)}</p>
                        <div class="academic-alert-meta"><i class="fas fa-building-columns" aria-hidden="true"></i><span>${escapeHtml(alert.periodLabel)} · Ficha ${escapeHtml(alert.ficha)}</span></div>
                    </div>`
            });
        };

        const render = (apprentice) => {
            currentApprentice = apprentice;
            const program = apprentice.program || {};
            document.querySelectorAll("[data-apprentice-program]").forEach((element) => {
                element.textContent = program[element.dataset.apprenticeProgram] || "-";
            });

            const attendance = Array.isArray(apprentice.attendance) ? apprentice.attendance : [];
            attendanceTable.innerHTML = attendance.map((quarter) => `
                <tr>
                    <td><strong>${escapeHtml(quarter.quarter)}</strong></td>
                    <td>${escapeHtml(quarter.present)}</td>
                    <td>${escapeHtml(quarter.late)}</td>
                    <td>${escapeHtml(quarter.absent)}</td>
                    <td>${escapeHtml(quarter.justified)}</td>
                    <td><span class="attendance-score">${escapeHtml(quarter.percentage)}%</span></td>
                </tr>`).join("") || '<tr><td colspan="6" class="empty-state">Todavía no hay asistencias registradas.</td></tr>';
            const average = attendance.length
                ? Math.round(attendance.reduce((total, item) => total + Number(item.percentage || 0), 0) / attendance.length)
                : 0;
            const averageElement = document.querySelector('[data-apprentice-stat="average"]');
            if (averageElement) averageElement.textContent = `${average}%`;

            for (const field of ["name", "document", "email", "phone", "address"]) {
                if (profileForm.elements[field]) profileForm.elements[field].value = apprentice[field] || "";
            }
        };

        const loadExcuses = async () => {
            if (!excusesTable) return;
            const response = await fetch("/api/excuses", { credentials: "same-origin" });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || "No fue posible cargar las excusas.");
            const labels = { pending: "Pendiente", approved: "Aprobada", rejected: "Rechazada" };
            excusesTable.innerHTML = data.excuses.map((item) => `<tr><td>${escapeHtml(item.date)}</td><td>${escapeHtml(item.reason)}</td><td><a href="/api/excuses/${encodeURIComponent(item.id)}/support">${escapeHtml(item.support.name)}</a></td><td>${escapeHtml(labels[item.status] || item.status)}</td><td>${escapeHtml(item.reviewComment || "—")}</td></tr>`).join("") || '<tr><td colspan="5">No has presentado excusas.</td></tr>';
        };

        document.querySelectorAll("[data-apprentice-section]").forEach((button) => {
            button.addEventListener("click", () => showSection(button.dataset.apprenticeSection));
        });

        profileForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const submit = profileForm.querySelector('[type="submit"]');
            submit.disabled = true;
            try {
                const result = await requestProfile({
                    method: "PATCH",
                    body: JSON.stringify({
                        phone: profileForm.elements.phone.value,
                        address: profileForm.elements.address.value
                    })
                });
                render(result.apprentice);
                showToast(result.message || "Datos actualizados correctamente.");
            } catch (error) {
                showToast(error.message, "error");
            } finally {
                submit.disabled = false;
            }
        });

        excuseForm?.addEventListener("submit", async (event) => {
            event.preventDefault();
            const submit = excuseForm.querySelector('[type="submit"]');
            const body = new FormData(excuseForm);
            body.set("ficha", currentApprentice?.program?.ficha || currentApprentice?.program?.code || "");
            submit.disabled = true;
            try {
                const response = await fetch("/api/excuses", { method: "POST", credentials: "same-origin", body });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.message || "No fue posible enviar la excusa.");
                excuseForm.reset();
                await loadExcuses();
                showToast(data.message);
            } catch (error) { showToast(error.message, "error"); }
            finally { submit.disabled = false; }
        });

        requestProfile()
            .then((result) => {
                render(result.apprentice);
                showAcademicAlert(result.academicAlert);
                loadExcuses().catch((error) => showToast(error.message, "error"));
            })
            .catch((error) => showToast(error.message, "error"));
    }

    if (localStorage.getItem("sena-dark-mode") === "1") document.body.classList.add("dark-mode");
    setupDashboard();
    setupNotifications();
    setupFichas();
    setupSchedules();
    setupEnvironments();
    setupAttendance();
    setupSettings();
    setupStatistics();
    setupApprenticePortal();
})();
