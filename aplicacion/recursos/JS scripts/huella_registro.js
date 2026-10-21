(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const elementos = {
        volver: $("biometric-back"), estadoVivo: $("biometric-live-status"), selector: $("biometric-user-select"), buscar: $("biometric-user-search"), refrescar: $("biometric-refresh"), autorizacion: $("biometric-consent-check"),
        iniciales: $("biometric-user-initials"), nombre: $("biometric-user-name"), correo: $("biometric-user-email"),
        documento: $("biometric-user-document"), ficha: $("biometric-user-ficha"), estado: $("biometric-user-status"),
        estadoPlantilla: $("biometric-template-status"), metaPlantilla: $("biometric-template-meta"), fechaPlantilla: $("biometric-template-date"),
        consola: document.querySelector(".biometric-capture-console"), scanner: document.querySelector(".biometric-enrollment-scanner"),
        titulo: $("biometric-capture-title"), mensaje: $("biometric-capture-message"), progreso: $("biometric-progress"),
        progresoTexto: $("biometric-progress-label"), puntos: $("biometric-stage-dots"), iniciar: $("biometric-start"),
        verificar: $("biometric-verify"), cancelar: $("biometric-cancel"), revocar: $("biometric-revoke"),
        dialogo: $("biometric-revoke-dialog"), motivo: $("biometric-revoke-reason"), confirmarRevocacion: $("biometric-revoke-confirm"),
        fase: $("biometric-phase-pill"), sesion: $("biometric-session-pill"), telemetriaEstado: $("biometric-telemetry-state"),
        telemetriaDescripcion: $("biometric-telemetry-description"), barras: $("biometric-signal-bars"), calidad: $("biometric-quality-label"),
        ultimoEvento: $("biometric-last-event"), ultimoEventoHora: $("biometric-last-event-time")
    };
    const estado = { usuarios: [], usuario: null, lector: null, enrolado: false, fechaRegistro: null, captura: null, operacion: null, consulta: 0, reconexion: 0, intentosReconexion: 0, infraestructuraEnCurso: false, ocupado: false, versionUsuario: 0, ultimaEtapa: 0, ultimoEstado: "" };
    const parametros = new URLSearchParams(location.search);
    const retornoSolicitado = parametros.get("retorno") || "crear_usuario.html";
    const retorno = /^[a-z0-9_-]+\.html(?:\?.*)?$/i.test(retornoSolicitado) ? retornoSolicitado : "crear_usuario.html";
    elementos.volver.href = retorno;

    function notificar(mensaje, tipo) {
        if (window.SenaInterfaz?.showToast) window.SenaInterfaz.showToast(mensaje, tipo);
    }

    async function api(ruta, opciones) {
        const respuesta = await fetch(ruta, { credentials: "same-origin", ...(opciones || {}), headers: { "Content-Type": "application/json", ...((opciones || {}).headers || {}) } });
        const contenido = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok) {
            const error = new Error(contenido?.error?.mensaje || contenido.message || "No fue posible completar la operación.");
            error.codigo = contenido?.error?.codigo || "ERROR";
            error.status = respuesta.status;
            throw error;
        }
        return contenido;
    }

    function iniciales(nombre) {
        return String(nombre || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase() || "—";
    }

    function formatearHora(fecha = new Date()) {
        return new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(fecha);
    }

    function registrarEvento(titulo) {
        if (elementos.ultimoEvento) elementos.ultimoEvento.textContent = titulo;
        if (elementos.ultimoEventoHora) elementos.ultimoEventoHora.textContent = formatearHora();
    }

    function cancelarReconexion() {
        if (estado.reconexion) window.clearTimeout(estado.reconexion);
        estado.reconexion = 0;
    }

    function programarReconexion() {
        if (estado.reconexion || estado.captura) return;
        const demora = Math.min(15000, 3000 * Math.max(1, estado.intentosReconexion));
        estado.reconexion = window.setTimeout(() => {
            estado.reconexion = 0;
            comprobarInfraestructura({ automatico: true }).catch(() => {});
        }, demora);
    }

    // Solo muestra actividad y etapas verificadas; no mide calidad ni intensidad física.
    function pintarSenal(cantidad, etiqueta) {
        const barras = Array.from(elementos.barras?.querySelectorAll("span") || []);
        barras.forEach((barra, indice) => barra.classList.toggle("active", indice < cantidad));
        if (elementos.calidad) elementos.calidad.textContent = etiqueta;
    }

    function sincronizarCentroDeControl(tipo, titulo, mensaje) {
        const fases = {
            idle: "Fase · Lista",
            waiting: "Fase · Esperando dedo",
            processing: "Fase · Analizando",
            success: "Fase · Confirmada",
            error: "Fase · Atención requerida"
        };
        if (elementos.fase) elementos.fase.textContent = fases[tipo] || "Fase · Inicializando";
        if (elementos.sesion) elementos.sesion.textContent = estado.usuario ? `Sesión · ${iniciales(estado.usuario.name)} · Ficha ${estado.usuario.ficha || "—"}` : "Sesión local segura";
        if (elementos.telemetriaEstado) elementos.telemetriaEstado.textContent = titulo;
        if (elementos.telemetriaDescripcion) elementos.telemetriaDescripcion.textContent = mensaje;
    }

    function cambiarEstadoVisual(tipo, titulo, mensaje) {
        elementos.consola.dataset.state = tipo;
        elementos.scanner.dataset.scanState = tipo;
        elementos.titulo.textContent = titulo;
        elementos.mensaje.textContent = mensaje;
        sincronizarCentroDeControl(tipo, titulo, mensaje);
    }

    function pintarInfraestructura(tipo, titulo) {
        elementos.estadoVivo.dataset.state = tipo;
        const iconos = { ready: "fa-circle-check", error: "fa-triangle-exclamation", checking: "fa-circle-notch fa-spin" };
        elementos.estadoVivo.querySelector("i").className = "fas " + (iconos[tipo] || iconos.checking);
        elementos.estadoVivo.querySelector("strong").textContent = titulo;
    }

    function pintarProgreso(actual, total, repetir) {
        const maximo = Math.max(1, Number(total) || 1);
        const valor = Math.min(maximo, Math.max(0, Number(actual) || 0));
        elementos.progreso.max = maximo;
        elementos.progreso.value = valor;
        elementos.progresoTexto.textContent = valor + " / " + maximo;
        elementos.puntos.replaceChildren();
        for (let indice = 0; indice < maximo; indice++) {
            const punto = document.createElement("span");
            punto.className = indice < valor ? "done" : indice === valor ? "active" : "";
            punto.setAttribute("role", "listitem");
            punto.setAttribute("aria-label", `Captura ${indice + 1}: ${indice < valor ? "aceptada" : "pendiente"}`);
            elementos.puntos.appendChild(punto);
        }
        elementos.puntos.classList.toggle("retry", repetir === true);
        if (repetir) pintarSenal(Math.max(1, valor), "Repetir captura");
        else if (valor === 0) pintarSenal(1, "En espera");
        else if (valor < maximo) pintarSenal(Math.min(4, valor + 1), "Capturas recibidas");
        else pintarSenal(5, "Etapas completas");
    }

    function marcarProceso(paso, activo) {
        const item = document.querySelector('[data-process-step="' + paso + '"]');
        if (item) item.classList.toggle("complete", activo);
    }

    function pintarUsuario() {
        const usuario = estado.usuario;
        elementos.iniciales.textContent = iniciales(usuario?.name);
        elementos.nombre.textContent = usuario?.name || "Selecciona un aprendiz";
        elementos.correo.textContent = usuario?.email || "—";
        elementos.documento.textContent = usuario?.document || "—";
        elementos.ficha.textContent = usuario?.ficha || "—";
        elementos.estado.textContent = usuario?.status || "—";
        elementos.selector.disabled = estado.ocupado || Boolean(estado.captura);
        elementos.buscar.disabled = estado.ocupado || Boolean(estado.captura);
        elementos.refrescar.disabled = estado.ocupado || Boolean(estado.captura) || estado.infraestructuraEnCurso;
        elementos.iniciar.disabled = !usuario || !estado.lector?.disponible || estado.lector?.modo !== "real" || Boolean(estado.captura) || estado.ocupado || !elementos.autorizacion.checked;
        if (elementos.sesion) elementos.sesion.textContent = usuario ? `Sesión · ${iniciales(usuario.name)} · Ficha ${usuario.ficha || "—"}` : "Sesión local segura";
    }

    function pintarEstadoPlantilla(registro) {
        estado.enrolado = registro.enrolado === true;
        estado.fechaRegistro = registro.estado?.fecha_registro || estado.fechaRegistro;
        if (!estado.enrolado) estado.fechaRegistro = null;
        elementos.estadoPlantilla.textContent = estado.enrolado ? "Registrada" : "No registrada";
        elementos.estadoPlantilla.className = estado.enrolado ? "registered" : "";
        elementos.metaPlantilla.hidden = !estado.enrolado;
        elementos.fechaPlantilla.textContent = estado.fechaRegistro
            ? "Registrada el " + new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short" }).format(new Date(estado.fechaRegistro))
            : "Plantilla cifrada activa";
        elementos.iniciar.querySelector("span").textContent = estado.enrolado ? "Volver a enrolar" : "Registrar huella";
        elementos.verificar.hidden = !estado.enrolado;
        elementos.revocar.hidden = !estado.enrolado;
        elementos.verificar.disabled = !estado.enrolado || Boolean(estado.captura) || estado.ocupado || !estado.lector?.disponible;
        elementos.revocar.disabled = !estado.enrolado || Boolean(estado.captura) || estado.ocupado;
        marcarProceso("secure", estado.enrolado);
    }

    async function cargarEstadoUsuario({ conservarMensaje = false, version = estado.versionUsuario } = {}) {
        if (!estado.usuario) {
            pintarEstadoPlantilla({ enrolado: false });
            return;
        }
        const registro = await api("/api/biometria/usuarios/" + encodeURIComponent(estado.usuario.id) + "/estado");
        if (version !== estado.versionUsuario) return;
        pintarEstadoPlantilla(registro);
        if (!conservarMensaje) cambiarEstadoVisual(
            "idle",
            estado.enrolado ? "Huella protegida y disponible" : "Listo para registrar",
            estado.enrolado ? "Puedes verificar, revocar o iniciar un nuevo enrolamiento autorizado." : "Pulsa Registrar huella y sigue las capturas indicadas por el lector."
        );
        pintarUsuario();
    }

    async function seleccionarUsuario(id) {
        if (estado.captura) return;
        estado.versionUsuario += 1;
        elementos.autorizacion.checked = false;
        estado.usuario = estado.usuarios.find((usuario) => String(usuario.id) === String(id)) || null;
        elementos.selector.value = estado.usuario?.id || "";
        pintarUsuario();
        if (estado.usuario) {
            registrarEvento("Aprendiz seleccionado", "El directorio vinculó el perfil a esta sesión local.");
            pintarSenal(1, "Perfil cargado");
        }
        try { await cargarEstadoUsuario(); } catch (error) { cambiarEstadoVisual("error", "No se pudo consultar la huella", error.message); registrarEvento("Consulta fallida", error.message, "error"); }
    }

    async function comprobarInfraestructura({ automatico = false } = {}) {
        if (estado.infraestructuraEnCurso) return Boolean(estado.lector?.disponible);
        estado.infraestructuraEnCurso = true;
        if (!automatico) pintarInfraestructura("checking", "Comprobando conexión…");
        pintarUsuario();
        try {
            const datos = await api("/api/biometria/estado");
            estado.lector = { ...datos.lector, modo: datos.modo };
            if (datos.modo !== "real") throw new Error("El sistema no está configurado para biometría real.");
            if (!datos.lector?.disponible || !datos.lector?.hardware_detectado) throw new Error("El lector físico no está disponible.");
            cancelarReconexion();
            estado.intentosReconexion = 0;
            pintarInfraestructura("ready", "Lector físico conectado");
            marcarProceso("reader", true);
            pintarSenal(2, "Servicio conectado");
            registrarEvento("Infraestructura lista", "El puente local autenticó el lector físico DigitalPersona 4500.", "success");
            return true;
        } catch (error) {
            estado.lector = null;
            estado.intentosReconexion += 1;
            pintarInfraestructura("error", error.message);
            cambiarEstadoVisual("error", "Reconectando el lector", "BioSecure volverá a comprobarlo automáticamente. También puedes pulsar Comprobar lector.");
            pintarSenal(1, "Sin lector");
            registrarEvento("Infraestructura no disponible", error.message, "error");
            programarReconexion();
            return false;
        } finally {
            estado.infraestructuraEnCurso = false;
            pintarUsuario();
        }
    }

    async function cancelarCaptura() {
        const id = estado.captura;
        if (!id || estado.ocupado) return;
        estado.ocupado = true;
        elementos.cancelar.disabled = true;
        clearTimeout(estado.consulta);
        cambiarEstadoVisual("processing", "Cancelando lectura", "Esperando respuesta del puente biométrico local.");
        try {
            await api("/api/biometria/capturas/" + encodeURIComponent(id), { method: "DELETE" });
            estado.captura = null;
            elementos.cancelar.hidden = true;
            cambiarEstadoVisual("idle", "Cancelación solicitada", "El proceso de captura fue interrumpido; espera a que el lector quede libre antes de una nueva lectura.");
            pintarSenal(1, "Cancelación solicitada");
            registrarEvento("Cancelación recibida", "El puente reconoció la solicitud de cancelación.", "warning");
            await cargarEstadoUsuario({ conservarMensaje: true });
        } catch (error) {
            cambiarEstadoVisual("error", "No se pudo cancelar", error.message);
            registrarEvento("Cancelación fallida", "Revisa el estado del lector antes de continuar.", "error");
            estado.consulta = window.setTimeout(() => consultarCaptura(id), 800);
        } finally {
            estado.ocupado = false;
            elementos.cancelar.disabled = false;
            pintarUsuario();
        }
    }

    async function consultarCaptura(id) {
        if (estado.captura !== id) return;
        try {
            const datos = await api("/api/biometria/capturas/" + encodeURIComponent(id));
            if (estado.captura !== id) return;
            const captura = datos.captura || {};
            const progreso = captura.progreso || {};
            pintarProgreso(progreso.etapa_actual, progreso.etapas_totales, progreso.requiere_repetir);
            const etapaActual = Number(progreso.etapa_actual) || 0;
            if (etapaActual > estado.ultimaEtapa) {
                registrarEvento("Captura aceptada", `El sensor confirmó la etapa ${etapaActual} de ${progreso.etapas_totales || "—"}.`, "success");
                estado.ultimaEtapa = etapaActual;
            }
            if (["esperando_dedo", "procesando"].includes(captura.estado)) {
                cambiarEstadoVisual(
                    captura.estado === "procesando" ? "processing" : "waiting",
                    progreso.requiere_repetir ? "Repita esta captura" : "Coloque el dedo en el sensor",
                    progreso.mensaje || "Mantenga el dedo quieto hasta que la lectura sea aceptada."
                );
                marcarProceso("capture", Number(progreso.etapa_actual) > 0);
                if (captura.estado === "procesando" && estado.ultimoEstado !== "procesando") registrarEvento("Analizando muestra", "El motor biométrico está procesando la captura actual.");
                estado.ultimoEstado = captura.estado;
                estado.consulta = window.setTimeout(() => consultarCaptura(id), 650);
                return;
            }
            estado.captura = null;
            elementos.cancelar.hidden = true;
            if (captura.estado !== "completada") throw new Error(captura.error?.mensaje || "La captura no se completó.");
            if (estado.operacion === "enrolamiento" && captura.resultado?.enrolamiento_completado) {
                marcarProceso("capture", true); marcarProceso("template", true); marcarProceso("secure", true);
                cambiarEstadoVisual("success", "Huella registrada correctamente", "La plantilla biométrica fue validada, cifrada y asociada al aprendiz.");
                notificar("Huella registrada y protegida correctamente.");
                registrarEvento("Enrolamiento completado", "La plantilla cifrada fue almacenada y quedó lista para identificación.", "success");
                await cargarEstadoUsuario({ conservarMensaje: true });
            } else if (estado.operacion === "verificacion") {
                const coincide = captura.resultado?.coincidencia === true;
                cambiarEstadoVisual(
                    coincide ? "success" : "error",
                    coincide ? "Identidad verificada" : "La huella no coincide",
                    coincide ? "La muestra corresponde a la plantilla registrada para este aprendiz." : "Intenta nuevamente o realiza un nuevo enrolamiento autorizado."
                );
                notificar(coincide ? "Verificación biométrica correcta." : "La huella no coincide.", coincide ? undefined : "error");
                registrarEvento(coincide ? "Verificación correcta" : "Sin coincidencia", coincide ? "La huella corresponde al aprendiz seleccionado." : "La muestra no coincidió con la plantilla registrada.", coincide ? "success" : "warning");
            }
            pintarUsuario();
            pintarEstadoPlantilla({ enrolado: estado.enrolado, estado: { fecha_registro: estado.fechaRegistro } });
        } catch (error) {
            estado.captura = null;
            elementos.cancelar.hidden = true;
            cambiarEstadoVisual("error", "Operación interrumpida", error.message);
            notificar(error.message, "error");
            pintarUsuario();
            pintarSenal(1, "Interrupción");
            registrarEvento("Operación interrumpida", error.message, "error");
            if (estado.usuario) cargarEstadoUsuario().catch(() => {});
        }
    }

    async function iniciarCaptura(operacion) {
        if (!estado.usuario || estado.captura || estado.ocupado) return;
        if (!estado.lector?.disponible) {
            const disponible = await comprobarInfraestructura();
            if (!disponible) {
                notificar("El lector aún no responde. BioSecure seguirá intentando la reconexión.", "error");
                return;
            }
        }
        if (operacion === "enrolamiento" && !elementos.autorizacion.checked) {
            cambiarEstadoVisual("error", "Autorización requerida", "Confirma que existe una autorización documentada antes de registrar la huella.");
            elementos.autorizacion.focus();
            registrarEvento("Autorización requerida", "Se intentó iniciar un enrolamiento sin el consentimiento marcado.", "warning");
            return;
        }
        estado.ocupado = true;
        estado.operacion = operacion;
        estado.ultimaEtapa = 0;
        estado.ultimoEstado = "";
        pintarUsuario();
        cambiarEstadoVisual(
            "waiting",
            operacion === "enrolamiento" ? "Iniciando enrolamiento seguro" : "Iniciando verificación",
            "Cuando el lector se ilumine, coloque el índice derecho sobre el sensor."
        );
        elementos.iniciar.disabled = true;
        elementos.verificar.disabled = true;
        elementos.revocar.disabled = true;
        registrarEvento(
            operacion === "enrolamiento" ? "Sesión de enrolamiento" : "Sesión de verificación",
            operacion === "enrolamiento"
                ? "Se solicitó una nueva plantilla con autorización confirmada."
                : "Se solicitó una verificación puntual del perfil seleccionado."
        );
        try {
            const datos = await api("/api/biometria/capturas", { method: "POST", body: JSON.stringify({ operacion, usuario_id: estado.usuario.id, consentimiento_confirmado: operacion === "enrolamiento" && elementos.autorizacion.checked, tiempo_limite_segundos: 90 }) });
            estado.captura = datos.captura.id;
            estado.ocupado = false;
            elementos.cancelar.hidden = false;
            pintarUsuario();
            pintarProgreso(datos.captura.progreso?.etapa_actual, datos.captura.progreso?.etapas_totales, false);
            consultarCaptura(estado.captura);
        } catch (error) {
            cambiarEstadoVisual("error", "No se pudo iniciar", error.message);
            notificar(error.message, "error");
            estado.ocupado = false;
            pintarUsuario();
            pintarEstadoPlantilla({ enrolado: estado.enrolado });
            registrarEvento("Inicio fallido", error.message, "error");
            if (["LECTOR_NO_DISPONIBLE", "PUENTE_NO_DISPONIBLE", "TIEMPO_AGOTADO"].includes(error.codigo)) {
                estado.lector = null;
                programarReconexion();
            }
        }
    }

    async function revocar() {
        const motivo = elementos.motivo.value.trim();
        if (motivo.length < 10) { elementos.motivo.setCustomValidity("Escribe un motivo de al menos 10 caracteres."); elementos.motivo.reportValidity(); return; }
        elementos.motivo.setCustomValidity("");
        elementos.confirmarRevocacion.disabled = true;
        try {
            const datos = await api("/api/biometria/usuarios/" + encodeURIComponent(estado.usuario.id) + "/estado", { method: "DELETE", body: JSON.stringify({ motivo }) });
            elementos.dialogo.close();
            elementos.motivo.value = "";
            pintarEstadoPlantilla({ enrolado: false });
            cambiarEstadoVisual("idle", "Huella revocada", "El aprendiz puede volver a enrolarse cuando exista una autorización.");
            notificar(datos.mensaje || "Huella revocada correctamente.");
            pintarSenal(1, "Registro revocado");
            registrarEvento("Huella revocada", "La plantilla fue eliminada y el motivo quedó asociado a la auditoría del servidor.", "warning");
        } catch (error) { notificar(error.message, "error"); registrarEvento("Revocación fallida", error.message, "error"); }
        finally { elementos.confirmarRevocacion.disabled = false; pintarUsuario(); }
    }

    function filtrarUsuarios() {
        const filtro = elementos.buscar.value.trim().toLocaleLowerCase("es-CO");
        const seleccionado = estado.usuario?.id || "";
        const coinciden = estado.usuarios.filter((usuario) =>
            [usuario.name, usuario.document, usuario.ficha].some((texto) => String(texto || "").toLocaleLowerCase("es-CO").includes(filtro))
        );
        elementos.selector.replaceChildren(new Option(coinciden.length ? "Selecciona un aprendiz…" : "No hay coincidencias", ""));
        for (const usuario of coinciden) {
            elementos.selector.add(new Option(`${usuario.name} · ${usuario.document} · Ficha ${usuario.ficha || "—"}`, String(usuario.id)));
        }
        if (coinciden.some((usuario) => String(usuario.id) === String(seleccionado))) elementos.selector.value = String(seleccionado);
    }

    async function iniciar() {
        try {
            const [sesion, directorio] = await Promise.all([api("/api/auth/session"), api("/api/users")]);
            if (!sesion.authenticated || sesion.user?.role !== "Administrador") throw Object.assign(new Error("Esta pantalla es exclusiva para administradores."), { status: 403 });
            estado.usuarios = (directorio.users || []).filter((usuario) => usuario.role === "Aprendiz");
            filtrarUsuarios();
            await comprobarInfraestructura();
            const solicitado = parametros.get("usuario");
            if (solicitado) await seleccionarUsuario(solicitado);
            document.documentElement.classList.remove("auth-pending");
            registrarEvento("Consola BioSecure lista", "La estación está lista para operar con el servicio biométrico local.", "success");
        } catch (error) {
            if (error.status === 401 || error.status === 403) { location.replace("login.html?returnTo=" + encodeURIComponent(location.pathname.split("/").pop() + location.search)); return; }
            document.documentElement.classList.remove("auth-pending");
            cambiarEstadoVisual("error", "No se pudo abrir el registro", error.message);
            registrarEvento("Apertura fallida", error.message, "error");
        }
    }

    elementos.selector.addEventListener("change", () => seleccionarUsuario(elementos.selector.value));
    elementos.buscar.addEventListener("input", filtrarUsuarios);
    elementos.autorizacion.addEventListener("change", () => {
        pintarUsuario();
        registrarEvento(
            elementos.autorizacion.checked ? "Consentimiento confirmado" : "Consentimiento pendiente",
            elementos.autorizacion.checked ? "La autorización quedó marcada y se puede iniciar el enrolamiento." : "Se retiró la autorización visual del formulario.",
            elementos.autorizacion.checked ? "success" : "warning"
        );
    });
    elementos.refrescar.addEventListener("click", async () => {
        elementos.refrescar.disabled = true;
        try {
            await comprobarInfraestructura();
            if (estado.usuario) await cargarEstadoUsuario({ conservarMensaje: true });
            registrarEvento("Infraestructura actualizada", "Se solicitó una comprobación manual del canal biométrico.");
        } finally { elementos.refrescar.disabled = false; }
    });
    elementos.iniciar.addEventListener("click", () => iniciarCaptura("enrolamiento"));
    elementos.verificar.addEventListener("click", () => iniciarCaptura("verificacion"));
    elementos.cancelar.addEventListener("click", cancelarCaptura);
    elementos.revocar.addEventListener("click", () => elementos.dialogo.showModal());
    elementos.confirmarRevocacion.addEventListener("click", (evento) => { evento.preventDefault(); revocar(); });
    window.addEventListener("beforeunload", () => { if (estado.captura) fetch("/api/biometria/capturas/" + encodeURIComponent(estado.captura), { method: "DELETE", credentials: "same-origin", keepalive: true }).catch(() => {}); });
    pintarSenal(1, "Inicializando");
    iniciar();
})();
