// Gestión del directorio de usuarios e importaciones CSV.
(function () {
    "use strict";

    const { escapeHtml, showToast, openDialog } = window.SenaInterfaz;

    function initials(name) {
        return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    }

    function setupCreateUser() {
        const form = document.getElementById("create-user-form");
        if (!form) return;
        const directoryBody = document.getElementById("user-directory-body");
        const directoryTitle = document.getElementById("user-directory-title");
        const directorySummary = document.getElementById("user-directory-summary");
        const directorySearch = document.getElementById("user-directory-search");
        const fichaField = document.querySelector('[data-user-field="ficha"]');
        const fichaLabel = document.querySelector("[data-user-ficha-label]");
        const fichaSelect = form.elements.ficha;
        const roleSelect = form.elements.rol;
        const syncStatus = document.querySelector(".user-sync-status");
        const importForm = document.getElementById("user-csv-import-form");
        const importFile = document.getElementById("user-csv-file");
        const importFileName = document.getElementById("user-csv-file-name");
        const importButton = document.getElementById("user-csv-import-button");
        const importResult = document.getElementById("user-import-result");
        const state = { users: [], summary: {}, fichas: [], filter: "all", audioContext: null, csvFile: null };

        const requestUsers = async (path = "", options = {}) => {
            const response = await fetch(`/api/users${path}`, {
                credentials: "same-origin",
                headers: { "Content-Type": "application/json", ...(options.headers || {}) },
                ...options
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const error = new Error(data.message || "No fue posible completar la operación de usuarios.");
                error.details = Array.isArray(data.errors) ? data.errors : [];
                error.status = response.status;
                throw error;
            }
            return data;
        };

        const prepareUserSavedSound = async () => {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return null;
            state.audioContext ||= new AudioContextClass();
            if (state.audioContext.state === "suspended") await state.audioContext.resume();
            return state.audioContext.state === "running" ? state.audioContext : null;
        };

        const playUserSavedSound = async () => {
            const audioContext = await prepareUserSavedSound();
            if (!audioContext) return;
            const start = audioContext.currentTime;
            [659.25, 783.99].forEach((frequency, index) => {
                const oscillator = audioContext.createOscillator();
                const gain = audioContext.createGain();
                oscillator.type = "sine";
                oscillator.frequency.value = frequency;
                gain.gain.setValueAtTime(0.0001, start + index * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.12, start + index * 0.12 + 0.025);
                gain.gain.exponentialRampToValueAtTime(0.0001, start + index * 0.12 + 0.22);
                oscillator.connect(gain).connect(audioContext.destination);
                oscillator.start(start + index * 0.12);
                oscillator.stop(start + index * 0.12 + 0.23);
            });
        };

        const roleClass = (role) => String(role || "usuario").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const updateCounts = () => {
            for (const [key, value] of Object.entries({ total: state.summary.total, instructors: state.summary.instructors, students: state.summary.students })) {
                const element = document.querySelector(`[data-user-stat="${key}"]`);
                if (element) element.textContent = new Intl.NumberFormat("es-CO").format(Number(value) || 0);
            }
        };

        const renderDirectory = () => {
            const query = directorySearch.value.trim().toLocaleLowerCase("es");
            const visible = state.users.filter((user) => {
                const matchesRole = state.filter === "all" || user.role === state.filter;
                const searchable = `${user.name} ${user.document} ${user.email} ${user.username}`.toLocaleLowerCase("es");
                return matchesRole && searchable.includes(query);
            });
            const labels = { all: "Todos los usuarios", Instructor: "Instructores", Aprendiz: "Aprendices" };
            directoryTitle.textContent = labels[state.filter] || state.filter;
            directorySummary.textContent = `${visible.length} resultado${visible.length === 1 ? "" : "s"} de ${state.users.length} usuarios registrados`;
            directoryBody.innerHTML = visible.map((user) => `
                <tr>
                    <td><div class="user-directory-person"><span class="user-directory-avatar">${escapeHtml(initials(user.name))}</span><span><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email || user.username || "Sin correo")}</small></span></div></td>
                    <td><strong>${escapeHtml(user.document || "—")}</strong>${user.ficha ? `<small class="user-ficha-label">Ficha ${escapeHtml(user.ficha)}</small>` : ""}</td>
                    <td><span class="user-role-badge ${escapeHtml(roleClass(user.role))}">${escapeHtml(user.role)}</span></td>
                    <td><span class="user-status-badge ${String(user.status).toLowerCase() === "inactivo" ? "inactive" : ""}"><i></i>${escapeHtml(user.status || "Activo")}</span></td>
                    <td class="user-directory-actions">${user.protected ? '<span class="user-protected-account"><i class="fas fa-lock" aria-hidden="true"></i> Protegida</span>' : `
                        <button type="button" data-user-action="edit" data-user-id="${escapeHtml(user.id)}" aria-label="Modificar ${escapeHtml(user.name)}" title="Modificar"><i class="fas fa-pen" aria-hidden="true"></i></button>
                        <button type="button" data-user-action="status" data-user-id="${escapeHtml(user.id)}" aria-label="${user.status === "Activo" ? "Desactivar" : "Activar"} ${escapeHtml(user.name)}" title="${user.status === "Activo" ? "Desactivar" : "Activar"}"><i class="fas ${user.status === "Activo" ? "fa-user-slash" : "fa-user-check"}" aria-hidden="true"></i></button>
                        <button type="button" class="danger" data-user-action="delete" data-user-id="${escapeHtml(user.id)}" aria-label="Eliminar ${escapeHtml(user.name)}" title="Eliminar"><i class="fas fa-trash" aria-hidden="true"></i></button>`}</td>
                </tr>`).join("") || '<tr><td colspan="5" class="user-directory-empty">No se encontraron usuarios con este filtro.</td></tr>';
        };

        const populateFichas = () => {
            const selected = fichaSelect.value;
            fichaSelect.innerHTML = '<option value="">Seleccione una ficha...</option>' + state.fichas
                .map((ficha) => `<option value="${escapeHtml(ficha.codigo)}">${escapeHtml(ficha.codigo)} · ${escapeHtml(ficha.programa)}</option>`).join("");
            if (state.fichas.some((ficha) => ficha.codigo === selected)) fichaSelect.value = selected;
        };

        const syncRoleField = () => {
            const apprentice = roleSelect.value === "Aprendiz";
            fichaSelect.required = apprentice;
            fichaField.classList.toggle("optional", !apprentice);
            fichaLabel.textContent = apprentice ? "Ficha del aprendiz" : "Ficha (opcional)";
        };

        const applyPayload = (data) => {
            state.users = Array.isArray(data.users) ? data.users : [];
            state.summary = data.summary || {};
            state.fichas = Array.isArray(data.fichas) ? data.fichas : [];
            updateCounts();
            populateFichas();
            renderDirectory();
        };

        const loadUsers = async () => {
            syncStatus.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Sincronizando';
            const data = await requestUsers();
            applyPayload(data);
            syncStatus.innerHTML = '<i class="fas fa-circle-check"></i> Datos sincronizados';
        };

        const editUser = (user) => {
            const fichaOptions = state.fichas.map((ficha) => ({ value: ficha.codigo, label: `${ficha.codigo} · ${ficha.programa}` }));
            openDialog({
                title: "Modificar usuario",
                submitLabel: "Guardar cambios",
                dialogClass: "user-management-dialog",
                fields: [
                    { name: "identificacion", label: "Identificación", value: user.document, readonly: true },
                    { name: "tipo_documento", label: "Tipo de documento", type: "select", value: user.documentType || "Cédula de Ciudadanía", options: ["Cédula de Ciudadanía", "Tarjeta de Identidad", "Cédula de Extranjería", "Pasaporte", "Permiso de protección temporal"] },
                    { name: "nombre", label: "Nombre completo", value: user.name, maxlength: 160 },
                    { name: "correo", label: "Correo electrónico", type: "email", value: user.email },
                    { name: "rol", label: "Rol", value: user.role, readonly: true },
                    { name: "estado", label: "Estado", type: "select", value: user.status, options: ["Activo", "Inactivo"] },
                    { name: "ficha", label: user.role === "Aprendiz" ? "Ficha" : "Ficha (opcional)", type: "select", value: user.ficha, required: user.role === "Aprendiz", options: [{ value: "", label: "Sin ficha" }, ...fichaOptions] }
                ],
                onSubmit: async (values) => {
                    const preparedSound = prepareUserSavedSound().catch(() => null);
                    const data = await requestUsers(`/${encodeURIComponent(user.id)}`, { method: "PATCH", body: JSON.stringify(values) });
                    applyPayload(data);
                    showToast(data.message || "Usuario actualizado correctamente.");
                    await preparedSound;
                    playUserSavedSound().catch(() => null);
                }
            });
        };

        const confirmUserStatus = (user) => {
            const nextStatus = user.status === "Activo" ? "Inactivo" : "Activo";
            openDialog({
                title: `${nextStatus === "Activo" ? "Activar" : "Desactivar"} usuario`,
                dialogClass: "user-confirm-dialog",
                content: `<div class="user-confirm-content"><span><i class="fas ${nextStatus === "Activo" ? "fa-user-check" : "fa-user-slash"}" aria-hidden="true"></i></span><p>¿Confirmas que deseas <strong>${nextStatus === "Activo" ? "activar" : "desactivar"}</strong> a ${escapeHtml(user.name)}?</p></div>`,
                actionLabel: nextStatus === "Activo" ? "Activar usuario" : "Desactivar usuario",
                onAction: async () => {
                    const data = await requestUsers(`/${encodeURIComponent(user.id)}`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
                    applyPayload(data);
                    showToast(data.message);
                }
            });
        };

        const confirmUserDelete = (user) => openDialog({
            title: "Eliminar usuario",
            dialogClass: "user-confirm-dialog user-delete-dialog",
            content: `<div class="user-confirm-content"><span><i class="fas fa-trash" aria-hidden="true"></i></span><p>Se eliminará a <strong>${escapeHtml(user.name)}</strong> del directorio, de usuarios_activos.csv y de su perfil de acceso. Los registros históricos de asistencia se conservarán.</p></div>`,
            actionLabel: "Eliminar definitivamente",
            actionClass: "dialog-danger-action",
            onAction: async () => {
                const data = await requestUsers(`/${encodeURIComponent(user.id)}`, { method: "DELETE" });
                applyPayload(data);
                showToast(data.message);
            }
        });

        document.querySelectorAll("[data-user-filter]").forEach((card) => {
            card.addEventListener("click", () => {
                state.filter = card.dataset.userFilter;
                document.querySelectorAll("[data-user-filter]").forEach((item) => {
                    const selected = item === card;
                    item.classList.toggle("active", selected);
                    item.setAttribute("aria-pressed", String(selected));
                });
                renderDirectory();
                document.getElementById("user-directory").scrollIntoView({ behavior: "smooth", block: "start" });
            });
        });
        directorySearch.addEventListener("input", renderDirectory);
        directoryBody.addEventListener("click", (event) => {
            const button = event.target.closest("[data-user-action]");
            if (!button) return;
            const user = state.users.find((item) => item.id === button.dataset.userId);
            if (!user) return;
            if (button.dataset.userAction === "edit") editUser(user);
            if (button.dataset.userAction === "status") confirmUserStatus(user);
            if (button.dataset.userAction === "delete") confirmUserDelete(user);
        });
        roleSelect.addEventListener("change", syncRoleField);

        importFile.addEventListener("change", () => {
            const file = importFile.files?.[0] || null;
            state.csvFile = file && /\.csv$/i.test(file.name) && file.size <= 450 * 1024 ? file : null;
            importFileName.textContent = file ? `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB` : "Ningún archivo seleccionado";
            importFileName.classList.toggle("invalid", Boolean(file && !state.csvFile));
            importButton.disabled = !state.csvFile;
            importResult.hidden = true;
            if (file && !state.csvFile) showToast("Selecciona un archivo .csv de máximo 450 KB.", "error");
        });

        importForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (!state.csvFile) return;
            const preparedSound = prepareUserSavedSound().catch(() => null);
            importButton.disabled = true;
            importResult.hidden = false;
            importResult.className = "user-import-result loading";
            importResult.innerHTML = '<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Validando y guardando usuarios...';
            try {
                const data = await requestUsers("/import", {
                    method: "POST",
                    body: JSON.stringify({ fileName: state.csvFile.name, csv: await state.csvFile.text() })
                });
                applyPayload(data);
                importResult.className = "user-import-result success";
                importResult.innerHTML = `<i class="fas fa-circle-check" aria-hidden="true"></i><span><strong>Importación completada.</strong> ${escapeHtml(data.message)}</span>`;
                importForm.reset();
                state.csvFile = null;
                importFileName.textContent = "Ningún archivo seleccionado";
                showToast(data.message || "Usuarios importados correctamente.");
                await preparedSound;
                playUserSavedSound().catch(() => null);
            } catch (error) {
                importResult.className = "user-import-result error";
                importResult.innerHTML = `<i class="fas fa-triangle-exclamation" aria-hidden="true"></i><span><strong>${escapeHtml(error.message)}</strong>${error.details.length ? `<small>${error.details.map(escapeHtml).join("<br>")}</small>` : ""}</span>`;
            } finally {
                importButton.disabled = !state.csvFile;
            }
        });

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const submit = form.querySelector('[type="submit"]');
            const preparedSound = prepareUserSavedSound().catch(() => null);
            submit.disabled = true;
            try {
                const response = await fetch("/api/users", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(Object.fromEntries(new FormData(form).entries()))
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.message || "No fue posible crear el usuario.");
                applyPayload(data);
                form.reset();
                syncRoleField();
                showToast(data.message || "Usuario creado correctamente.");
                await preparedSound;
                playUserSavedSound().catch(() => null);
            } catch (error) {
                showToast(error.message, "error");
            } finally {
                submit.disabled = false;
            }
        });
        syncRoleField();
        loadUsers().catch((error) => {
            if (error.status === 403) {
                window.location.replace("login.html?returnTo=crear_usuario.html");
                return;
            }
            syncStatus.innerHTML = '<i class="fas fa-triangle-exclamation"></i> Error de conexión';
            directoryBody.innerHTML = `<tr><td colspan="4" class="user-directory-empty">${escapeHtml(error.message)}</td></tr>`;
            showToast(error.message, "error");
        });
    }

    setupCreateUser();
})();
