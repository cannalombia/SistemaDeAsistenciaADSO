// CRUD de usuarios: crear, consultar, modificar y eliminar registros.
(function () {
    "use strict";

    let interfaz = window.SenaInterfaz;
    let escaparHtml = interfaz.escapeHtml;
    let mostrarMensaje = interfaz.showToast;
    let abrirDialogo = interfaz.openDialog;

    let formulario = document.getElementById("create-user-form");
    if (!formulario) return;

    let cuerpoTabla = document.getElementById("user-directory-body");
    let tituloTabla = document.getElementById("user-directory-title");
    let resumenTabla = document.getElementById("user-directory-summary");
    let buscador = document.getElementById("user-directory-search");
    let campoFicha = document.querySelector('[data-user-field="ficha"]');
    let etiquetaFicha = document.querySelector("[data-user-ficha-label]");
    let listaFicha = formulario.elements.ficha;
    let listaRol = formulario.elements.rol;
    let estadoSincronizacion = document.querySelector(".user-sync-status");
    let formularioImportacion = document.getElementById("user-csv-import-form");
    let archivoCsv = document.getElementById("user-csv-file");
    let nombreArchivo = document.getElementById("user-csv-file-name");
    let botonImportar = document.getElementById("user-csv-import-button");
    let resultadoImportacion = document.getElementById("user-import-result");

    let datos = {
        usuarios: [],
        fichas: [],
        filtro: "all",
        archivo: null
    };

    function obtenerIniciales(nombre) {
        return String(nombre || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(function (parte) {
                return parte.charAt(0);
            })
            .join("")
            .toUpperCase();
    }

    function claseDelRol(rol) {
        switch (rol) {
            case "Administrador": return "administrador";
            case "Instructor": return "instructor";
            case "Aprendiz": return "aprendiz";
            case "Coordinador": return "coordinador";
            default: return "usuario";
        }
    }

    // Esta función es el único punto de comunicación con el CRUD del servidor.
    async function consultarApi(ruta, opciones) {
        let configuracion = opciones || {};
        let peticion = {
            method: configuracion.method || "GET",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" }
        };

        if (configuracion.body) peticion.body = configuracion.body;

        let respuesta = await fetch("/api/users" + (ruta || ""), peticion);
        let contenido = {};

        try {
            contenido = await respuesta.json();
        } catch (error) {
            contenido = {};
        }

        if (!respuesta.ok) {
            let errorPeticion = new Error(contenido.message || "No fue posible completar la operación de usuarios.");
            errorPeticion.details = Array.isArray(contenido.errors) ? contenido.errors : [];
            errorPeticion.status = respuesta.status;
            throw errorPeticion;
        }

        return contenido;
    }

    function contar_usuarios(usuarios) {
        const cantidades = { total: 0, instructors: 0, students: 0 };
        for (const usuario of usuarios) {
            cantidades.total += 1;
            if (usuario.role === "Instructor") cantidades.instructors += 1;
            if (usuario.role === "Aprendiz") cantidades.students += 1;
        }
        return cantidades;
    }

    function filtrar_usuarios(usuarios, rol, texto) {
        const visibles = [];
        for (const usuario of usuarios) {
            if (rol !== "all" && usuario.role !== rol) continue;
            const contenido = (usuario.name + " " + usuario.document + " " + usuario.email + " " + usuario.username).toLowerCase();
            if (contenido.indexOf(texto) === -1) continue;
            visibles.push(usuario);
        }
        return visibles;
    }

    function buscar_usuario(usuarios, id) {
        let encontrado;
        for (const usuario of usuarios) {
            if (usuario.id === id) {
                encontrado = usuario;
                break;
            }
        }
        return encontrado;
    }

    function actualizarContadores() {
        const cantidades = contar_usuarios(datos.usuarios);

        Object.keys(cantidades).forEach(function (nombre) {
            let elemento = document.querySelector('[data-user-stat="' + nombre + '"]');
            if (elemento) elemento.textContent = cantidades[nombre];
        });
    }

    function dibujarDirectorio() {
        let texto = buscador.value.trim().toLowerCase();
        const usuariosVisibles = filtrar_usuarios(datos.usuarios, datos.filtro, texto);

        let titulos = {
            all: "Todos los usuarios",
            Instructor: "Instructores",
            Aprendiz: "Aprendices"
        };

        tituloTabla.textContent = titulos[datos.filtro] || datos.filtro;
        resumenTabla.textContent = usuariosVisibles.length +
            (usuariosVisibles.length === 1 ? " resultado" : " resultados") +
            " de " + datos.usuarios.length + " usuarios registrados";

        let filas = usuariosVisibles.map(function (usuario) {
            let ficha = usuario.ficha
                ? '<small class="user-ficha-label">Ficha ' + escaparHtml(usuario.ficha) + "</small>"
                : "";
            let estadoInactivo = String(usuario.status).toLowerCase() === "inactivo" ? " inactive" : "";
            let acciones = "";

            if (usuario.protected) {
                acciones = '<span class="user-protected-account"><i class="fas fa-lock" aria-hidden="true"></i> Protegida</span>';
            } else {
                acciones =
                    '<button type="button" data-user-action="edit" data-user-id="' + escaparHtml(usuario.id) + '" aria-label="Modificar ' + escaparHtml(usuario.name) + '" title="Modificar"><i class="fas fa-pen" aria-hidden="true"></i></button>' +
                    '<button type="button" data-user-action="status" data-user-id="' + escaparHtml(usuario.id) + '" aria-label="Cambiar estado de ' + escaparHtml(usuario.name) + '" title="Cambiar estado"><i class="fas ' + (usuario.status === "Activo" ? "fa-user-slash" : "fa-user-check") + '" aria-hidden="true"></i></button>' +
                    '<button type="button" class="danger" data-user-action="delete" data-user-id="' + escaparHtml(usuario.id) + '" aria-label="Eliminar ' + escaparHtml(usuario.name) + '" title="Eliminar"><i class="fas fa-trash" aria-hidden="true"></i></button>';
            }

            return '<tr>' +
                '<td><div class="user-directory-person"><span class="user-directory-avatar">' + obtenerIniciales(usuario.name) + '</span><span><strong>' + escaparHtml(usuario.name) + '</strong><small>' + escaparHtml(usuario.email || usuario.username || "Sin correo") + '</small></span></div></td>' +
                '<td><strong>' + escaparHtml(usuario.document || "—") + "</strong>" + ficha + "</td>" +
                '<td><span class="user-role-badge ' + claseDelRol(usuario.role) + '">' + escaparHtml(usuario.role) + "</span></td>" +
                '<td><span class="user-status-badge' + estadoInactivo + '"><i></i>' + escaparHtml(usuario.status || "Activo") + "</span></td>" +
                '<td class="user-directory-actions">' + acciones + "</td>" +
                "</tr>";
        }).join("");

        cuerpoTabla.innerHTML = filas || '<tr><td colspan="5" class="user-directory-empty">No se encontraron usuarios con este filtro.</td></tr>';
    }

    function llenarFichas() {
        let fichaSeleccionada = listaFicha.value;
        let opciones = ['<option value="">Seleccione una ficha...</option>'];

        datos.fichas.forEach(function (ficha) {
            opciones.push('<option value="' + escaparHtml(ficha.codigo) + '">' + escaparHtml(ficha.codigo) + " · " + escaparHtml(ficha.programa) + "</option>");
        });

        listaFicha.innerHTML = opciones.join("");
        let fichaExiste = datos.fichas.find(function (ficha) {
            return ficha.codigo === fichaSeleccionada;
        });
        if (fichaExiste) listaFicha.value = fichaSeleccionada;
    }

    function ajustarCampoFicha() {
        let esAprendiz = listaRol.value === "Aprendiz";
        listaFicha.required = esAprendiz;
        campoFicha.classList.toggle("optional", !esAprendiz);
        etiquetaFicha.textContent = esAprendiz ? "Ficha del aprendiz" : "Ficha (opcional)";
    }

    function aplicarDatos(respuesta) {
        datos.usuarios = Array.isArray(respuesta.users) ? respuesta.users : [];
        datos.fichas = Array.isArray(respuesta.fichas) ? respuesta.fichas : [];
        actualizarContadores();
        llenarFichas();
        dibujarDirectorio();
    }

    async function cargarUsuarios() {
        estadoSincronizacion.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Sincronizando';
        let respuesta = await consultarApi("");
        aplicarDatos(respuesta);
        estadoSincronizacion.innerHTML = '<i class="fas fa-circle-check"></i> Actualizado ' + new Date().toLocaleString("es-CO");
    }

    function editarUsuario(usuario) {
        let opcionesFicha = datos.fichas.map(function (ficha) {
            return { value: ficha.codigo, label: ficha.codigo + " · " + ficha.programa };
        });

        opcionesFicha.unshift({ value: "", label: "Sin ficha" });

        abrirDialogo({
            title: "Modificar usuario",
            submitLabel: "Guardar cambios",
            dialogClass: "user-management-dialog",
            fields: [
                { name: "identificacion", label: "Identificación", value: usuario.document, readonly: true },
                { name: "tipo_documento", label: "Tipo de documento", type: "select", value: usuario.documentType || "Cédula de Ciudadanía", options: ["Cédula de Ciudadanía", "Tarjeta de Identidad", "Cédula de Extranjería", "Pasaporte", "Permiso de protección temporal"] },
                { name: "nombre", label: "Nombre completo", value: usuario.name, maxlength: 160 },
                { name: "correo", label: "Correo electrónico", type: "email", value: usuario.email },
                { name: "rol", label: "Rol", value: usuario.role, readonly: true },
                { name: "estado", label: "Estado", type: "select", value: usuario.status, options: ["Activo", "Inactivo"] },
                { name: "ficha", label: usuario.role === "Aprendiz" ? "Ficha" : "Ficha (opcional)", type: "select", value: usuario.ficha, required: usuario.role === "Aprendiz", options: opcionesFicha }
            ],
            onSubmit: async function (valores) {
                let respuesta = await consultarApi("/" + encodeURIComponent(usuario.id), {
                    method: "PATCH",
                    body: JSON.stringify(valores)
                });
                aplicarDatos(respuesta);
                mostrarMensaje(respuesta.message || "Usuario actualizado correctamente.");
            }
        });
    }

    function cambiarEstado(usuario) {
        let nuevoEstado = usuario.status === "Activo" ? "Inactivo" : "Activo";
        let verbo = nuevoEstado === "Activo" ? "activar" : "desactivar";

        abrirDialogo({
            title: nuevoEstado === "Activo" ? "Activar usuario" : "Desactivar usuario",
            dialogClass: "user-confirm-dialog",
            content: '<div class="user-confirm-content"><span><i class="fas fa-user-check" aria-hidden="true"></i></span><p>¿Confirmas que deseas <strong>' + verbo + "</strong> a " + escaparHtml(usuario.name) + "?</p></div>",
            actionLabel: nuevoEstado === "Activo" ? "Activar usuario" : "Desactivar usuario",
            onAction: async function () {
                let respuesta = await consultarApi("/" + encodeURIComponent(usuario.id), {
                    method: "PATCH",
                    body: JSON.stringify({ status: nuevoEstado })
                });
                aplicarDatos(respuesta);
                mostrarMensaje(respuesta.message);
            }
        });
    }

    function eliminarUsuario(usuario) {
        abrirDialogo({
            title: "Eliminar usuario",
            dialogClass: "user-confirm-dialog user-delete-dialog",
            content: '<div class="user-confirm-content"><span><i class="fas fa-trash" aria-hidden="true"></i></span><p>Se eliminará a <strong>' + escaparHtml(usuario.name) + "</strong>. Los registros históricos de asistencia se conservarán.</p></div>",
            actionLabel: "Eliminar definitivamente",
            actionClass: "dialog-danger-action",
            onAction: async function () {
                let respuesta = await consultarApi("/" + encodeURIComponent(usuario.id), { method: "DELETE" });
                aplicarDatos(respuesta);
                mostrarMensaje(respuesta.message);
            }
        });
    }

    function seleccionarFiltro(tarjeta) {
        datos.filtro = tarjeta.dataset.userFilter;

        document.querySelectorAll("[data-user-filter]").forEach(function (elemento) {
            let seleccionada = elemento === tarjeta;
            elemento.classList.toggle("active", seleccionada);
            elemento.setAttribute("aria-pressed", String(seleccionada));
        });

        dibujarDirectorio();
        document.getElementById("user-directory").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function ejecutarAccion(evento) {
        let boton = evento.target.closest("[data-user-action]");
        if (!boton) return;

        const usuario = buscar_usuario(datos.usuarios, boton.dataset.userId);
        if (!usuario) return;

        switch (boton.dataset.userAction) {
            case "edit":
                editarUsuario(usuario);
                break;
            case "status":
                cambiarEstado(usuario);
                break;
            case "delete":
                eliminarUsuario(usuario);
                break;
        }
    }

    function revisarArchivo() {
        let archivo = archivoCsv.files && archivoCsv.files[0] ? archivoCsv.files[0] : null;
        let extensionCorrecta = archivo ? /\.csv$/i.test(archivo.name) : false;
        let tamanoCorrecto = archivo ? archivo.size <= 450 * 1024 : false;

        datos.archivo = extensionCorrecta && tamanoCorrecto ? archivo : null;
        nombreArchivo.textContent = archivo
            ? archivo.name + " · " + Math.max(1, Math.round(archivo.size / 1024)) + " KB"
            : "Ningún archivo seleccionado";
        nombreArchivo.classList.toggle("invalid", Boolean(archivo && !datos.archivo));
        botonImportar.disabled = !datos.archivo;
        resultadoImportacion.hidden = true;

        if (archivo && !datos.archivo) mostrarMensaje("Selecciona un archivo .csv de máximo 450 KB.", "error");
    }

    async function importarUsuarios(evento) {
        evento.preventDefault();
        if (!datos.archivo) return;

        botonImportar.disabled = true;
        resultadoImportacion.hidden = false;
        resultadoImportacion.className = "user-import-result loading";
        resultadoImportacion.textContent = "Validando y guardando usuarios...";

        try {
            let respuesta = await consultarApi("/import", {
                method: "POST",
                body: JSON.stringify({ fileName: datos.archivo.name, csv: await datos.archivo.text() })
            });
            aplicarDatos(respuesta);
            resultadoImportacion.className = "user-import-result success";
            resultadoImportacion.innerHTML = '<i class="fas fa-circle-check" aria-hidden="true"></i><span><strong>Importación completada.</strong> ' + escaparHtml(respuesta.message) + "</span>";
            formularioImportacion.reset();
            datos.archivo = null;
            nombreArchivo.textContent = "Ningún archivo seleccionado";
            mostrarMensaje(respuesta.message || "Usuarios importados correctamente.");
        } catch (error) {
            let detalles = error.details && error.details.length
                ? "<small>" + error.details.map(escaparHtml).join("<br>") + "</small>"
                : "";
            resultadoImportacion.className = "user-import-result error";
            resultadoImportacion.innerHTML = '<i class="fas fa-triangle-exclamation" aria-hidden="true"></i><span><strong>' + escaparHtml(error.message) + "</strong>" + detalles + "</span>";
        }

        botonImportar.disabled = !datos.archivo;
    }

    async function crearUsuario(evento) {
        evento.preventDefault();
        let botonGuardar = formulario.querySelector('[type="submit"]');
        botonGuardar.disabled = true;

        let nuevoUsuario = {
            identificacion: formulario.elements.identificacion.value.trim(),
            tipo_documento: formulario.elements.tipo_documento.value,
            nombre: formulario.elements.nombre.value.trim(),
            correo: formulario.elements.correo.value.trim(),
            rol: formulario.elements.rol.value,
            estado: formulario.elements.estado.value,
            ficha: formulario.elements.ficha.value
        };

        try {
            let respuesta = await consultarApi("", {
                method: "POST",
                body: JSON.stringify(nuevoUsuario)
            });
            aplicarDatos(respuesta);
            formulario.reset();
            ajustarCampoFicha();
            mostrarMensaje(respuesta.message || "Usuario creado correctamente.");
        } catch (error) {
            mostrarMensaje(error.message, "error");
        }

        botonGuardar.disabled = false;
    }

    document.querySelectorAll("[data-user-filter]").forEach(function (tarjeta) {
        tarjeta.addEventListener("click", function () {
            seleccionarFiltro(tarjeta);
        });
    });
    buscador.addEventListener("input", dibujarDirectorio);
    cuerpoTabla.addEventListener("click", ejecutarAccion);
    listaRol.addEventListener("change", ajustarCampoFicha);
    archivoCsv.addEventListener("change", revisarArchivo);
    formularioImportacion.addEventListener("submit", importarUsuarios);
    formulario.addEventListener("submit", crearUsuario);

    const sqlForm = document.getElementById("user-sql-import-form");
    const sqlFile = document.getElementById("user-sql-file");
    const sqlFileName = document.getElementById("user-sql-file-name");
    const sqlImportButton = document.getElementById("user-sql-import");
    const sqlResult = document.getElementById("user-sql-result");
    const exportButton = document.getElementById("user-sql-export");
    const tabs = [document.getElementById("tab-csv"), document.getElementById("tab-sql")];
    function updateSqlFilePresentation() {
        const file = sqlFile.files && sqlFile.files[0];
        const valid = Boolean(file && /\.sql$/i.test(file.name) && file.size > 0 && file.size <= 1048576);
        sqlImportButton.disabled = !valid;
        sqlFileName.classList.toggle("selected", valid);
        sqlFileName.classList.toggle("invalid", Boolean(file && !valid));
        sqlFileName.innerHTML = file
            ? '<i class="fas ' + (valid ? 'fa-circle-check' : 'fa-triangle-exclamation') + '" aria-hidden="true"></i> ' + escaparHtml(file.name) + ' · ' + Math.max(1, Math.ceil(file.size / 1024)) + ' KB'
            : '<i class="fas fa-circle-info" aria-hidden="true"></i> Ningún archivo seleccionado';
    }
    sqlFile.addEventListener("change", updateSqlFilePresentation);
    tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => tabs.forEach(item => {
            const active = item === tab;
            item.setAttribute("aria-selected", String(active));
            item.tabIndex = active ? 0 : -1;
            document.getElementById(item.getAttribute("aria-controls")).hidden = !active;
        }));
        tab.addEventListener("keydown", event => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[1] : tabs[1 - index];
            next.click(); next.focus();
        });
    });
    async function sqlOperation(exporting) {
        if (sqlForm.getAttribute("aria-busy") === "true") return;
        sqlForm.setAttribute("aria-busy", "true");
        sqlForm.querySelectorAll("button,input").forEach(item => { item.disabled = true; });
        sqlResult.hidden = false;
        sqlResult.className = "user-import-result loading";
        sqlResult.innerHTML = '<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i><span>Procesando archivo SQL...</span>';
        try {
            let body;
            if (!exporting) {
                const file = sqlFile.files[0];
                if (!file || !/\.sql$/i.test(file.name) || !file.size || file.size > 1048576) throw new Error("Selecciona un archivo .sql no vacío de máximo 1 MB (1048576 bytes).");
                const types = ["application/sql", "application/x-sql", "text/sql", "text/x-sql", "text/plain"];
                if (file.type && !types.includes(file.type)) throw new Error("El tipo MIME del archivo no está permitido.");
                body = new FormData();
                // Windows puede no asignar MIME a .sql; se declara SQL y el servidor valida su gramática.
                body.append("SQLFILE", file.type ? file : new Blob([file], { type: "application/sql" }), file.name);
            }
            const response = await fetch("/api/users/" + (exporting ? "export-sql" : "import-sql"), {
                method: exporting ? "GET" : "POST", credentials: "same-origin", body
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error([error.message || "No se pudo completar la operación SQL.", ...(error.errors || [])].join(" "));
            }
            if (exporting) {
                const url = URL.createObjectURL(await response.blob());
                const link = document.createElement("a");
                link.href = url; link.download = "Base_datos_SENA.sql";
                document.body.appendChild(link); link.click(); link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 30000);
                sqlResult.textContent = "Base_datos_SENA.sql descargado con los usuarios por roles y la base actual.";
            } else {
                const result = await response.json();
                aplicarDatos(result); sqlForm.reset(); updateSqlFilePresentation();
                sqlResult.textContent = result.message;
            }
            sqlResult.className = "user-import-result success";
        } catch (error) {
            sqlResult.className = "user-import-result error";
            sqlResult.textContent = error.message || "Error de conexión. Intenta nuevamente.";
        } finally {
            sqlForm.setAttribute("aria-busy", "false");
            sqlForm.querySelectorAll("button,input").forEach(item => { item.disabled = false; });
            updateSqlFilePresentation();
        }
    }
    sqlForm.addEventListener("submit", event => { event.preventDefault(); sqlOperation(false); });
    exportButton.addEventListener("click", () => sqlOperation(true));

    ajustarCampoFicha();
    cargarUsuarios().catch(function (error) {
        if (error.status === 403) {
            window.location.replace("login.html?returnTo=crear_usuario.html");
            return;
        }
        estadoSincronizacion.innerHTML = '<i class="fas fa-triangle-exclamation"></i> Error de conexión';
        cuerpoTabla.innerHTML = '<tr><td colspan="5" class="user-directory-empty">' + escaparHtml(error.message) + "</td></tr>";
        mostrarMensaje(error.message, "error");
    });
})();
