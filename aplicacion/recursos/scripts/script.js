// Gestión del directorio de usuarios e importaciones CSV.
(function () {
    "use strict";

    // .split(), .map(), .join() y .toUpperCase() forman las iniciales del usuario.
    const { escapeHtml, showToast, openDialog } = window.SenaInterfaz;

    function initials(name) {
        return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    }

    function setupCreateUser() {
        // document.getElementById() obtiene un elemento usando su id único.
        const form = document.getElementById("create-user-form");
        if (!form) return;
        const directoryBody = document.getElementById("user-directory-body");
        const directoryTitle = document.getElementById("user-directory-title");
        const directorySummary = document.getElementById("user-directory-summary");
        const directorySearch = document.getElementById("user-directory-search");
        // document.querySelector() obtiene el primer elemento que coincide con un selector CSS.
        const fichaField = document.querySelector('[data-user-field="ficha"]');
        const fichaLabel = document.querySelector("[data-user-ficha-label]");
        const fichaSelect = form.elements.ficha;
        const roleSelect = form.elements.rol;
        const statusSelect = form.elements.estado;
        const syncStatus = document.querySelector(".user-sync-status");
        const importForm = document.getElementById("user-csv-import-form");
        const importFile = document.getElementById("user-csv-file");
        const importFileName = document.getElementById("user-csv-file-name");
        const importButton = document.getElementById("user-csv-import-button");
        const importResult = document.getElementById("user-import-result");
        const confirmation = document.getElementById("confirmar-datos");
        const formProgress = document.getElementById("progreso-formulario");
        const crudClock = document.getElementById("reloj-crud");
        const crudHistoryList = document.getElementById("historial-crud");
        const reproducirSonidoDinero = document.getElementById("reproducirSonidoDinero");
        const state = { users: [], summary: {}, fichas: [], filter: "all", audioContext: null, csvFile: null };
        const crudHistory = [];
        let clockInterval = null;

        // Esta fuente mínima permite ejecutar .play(); las notas audibles se crean con AudioContext.
        reproducirSonidoDinero.src = "data:audio/wav;base64,UklGRiUAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQEAAACA";

        // calcular() revisa el formulario y muestra el porcentaje completado.
        function calcular() {
            // .selectedIndex obtiene la posición seleccionada dentro del <select> de roles.
            let selectedRoleIndex = roleSelect.selectedIndex;
            let requiresFicha = false;

            // switch ejecuta una opción diferente según el índice del rol.
            switch (selectedRoleIndex) {
                case 2:
                    requiresFicha = true;
                    break;
                case 0:
                case 1:
                case 3:
                default:
                    requiresFicha = false;
                    break;
            }

            // .value lee los campos y .trim() quita espacios al inicio y al final.
            let values = [
                form.elements.identificacion.value.trim(),
                form.elements.nombre.value.trim(),
                form.elements.correo.value.trim(),
                roleSelect.value.trim(),
                statusSelect.value.trim()
            ];

            // if, && y != comprueban si el aprendiz necesita una ficha seleccionada.
            if (requiresFicha && roleSelect.value.trim() != "") values.push(fichaSelect.value.trim());

            // .reduce() suma los campos completos; .checked consulta el checkbox.
            // El operador ternario ? : elige 1 cuando está marcado y 0 cuando no lo está.
            let completed = values.reduce((total, value) => total + (value ? 1 : 0), 0);
            let confirmed = confirmation.checked ? 1 : 0;

            // Math.round(), Math.min() y Math.max() mantienen el resultado entre 0 y 100.
            let result = Math.round((completed + confirmed) / (values.length + 1) * 100);
            result = Math.max(0, Math.min(100, result));

            // if / else y .textContent muestran un mensaje según el avance.
            if (result <= 35) formProgress.textContent = `Formulario ${result}% completo · faltan datos`;
            else if (result < 100) formProgress.textContent = `Formulario ${result}% completo · continúa revisando`;
            else formProgress.textContent = "Formulario 100% completo · listo para guardar";
            return result;
        }

        // Se deja calcular disponible para practicarla desde la consola del navegador.
        window.calcular = calcular;

        function renderCrudHistory() {
            // .reduce() cuenta las operaciones; .map() y .join() construyen la lista HTML.
            const totalOperations = crudHistory.reduce((total, item) => total + (item ? 1 : 0), 0);
            crudHistoryList.innerHTML = crudHistory.map((item) => `
                <li>
                    <span>${escapeHtml(item.action)}</span>
                    <strong>${escapeHtml(item.user)}</strong>
                    <time>${escapeHtml(item.date)}</time>
                </li>`).join("") || "<li>Todavía no hay operaciones registradas.</li>";
            crudHistoryList.setAttribute("aria-label", `${totalOperations} operaciones registradas`);
        }

        function registerCrudActivity(action, user) {
            const maximum = Math.max(3, Math.min(10, Number(crudHistoryList.dataset.maxItems) || 6));

            // Math.random() y Math.floor() crean un identificador sencillo para el historial.
            // .push() agrega la operación al arreglo y new Date() registra la fecha actual.
            crudHistory.push({
                id: Math.floor(Math.random() * 1000000),
                action: String(action || "LEER").trim().toUpperCase(),
                user: String(user || "Directorio de usuarios").trim(),
                date: new Date().toLocaleString("es-CO")
            });

            // .splice() borra las operaciones más antiguas cuando se supera el límite.
            if (crudHistory.length > maximum) crudHistory.splice(0, crudHistory.length - maximum);
            renderCrudHistory();

            // setTimeout() retira el resaltado después de un momento.
            const newest = crudHistoryList.querySelector("li:last-child");
            newest?.classList.add("recent");
            setTimeout(() => newest?.classList.remove("recent"), 900);
        }

        function updateClock() {
            // new Date() y .toLocaleString() muestran la fecha y hora local.
            crudClock.textContent = new Date().toLocaleString("es-CO");
        }

        function playAudioElement() {
            // .currentTime reinicia el audio y .play() lo reproduce desde el comienzo.
            reproducirSonidoDinero.currentTime = 0;
            reproducirSonidoDinero.play().catch(() => {});
        }

        // async/await y fetch() permiten que el CRUD guarde realmente en el servidor.
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

        // window.AudioContext / webkitAudioContext preparan el sonido de confirmación.
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
                // createOscillator(), createGain(), connect(), start() y stop() producen dos notas.
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
            // .innerHTML, .map() y .join() dibujan todos los usuarios de la lectura CRUD.
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
            registerCrudActivity("Leer", "Directorio de usuarios");
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
                    // .find() localiza el usuario actualizado dentro del arreglo recibido.
                    const updatedUser = data.users.find((item) => item.id === user.id);
                    registerCrudActivity("Actualizar", updatedUser?.name || user.name);
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
                    registerCrudActivity("Actualizar", user.name);
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
                registerCrudActivity("Borrar", user.name);
                showToast(data.message);
            }
        });

        // forEach() recorre cada tarjeta usada para filtrar el directorio.
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
            // .closest() encuentra el botón aunque se haga clic sobre su icono interior.
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
                registerCrudActivity("Crear", `${data.importResult?.total || 0} usuarios importados`);
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
            // alert() explica por qué todavía no se puede completar la creación.
            if (!confirmation.checked || calcular() < 100) {
                alert("Revisa los campos y confirma los datos antes de guardar el usuario.");
                return;
            }
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
                const createdUser = data.users.find((user) => user.document === form.elements.identificacion.value.trim());
                registerCrudActivity("Crear", createdUser?.name || form.elements.nombre.value.trim().toUpperCase());
                form.reset();
                confirmation.checked = false;
                syncRoleField();
                calcular();
                showToast(data.message || "Usuario creado correctamente.");
                await preparedSound;
                playUserSavedSound().catch(() => null);
                playAudioElement();
            } catch (error) {
                showToast(error.message, "error");
            } finally {
                submit.disabled = false;
            }
        });
        // Los eventos input y change vuelven a ejecutar calcular() mientras se escribe.
        form.addEventListener("input", calcular);
        form.addEventListener("change", calcular);
        syncRoleField();
        calcular();
        updateClock();

        // setInterval() actualiza el reloj; clearInterval() lo detiene al salir de la página.
        clockInterval = setInterval(updateClock, 1000);
        window.addEventListener("pagehide", () => {
            clearInterval(clockInterval);
            clockInterval = null;
            delete window.calcular;
        }, { once: true });
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
