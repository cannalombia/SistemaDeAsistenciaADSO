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

    function setupFichas() {
        const select = document.getElementById("ficha");
        const table = document.getElementById("tablaFichas");
        if (!select || !table) return;
        const render = () => {
            const records = loadData("fichas");
            fillSelect(select, records.map((item) => item.code), select.value);
            table.innerHTML = records.filter((item) => item.code === select.value).map((item) => `<tr><td>${escapeHtml(item.code)}</td><td>${escapeHtml(item.program)}</td><td>${escapeHtml(item.schedule)}</td><td>${escapeHtml(item.mode)}</td><td>${escapeHtml(item.status)}</td></tr>`).join("");
        };
        select.addEventListener("change", render);
        document.querySelector('[data-action="new-ficha"]')?.addEventListener("click", () => openDialog({
            title: "Nueva ficha", fields: [
                { name: "code", label: "Número de ficha" }, { name: "program", label: "Programa" },
                { name: "schedule", label: "Jornada", type: "select", options: ["Mañana", "Tarde", "Noche"] },
                { name: "mode", label: "Modalidad", type: "select", options: ["Presencial", "Virtual"] },
                { name: "status", label: "Estado", type: "select", options: ["Activa", "Inactiva"] }
            ], onSubmit: (values) => { addUniqueRecord("fichas", values, "code"); select.value = values.code; render(); }
        }));
        render();
    }

    function setupSchedules() {
        const select = document.getElementById("ficha");
        const table = document.getElementById("tablaHorarios");
        if (!select || !table) return;
        const render = () => {
            const records = loadData("schedules");
            fillSelect(select, [...new Set(records.map((item) => item.ficha))].sort(), select.value);
            table.innerHTML = records.filter((item) => item.ficha === select.value).map((item) => `<tr><td>${escapeHtml(item.student)}</td><td>${escapeHtml(item.zone)}</td><td>${escapeHtml(item.day)}</td><td>${escapeHtml(item.instructor)}</td><td>${escapeHtml(item.time)}</td></tr>`).join("");
        };
        select.addEventListener("change", render);
        document.querySelector('[data-action="new-schedule"]')?.addEventListener("click", () => openDialog({
            title: "Nuevo horario", fields: [
                { name: "ficha", label: "Ficha" }, { name: "student", label: "Aprendiz" },
                { name: "zone", label: "Zona" },
                { name: "day", label: "Día", type: "select", options: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] },
                { name: "instructor", label: "Instructor" }, { name: "time", label: "Horario" }
            ], onSubmit: (values) => { const records = loadData("schedules"); records.push(values); saveData("schedules", records); showToast("Horario guardado correctamente."); select.value = values.ficha; render(); }
        }));
        render();
    }

    function setupEnvironments() {
        const table = document.getElementById("tablaAmbientes");
        if (!table) return;
        const render = () => {
            table.innerHTML = loadData("environments").map((item) => `<tr><td>${escapeHtml(item.code)}</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.capacity)}</td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.zone)}</td></tr>`).join("");
        };
        document.querySelector('[data-action="new-environment"]')?.addEventListener("click", () => openDialog({
            title: "Nuevo ambiente", fields: [
                { name: "code", label: "Código" }, { name: "name", label: "Nombre" },
                { name: "capacity", label: "Capacidad", type: "number" },
                { name: "type", label: "Tipo", type: "select", options: ["Aula", "Laboratorio", "Especializado"] },
                { name: "status", label: "Estado", type: "select", options: ["Disponible", "Ocupado", "Mantenimiento"] },
                { name: "zone", label: "Zona" }
            ], onSubmit: (values) => { values.capacity = Number(values.capacity); addUniqueRecord("environments", values, "code"); render(); }
        }));
        render();
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
        refreshEmailStatus();
        document.querySelector('[data-action="backup"]')?.addEventListener("click", () => {
            const backup = {};
            for (let index = 0; index < localStorage.length; index += 1) {
                const key = localStorage.key(index);
                if (key && key.startsWith("sena-")) backup[key] = localStorage.getItem(key);
            }
            const link = document.createElement("a");
            link.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
            link.download = `respaldo-sena-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            URL.revokeObjectURL(link.href);
            showToast("Copia de seguridad generada.");
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
        document.querySelector(".notification")?.addEventListener("click", () => showToast("No tienes notificaciones pendientes."));
    }

    function setupStatistics() {
        const stats = {
            fichas: loadData("fichas").length,
            environments: loadData("environments").length
        };
        Object.entries(stats).forEach(([name, value]) => {
            document.querySelectorAll(`[data-stat="${name}"]`).forEach((element) => { element.textContent = value; });
        });
    }

    function setupApprenticePortal() {
        const attendanceTable = document.getElementById("apprentice-attendance-table");
        const profileForm = document.getElementById("apprentice-profile-form");
        if (!attendanceTable || !profileForm) return;

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

        requestProfile()
            .then((result) => {
                render(result.apprentice);
                showAcademicAlert(result.academicAlert);
            })
            .catch((error) => showToast(error.message, "error"));
    }

    if (localStorage.getItem("sena-dark-mode") === "1") document.body.classList.add("dark-mode");
    setupDashboard();
    setupFichas();
    setupSchedules();
    setupEnvironments();
    setupAttendance();
    setupSettings();
    setupStatistics();
    setupApprenticePortal();
})();
