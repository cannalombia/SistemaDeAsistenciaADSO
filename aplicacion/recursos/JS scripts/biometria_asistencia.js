/*
    Archivo: biometria_asistencia.js

    Propósito:
    Integrar la identificación biométrica dentro de la pantalla normal de asistencia.

    Responsabilidad:
    Consultar el estado biométrico, iniciar una identificación contra todos los aprendices
    activos de la ficha seleccionada, mostrar el resultado y cancelar la prueba si hace falta.

    Comunicación:
    Solo utiliza /api/biometria del servidor principal. El navegador nunca conoce el puente local.

    Límites:
    No conoce secretos ni plantillas. En modo real confirma la asistencia únicamente mediante un ticket
    efímero emitido por el servidor después de una identificación válida.
*/
(function () {
    "use strict";

    const panel = document.getElementById("attendance-biometric-panel");
    const botonAlternar = document.getElementById("attendance-biometric-toggle");
    if (!panel || !botonAlternar) return;

    const ficha = document.getElementById("attendance-ficha");
    const jornada = document.getElementById("attendance-journey");
    const botonActualizar = document.getElementById("attendance-biometric-refresh");
    const botonIniciar = document.getElementById("attendance-biometric-start");
    const botonCancelar = document.getElementById("attendance-biometric-cancel");
    const enlaceEnrolar = document.getElementById("attendance-biometric-enroll-link");
    const tarjetaLector = panel.querySelector(".attendance-biometric-reader");

    const vista = {
        tituloLector: document.getElementById("attendance-biometric-reader-title"),
        mensajeLector: document.getElementById("attendance-biometric-reader-message"),
        puente: document.getElementById("attendance-biometric-bridge"),
        lector: document.getElementById("attendance-biometric-reader-state"),
        hardware: document.getElementById("attendance-biometric-hardware"),
        ficha: document.getElementById("attendance-biometric-ficha"),
        jornada: document.getElementById("attendance-biometric-jornada"),
        estadoCaptura: document.getElementById("attendance-biometric-capture-state"),
        resultado: document.getElementById("attendance-biometric-result"),
        tituloResultado: document.getElementById("attendance-biometric-result-title"),
        mensajeResultado: document.getElementById("attendance-biometric-result-message"),
        nombre: document.getElementById("attendance-biometric-result-name"),
        documento: document.getElementById("attendance-biometric-result-document"),
        fichaResultado: document.getElementById("attendance-biometric-result-ficha"),
        hora: document.getElementById("attendance-biometric-result-time"),
        icono: document.getElementById("attendance-biometric-icon"),
        scanner: document.getElementById("attendance-biometric-scanner"),
        banner: document.getElementById("attendance-biometric-banner"),
        bannerIcono: document.getElementById("attendance-biometric-banner-icon"),
        bannerKicker: document.getElementById("attendance-biometric-banner-kicker"),
        bannerTitulo: document.getElementById("attendance-biometric-title"),
        bannerTexto: document.getElementById("attendance-biometric-banner-text"),
        modoPill: document.getElementById("attendance-biometric-mode-pill"),
        operacionKicker: document.getElementById("attendance-biometric-operation-kicker"),
        operacionTitulo: document.getElementById("attendance-biometric-operation-title"),
        campoTitulo: document.getElementById("attendance-biometric-field-title"),
        campoTexto: document.getElementById("attendance-biometric-field-text"),
        notaResultado: document.getElementById("attendance-biometric-result-note"),
        phasePill: document.getElementById("attendance-biometric-phase-pill"),
        statusChip: document.getElementById("attendance-biometric-status-chip"),
        flowTitle: document.getElementById("attendance-biometric-flow-title"),
        flowCopy: document.getElementById("attendance-biometric-flow-copy"),
        signal: document.getElementById("attendance-biometric-signal"),
        signalLabel: document.getElementById("attendance-biometric-signal-label"),
        timeline: document.getElementById("attendance-biometric-timeline")
    };

    let capturaActiva = null;
    let intervaloConsulta = null;
    let servicioDisponible = false;
    let modoBiometria = "mock";
    let etapaVisual = 0;
    let consultando = false;
    let ultimoEstadoCaptura = "";

    function horaActual() {
        return new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
    }

    function registrarLinea(titulo, detalle, tipo = "info") {
        if (!vista.timeline) return;
        const item = document.createElement("li");
        item.dataset.type = tipo;
        const encabezado = document.createElement("strong");
        encabezado.textContent = titulo;
        const descripcion = document.createElement("p");
        descripcion.textContent = detalle;
        const hora = document.createElement("small");
        hora.textContent = horaActual();
        item.append(encabezado, descripcion, hora);
        const vacio = vista.timeline.querySelector(".empty");
        if (vacio) vacio.remove();
        vista.timeline.prepend(item);
        while (vista.timeline.children.length > 5) vista.timeline.lastElementChild.remove();
    }

    function pintarSenal(cantidad, etiqueta) {
        vista.signal?.querySelectorAll("span").forEach((barra, indice) => {
            barra.classList.toggle("active", indice < cantidad);
        });
        if (vista.signalLabel) vista.signalLabel.textContent = etiqueta;
    }

    function pintarTelemetry(estado, titulo, detalle) {
        const fases = {
            checking: "Canal local · verificando",
            idle: "Canal local · listo",
            waiting: "Canal local · esperando dedo",
            processing: "Canal local · analizando",
            success: "Canal local · asistencia confirmada",
            error: "Canal local · atención requerida"
        };
        if (vista.phasePill) vista.phasePill.textContent = fases[estado] || "Canal local · verificando";
        if (vista.statusChip) vista.statusChip.textContent = ({ checking: "Verificando", idle: "Listo", waiting: "Esperando", processing: "Analizando", success: "Confirmado", error: "Error" })[estado] || "Estado";
        if (vista.flowTitle) vista.flowTitle.textContent = titulo;
        if (vista.flowCopy) vista.flowCopy.textContent = detalle;
    }

    function detenerEtapasVisuales() {
        // Las marcas solo se completan con confirmación real del backend.
        // No se inventan pasos de comparación con un temporizador.
    }

    function pintarEtapas(cantidad) {
        etapaVisual = Math.max(0, Math.min(5, Number(cantidad) || 0));
        vista.scanner?.querySelectorAll("[data-stage]").forEach((punto) => {
            punto.classList.toggle("active", Number(punto.dataset.stage) <= etapaVisual);
        });
    }

    function animarEtapas() {
        pintarEtapas(0);
    }

    function actualizarScanner(estado) {
        if (!vista.scanner) return;
        vista.scanner.dataset.scanState = estado;
        if (["waiting", "processing"].includes(estado)) animarEtapas();
        else {
            detenerEtapasVisuales();
            // Cinco marcas representan el flujo visual; solo completar tras confirmación.
            if (estado !== "success") pintarEtapas(0);
        }
    }

    function configurarPresentacionModo() {
        const real = modoBiometria === "real";
        if (vista.banner) vista.banner.dataset.mode = real ? "real" : "mock";
        if (vista.bannerIcono) vista.bannerIcono.className = real ? "fas fa-shield-halved" : "fas fa-flask";
        if (vista.bannerKicker) vista.bannerKicker.textContent = real ? "Canal biométrico protegido" : "Entorno controlado";
        if (vista.bannerTitulo) vista.bannerTitulo.textContent = real ? "BIOMETRÍA REAL ACTIVA" : "MODO BIOMÉTRICO DE PRUEBA";
        if (vista.bannerTexto) vista.bannerTexto.textContent = real
            ? "DigitalPersona U.are.U 4500 conectado mediante WSL2 + libfprint. Las plantillas permanecen cifradas y nunca llegan al navegador."
            : "No existe captura real de huella ni se crean plantillas biométricas. El flujo valida la integración del sistema.";
        if (vista.modoPill) vista.modoPill.textContent = real ? "REAL" : "MOCK";
        if (vista.operacionKicker) vista.operacionKicker.textContent = real ? "Identificación biométrica real" : "Identificación simulada";
        if (vista.operacionTitulo) vista.operacionTitulo.textContent = real ? "Registrar asistencia por huella" : "Probar asistencia por huella";
        if (vista.campoTitulo) vista.campoTitulo.textContent = real ? "Identificación 1:N por ficha" : "Identificación por ficha";
        if (vista.campoTexto) vista.campoTexto.textContent = real
            ? "El servidor compara la captura únicamente contra las plantillas cifradas de los aprendices activos de la ficha seleccionada."
            : "La simulación no requiere escoger al aprendiz. El servidor usa todos los aprendices activos de la ficha seleccionada y devuelve un candidato simulado.";
        if (vista.notaResultado) vista.notaResultado.innerHTML = real
            ? '<i class="fas fa-shield-halved" aria-hidden="true"></i> Una coincidencia válida genera un ticket de un solo uso y registra la asistencia como presente.'
            : '<i class="fas fa-circle-info" aria-hidden="true"></i> Esta etapa no escribe registros reales de asistencia.';
    }

    async function solicitar(url, opciones = {}) {
        const respuesta = await fetch(url, {
            credentials: "same-origin",
            ...opciones,
            headers: { "Content-Type": "application/json", ...(opciones.headers || {}) }
        });
        const contenido = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok) {
            const error = new Error(contenido?.error?.mensaje || contenido?.message || "No fue posible completar la operación biométrica.");
            error.codigo = contenido?.error?.codigo || "ERROR_BIOMETRICO";
            throw error;
        }
        return contenido;
    }

    function detenerConsulta() {
        if (intervaloConsulta) window.clearTimeout(intervaloConsulta);
        intervaloConsulta = null;
    }

    function programarConsulta(id, espera = 800) {
        detenerConsulta();
        intervaloConsulta = window.setTimeout(() => consultarCaptura(id), espera);
    }

    function sincronizarContexto() {
        vista.ficha.textContent = ficha?.value || "—";
        vista.jornada.textContent = jornada?.value || "—";
        botonIniciar.disabled = !servicioDisponible || !ficha?.value || Boolean(capturaActiva);
        if (!ficha?.value) pintarTelemetry("idle", "Esperando ficha", "Selecciona una ficha para habilitar la identificación biométrica de asistencia.");
    }

    function pintarEstadoLector(tipo, titulo, mensaje) {
        tarjetaLector.dataset.state = tipo;
        actualizarScanner(tipo === "loading" ? "processing" : tipo === "ok" ? "idle" : "error");
        vista.tituloLector.textContent = titulo;
        vista.mensajeLector.textContent = mensaje;
        vista.icono.className = tipo === "ok" ? "fas fa-fingerprint" : tipo === "loading" ? "fas fa-circle-notch fa-spin" : "fas fa-triangle-exclamation";
        if (tipo === "loading") {
            pintarTelemetry("checking", "Comprobando servicio", "Consultando el puente biométrico local y el estado del lector.");
            pintarSenal(1, "Verificando");
        } else if (tipo === "ok") {
            pintarTelemetry("idle", "Lector biométrico listo", "La estación quedó preparada para identificar aprendices de la ficha activa.");
            pintarSenal(2, "En espera");
        } else {
            pintarTelemetry("error", "Canal no disponible", mensaje);
            pintarSenal(1, "Sin conexión");
        }
    }

    function pintarResultado(estado, titulo, mensaje, aprendiz = null) {
        vista.resultado.dataset.state = estado;
        actualizarScanner(estado === "waiting" ? "waiting" : estado === "success" ? "success" : estado === "error" ? "error" : "idle");
        vista.tituloResultado.textContent = titulo;
        vista.mensajeResultado.textContent = mensaje;
        vista.nombre.textContent = aprendiz?.nombre || "—";
        vista.documento.textContent = aprendiz?.documento || "—";
        vista.fichaResultado.textContent = aprendiz?.ficha || ficha?.value || "—";
        vista.hora.textContent = estado === "success" ? horaActual() : "—";
        if (estado === "waiting") pintarTelemetry("waiting", titulo, mensaje);
        else if (estado === "success") pintarTelemetry("success", titulo, mensaje);
        else if (estado === "error") pintarTelemetry("error", titulo, mensaje);
        else pintarTelemetry("idle", titulo, mensaje);
    }

    async function consultarEstado() {
        servicioDisponible = false;
        sincronizarContexto();
        pintarEstadoLector("loading", "Comprobando servicio…", "Consultando el puente biométrico local.");
        vista.puente.textContent = "Consultando";
        vista.lector.textContent = "Consultando";
        vista.hardware.textContent = "NO";
        try {
            const datos = await solicitar("/api/biometria/estado");
            modoBiometria = datos.modo === "real" ? "real" : "mock";
            configurarPresentacionModo();
            servicioDisponible = datos.habilitado === true && datos.lector?.disponible === true;
            vista.puente.textContent = servicioDisponible ? "Disponible" : "No disponible";
            vista.lector.textContent = datos.lector?.estado || "Desconocido";
            vista.hardware.textContent = datos.lector?.hardware_detectado === true ? "SÍ" : "NO";
            pintarEstadoLector(
                servicioDisponible ? "ok" : "error",
                servicioDisponible ? (modoBiometria === "real" ? "DigitalPersona 4500 listo" : "Lector de prueba listo") : "Servicio no disponible",
                modoBiometria === "mock"
                    ? "La integración está conectada en modo simulado. No hay captura biométrica real."
                    : "Lector físico conectado mediante WSL2 y libfprint. La captura es real."
            );
            registrarLinea(
                servicioDisponible ? "Canal biométrico listo" : "Canal biométrico degradado",
                servicioDisponible ? "El lector y el puente local quedaron disponibles para asistencia." : "El servicio no quedó disponible después de la verificación.",
                servicioDisponible ? "success" : "warning"
            );
        } catch (error) {
            vista.puente.textContent = "No disponible";
            vista.lector.textContent = "Sin conexión";
            pintarEstadoLector("error", "Servicio biométrico no disponible", error.message + " Puedes continuar utilizando el QR o el registro manual.");
            registrarLinea("Error de infraestructura", error.message, "error");
        }
        sincronizarContexto();
    }

    function finalizarCaptura() {
        capturaActiva = null;
        detenerConsulta();
        detenerEtapasVisuales();
        botonCancelar.hidden = true;
        vista.estadoCaptura.textContent = "Listo";
        sincronizarContexto();
    }

    function interpretarCaptura(captura, mensajeServidor) {
        vista.estadoCaptura.textContent = captura.estado || "Desconocido";
        const progreso = captura.progreso || {};
        if (progreso.etapa_actual || progreso.etapas_totales) {
            pintarEtapas(progreso.etapa_actual);
            if (progreso.requiere_repetir) pintarSenal(Math.max(1, progreso.etapa_actual || 1), "Repetir muestra");
            else if ((progreso.etapa_actual || 0) < (progreso.etapas_totales || 1)) pintarSenal(Math.min(4, (progreso.etapa_actual || 0) + 1), "Captura recibida");
            else pintarSenal(5, "Etapas completas");
        }
        if (["esperando_dedo", "procesando"].includes(captura.estado)) {
            actualizarScanner(captura.estado === "procesando" ? "processing" : "waiting");
            pintarResultado(
                "waiting",
                modoBiometria === "real" ? "Coloque su dedo en el lector…" : "Esperando huella simulada…",
                progreso.mensaje || (modoBiometria === "real" ? "Se comparará la huella contra los aprendices enrolados de la ficha seleccionada." : "La prueba compara contra todos los aprendices activos de la ficha seleccionada.")
            );
            if (captura.estado === "procesando" && ultimoEstadoCaptura !== "procesando") registrarLinea("Comparando muestra", "El motor está validando la lectura actual.");
            ultimoEstadoCaptura = captura.estado;
            return false;
        }
        if (captura.estado === "completada") {
            if (captura.resultado?.coincidencia === false) {
                actualizarScanner("error");
                pintarResultado("error", modoBiometria === "real" ? "Huella no reconocida" : "Sin coincidencia simulada", modoBiometria === "real" ? "La huella no coincide con los aprendices enrolados de esta ficha." : "Ningún aprendiz activo de la ficha fue identificado en la simulación.");
                registrarLinea("Sin coincidencia", "La lectura finalizó sin identificar un aprendiz válido.", "warning");
            } else {
                actualizarScanner("success");
                pintarResultado("success", modoBiometria === "real" ? "Aprendiz identificado" : "RESULTADO SIMULADO · Aprendiz identificado", mensajeServidor || (modoBiometria === "real" ? "Identificación biométrica real completada. Todavía no se registró asistencia." : "Identificación simulada completada. No se registró asistencia."), captura.resultado?.usuario || null);
                registrarLinea("Identificación correcta", "La estación reconoció un aprendiz válido para la ficha seleccionada.", "success");
            }
            return true;
        }
        if (captura.estado === "cancelada") {
            actualizarScanner("idle");
            pintarResultado("cancelled", "Captura cancelada", modoBiometria === "real" ? "La captura real fue cancelada." : "La captura simulada fue cancelada.");
            pintarSenal(1, "Captura detenida");
            registrarLinea("Captura cancelada", "La prueba biométrica fue cancelada por el usuario o el sistema.", "warning");
            return true;
        }
        const codigo = captura.error?.codigo || "";
        const textos = {
            TIEMPO_AGOTADO: ["Tiempo agotado", modoBiometria === "real" ? "No se recibió una huella válida dentro del tiempo establecido." : "No se recibió una huella simulada dentro del tiempo establecido."],
            MUESTRA_INVALIDA: [modoBiometria === "real" ? "Lectura inválida" : "Muestra simulada inválida", modoBiometria === "real" ? "Vuelva a colocar el dedo de forma plana y centrada." : "La simulación marcó la muestra como inválida."],
            LECTOR_NO_DISPONIBLE: ["Lector no disponible", modoBiometria === "real" ? "Comprueba que el DigitalPersona esté conectado y adjunto a WSL." : "El lector simulado no está disponible."],
            CAPTURA_CANCELADA: ["Captura cancelada", "La operación biométrica fue cancelada."],
            IDENTIFICACION_NO_SOPORTADA: ["Identificación no disponible", "El controlador libfprint activo no ofrece identificación 1:N para este lector."]
        };
        const [titulo, mensaje] = textos[codigo] || ["Error biométrico", captura.error?.mensaje || "La operación biométrica terminó con un error."];
        pintarResultado("error", titulo, mensaje);
        pintarSenal(1, "Incidencia");
        registrarLinea("Error biométrico", mensaje, "error");
        return true;
    }

    async function confirmarAsistenciaReal(ticket) {
        return solicitar("/api/biometria/asistencia/confirmar", {
            method: "POST",
            body: JSON.stringify({ ticket_asistencia: ticket })
        });
    }

    async function consultarCaptura(idSolicitado = capturaActiva) {
        if (!idSolicitado || capturaActiva !== idSolicitado || consultando) return;
        consultando = true;
        let continuar = false;
        try {
            const datos = await solicitar(`/api/biometria/capturas/${encodeURIComponent(idSolicitado)}`);
            if (capturaActiva !== idSolicitado) return;
            const captura = datos.captura || {};
            if (modoBiometria === "real"
                && captura.estado === "completada"
                && captura.resultado?.coincidencia === true
                && captura.resultado?.ticket_asistencia) {
                pintarTelemetry("processing", "Registrando asistencia", "Validando el ticket de un solo uso y confirmando la escritura.");
                pintarEtapas(3);
                const confirmacion = await confirmarAsistenciaReal(captura.resultado.ticket_asistencia);
                if (capturaActiva !== idSolicitado) return;
                datos.mensaje = confirmacion.mensaje || "Asistencia registrada correctamente por huella digital.";
                pintarEtapas(5);
                try { localStorage.setItem("sena-attendance-updated", String(Date.now())); } catch (_) {}
                window.dispatchEvent(new CustomEvent("sena:attendance-updated", { detail: { metodo: "huella" } }));
                registrarLinea("Asistencia confirmada", "El servidor registró la asistencia y confirmó la transacción.", "success");
            }
            if (interpretarCaptura(captura, datos.mensaje)) finalizarCaptura();
            else continuar = true;
        } catch (error) {
            if (capturaActiva !== idSolicitado) return;
            pintarResultado("error", "No fue posible finalizar", error.message);
            pintarSenal(1, "Incidencia");
            registrarLinea("Operación interrumpida", error.message, "error");
            finalizarCaptura();
        } finally {
            consultando = false;
            if (continuar && capturaActiva === idSolicitado) programarConsulta(idSolicitado);
        }
    }

    async function iniciarCaptura() {
        if (enlaceEnrolar) enlaceEnrolar.hidden = true;
        if (capturaActiva || !ficha?.value || !servicioDisponible) return;
        botonIniciar.disabled = true;
        vista.estadoCaptura.textContent = "Iniciando";
        pintarResultado("waiting", modoBiometria === "real" ? "Preparando lector real…" : "Iniciando identificación simulada…", "Preparando la comparación contra la ficha seleccionada.");
        registrarLinea("Identificación iniciada", `Se activó una búsqueda biométrica para la ficha ${ficha.value}.`);
        try {
            const datos = await solicitar("/api/biometria/capturas", {
                method: "POST",
                body: JSON.stringify({ operacion: "identificacion", ficha: ficha.value, jornada: jornada?.value || "", tiempo_limite_segundos: 30 })
            });
            capturaActiva = datos.captura.id;
            ultimoEstadoCaptura = "";
            vista.estadoCaptura.textContent = datos.captura.estado || "Esperando";
            botonCancelar.hidden = false;
            interpretarCaptura(datos.captura, datos.mensaje);
            detenerConsulta();
            programarConsulta(capturaActiva, 250);
        } catch (error) {
            pintarResultado("error", "No se pudo iniciar la identificación", error.message);
            registrarLinea("Inicio fallido", error.message, "error");
            if (error.codigo === "SIN_HUELLAS_ENROLADAS" && enlaceEnrolar) {
                try {
                    const sesion = await solicitar("/api/auth/session");
                    enlaceEnrolar.hidden = sesion.user?.role !== "Administrador";
                } catch (_) { enlaceEnrolar.hidden = true; }
            }
            finalizarCaptura();
        }
    }

    async function cancelarCaptura() {
        if (!capturaActiva) return;
        const id = capturaActiva;
        botonCancelar.disabled = true;
        try {
            const datos = await solicitar(`/api/biometria/capturas/${encodeURIComponent(id)}`, { method: "DELETE" });
            interpretarCaptura(datos.captura, datos.mensaje);
        } catch (error) {
            pintarResultado("error", "No se pudo cancelar", error.message);
            registrarLinea("Cancelación fallida", error.message, "error");
        } finally {
            botonCancelar.disabled = false;
            finalizarCaptura();
        }
    }

    function alternarPanel(forzarApertura = null) {
        const abrir = forzarApertura === null ? panel.hidden : Boolean(forzarApertura);
        panel.hidden = !abrir;
        botonAlternar.setAttribute("aria-expanded", String(abrir));
        botonAlternar.classList.toggle("active", abrir);
        if (!abrir) {
            if (capturaActiva) cancelarCaptura();
            detenerConsulta();
            return;
        }
        consultarEstado();
        sincronizarContexto();
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
        registrarLinea("Panel abierto", "Se desplegó el panel premium de asistencia por huella.");
    }

    botonAlternar.addEventListener("click", () => alternarPanel());
    botonActualizar.addEventListener("click", consultarEstado);
    botonIniciar.addEventListener("click", iniciarCaptura);
    botonCancelar.addEventListener("click", cancelarCaptura);
    ficha?.addEventListener("change", () => {
        sincronizarContexto();
        registrarLinea("Ficha actualizada", `La ficha activa cambió a ${ficha.value || "sin selección"}.`);
    });
    jornada?.addEventListener("change", () => sincronizarContexto());

    window.addEventListener("pagehide", () => {
        detenerConsulta();
        detenerEtapasVisuales();
        if (capturaActiva) {
            fetch(`/api/biometria/capturas/${encodeURIComponent(capturaActiva)}`, { method: "DELETE", credentials: "same-origin", keepalive: true }).catch(() => {});
        }
    });

    configurarPresentacionModo();
    actualizarScanner("idle");
    pintarSenal(1, "Inicializando");
    pintarTelemetry("checking", "Panel biométrico listo", "Abre el panel y selecciona una ficha para comenzar.");
    sincronizarContexto();
    const parametros = new URLSearchParams(window.location.search);
    if (parametros.get("metodo") === "huella") window.setTimeout(() => alternarPanel(true), 250);
})();
