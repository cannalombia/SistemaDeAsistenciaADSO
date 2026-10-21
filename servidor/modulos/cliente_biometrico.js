/*
    Archivo: cliente_biometrico.js

    Propósito:
    Este archivo centraliza la comunicación del servidor principal con el puente biométrico local.

    Responsabilidad:
    - Agregar la autenticación interna del puente.
    - Aplicar tiempos límite a cada solicitud.
    - Validar las respuestas y normalizar los errores.

    Comunicación:
    Es utilizado por los controladores biométricos de Node.js y se comunica por HTTP
    únicamente con el servicio local configurado.

    Límites:
    No atiende al navegador, no registra asistencias, no guarda plantillas y nunca
    escribe la clave local en mensajes o registros.
*/

"use strict";

const CODIGOS_CONOCIDOS = new Set([
    "CAPTURA_EN_CURSO",
    "CAPTURA_NO_ENCONTRADA",
    "TIEMPO_AGOTADO",
    "MUESTRA_INVALIDA",
    "LECTOR_NO_DISPONIBLE",
    "PLANTILLA_INVALIDA",
    "PLANTILLA_INCOMPATIBLE",
    "IDENTIFICACION_NO_SOPORTADA",
    "SIN_PLANTILLAS"
]);

class ErrorBiometrico extends Error {
    constructor(codigo, mensaje, estado_http = 502) {
        super(mensaje);
        this.name = "ErrorBiometrico";
        this.codigo = codigo;
        this.estado_http = estado_http;
    }
}

function validar_url_local(valor) {
    let url;
    try {
        url = new URL(String(valor || ""));
    } catch (_error) {
        throw new Error("BIOMETRIC_SERVICE_URL debe ser una URL HTTP local válida.");
    }

    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.username || url.password || url.search || url.hash) {
        throw new Error("BIOMETRIC_SERVICE_URL debe usar http://127.0.0.1 sin credenciales ni parámetros.");
    }
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url;
}

function codigo_por_estado(estado_http) {
    if (estado_http === 401 || estado_http === 403) return "PUENTE_NO_AUTORIZADO";
    if (estado_http === 404) return "CAPTURA_NO_ENCONTRADA";
    if (estado_http === 409) return "CAPTURA_EN_CURSO";
    return "ERROR_BIOMETRICO";
}

function mensaje_por_codigo(codigo) {
    const mensajes = {
        BIOMETRIA_DESHABILITADA: "La integración biométrica está deshabilitada.",
        PUENTE_NO_DISPONIBLE: "El servicio biométrico local no está disponible.",
        PUENTE_NO_AUTORIZADO: "El servidor principal no pudo autenticarse con el puente biométrico.",
        CAPTURA_EN_CURSO: "Ya existe una captura biométrica en curso.",
        CAPTURA_NO_ENCONTRADA: "La captura biométrica solicitada no existe.",
        TIEMPO_AGOTADO: "Se agotó el tiempo disponible para la operación biométrica.",
        MUESTRA_INVALIDA: "La muestra biométrica fue rechazada.",
        LECTOR_NO_DISPONIBLE: "El lector biométrico no está disponible.",
        PLANTILLA_INVALIDA: "La plantilla biométrica no pudo procesarse.",
        PLANTILLA_INCOMPATIBLE: "La plantilla biométrica no es compatible con el lector.",
        IDENTIFICACION_NO_SOPORTADA: "El controlador biométrico no permite identificación 1:N.",
        SIN_PLANTILLAS: "No hay plantillas biométricas disponibles.",
        ERROR_BIOMETRICO: "El servicio biométrico devolvió una respuesta no válida."
    };
    return mensajes[codigo] || mensajes.ERROR_BIOMETRICO;
}

function crear_error_desde_respuesta(estado_http, contenido) {
    const codigo_puente = String(contenido?.error?.codigo || "");
    const codigo = CODIGOS_CONOCIDOS.has(codigo_puente)
        ? codigo_puente
        : codigo_por_estado(estado_http);
    const estado_normalizado = codigo === "CAPTURA_NO_ENCONTRADA" ? 404
        : codigo === "CAPTURA_EN_CURSO" ? 409
            : codigo === "PUENTE_NO_AUTORIZADO" ? 502
                : estado_http >= 400 && estado_http < 500 ? estado_http : 502;
    return new ErrorBiometrico(codigo, mensaje_por_codigo(codigo), estado_normalizado);
}

function crearClienteBiometrico(configuracion = {}) {
    const habilitado = configuracion.habilitado === true;
    const url_base = validar_url_local(configuracion.url_servicio || "http://127.0.0.1:4318");
    const clave_local = String(configuracion.clave_local || "");
    const tiempo_limite_ms = Math.min(30000, Math.max(50, Number(configuracion.tiempo_limite_ms) || 5000));
    const realizar_fetch = configuracion.realizar_fetch || fetch;

    async function solicitar(ruta, opciones = {}) {
        if (!habilitado) {
            throw new ErrorBiometrico("BIOMETRIA_DESHABILITADA", mensaje_por_codigo("BIOMETRIA_DESHABILITADA"), 503);
        }
        if (!clave_local) {
            throw new ErrorBiometrico("PUENTE_NO_AUTORIZADO", mensaje_por_codigo("PUENTE_NO_AUTORIZADO"), 502);
        }

        const controlador = new AbortController();
        const temporizador = setTimeout(() => controlador.abort(), tiempo_limite_ms);
        try {
            const encabezados = { Authorization: `Bearer ${clave_local}` };
            if (opciones.cuerpo !== undefined) encabezados["Content-Type"] = "application/json";
            const respuesta = await realizar_fetch(new URL(ruta.replace(/^\//, ""), url_base), {
                method: opciones.metodo || "GET",
                headers: encabezados,
                body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
                signal: controlador.signal
            });

            const texto = await respuesta.text();
            let contenido;
            try {
                contenido = texto ? JSON.parse(texto) : null;
            } catch (_error) {
                throw new ErrorBiometrico("ERROR_BIOMETRICO", mensaje_por_codigo("ERROR_BIOMETRICO"), 502);
            }

            if (!contenido || typeof contenido !== "object" || Array.isArray(contenido)) {
                throw new ErrorBiometrico("ERROR_BIOMETRICO", mensaje_por_codigo("ERROR_BIOMETRICO"), 502);
            }
            if (!respuesta.ok || contenido.correcto !== true) {
                throw crear_error_desde_respuesta(respuesta.status, contenido);
            }
            return contenido;
        } catch (error) {
            if (error instanceof ErrorBiometrico) throw error;
            if (error?.name === "AbortError") {
                throw new ErrorBiometrico("TIEMPO_AGOTADO", mensaje_por_codigo("TIEMPO_AGOTADO"), 504);
            }
            throw new ErrorBiometrico("PUENTE_NO_DISPONIBLE", mensaje_por_codigo("PUENTE_NO_DISPONIBLE"), 503);
        } finally {
            clearTimeout(temporizador);
        }
    }

    async function consultar_salud() {
        const contenido = await solicitar("/v1/salud");
        if (!contenido.servicio || !contenido.modo) {
            throw new ErrorBiometrico("ERROR_BIOMETRICO", mensaje_por_codigo("ERROR_BIOMETRICO"), 502);
        }
        return contenido;
    }

    async function consultar_lector() {
        const contenido = await solicitar("/v1/lector");
        if (!contenido.lector || typeof contenido.lector !== "object") {
            throw new ErrorBiometrico("ERROR_BIOMETRICO", mensaje_por_codigo("ERROR_BIOMETRICO"), 502);
        }
        return contenido;
    }

    async function iniciar_captura(datos) {
        const contenido = await solicitar("/v1/capturas", { metodo: "POST", cuerpo: datos });
        if (!contenido.captura?.id || !contenido.captura?.estado) {
            throw new ErrorBiometrico("ERROR_BIOMETRICO", mensaje_por_codigo("ERROR_BIOMETRICO"), 502);
        }
        return contenido;
    }

    async function consultar_captura(id) {
        const contenido = await solicitar(`/v1/capturas/${encodeURIComponent(id)}`);
        if (!contenido.captura?.id || !contenido.captura?.estado) {
            throw new ErrorBiometrico("ERROR_BIOMETRICO", mensaje_por_codigo("ERROR_BIOMETRICO"), 502);
        }
        return contenido;
    }

    async function cancelar_captura(id) {
        const contenido = await solicitar(`/v1/capturas/${encodeURIComponent(id)}`, { metodo: "DELETE" });
        if (!contenido.captura?.id || !contenido.captura?.estado) {
            throw new ErrorBiometrico("ERROR_BIOMETRICO", mensaje_por_codigo("ERROR_BIOMETRICO"), 502);
        }
        return contenido;
    }

    return {
        habilitado,
        consultar_salud,
        consultar_lector,
        iniciar_captura,
        consultar_captura,
        cancelar_captura
    };
}

module.exports = { crearClienteBiometrico, ErrorBiometrico };
