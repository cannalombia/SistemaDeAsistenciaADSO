/*
    Archivo: servidor_mock.js

    Propósito:
    Este archivo implementa un puente biométrico de prueba sin usar hardware ni SDK.

    Responsabilidad:
    - Escuchar únicamente en 127.0.0.1:4318.
    - Exponer el contrato HTTP aprobado para salud, lector y capturas simuladas.
    - Validar la clave local y conservar temporalmente las capturas en memoria.

    Comunicación:
    Recibe solicitudes HTTP del futuro servidor Node.js del sistema de asistencia.

    Límites:
    No se comunica con DigitalPersona, no registra asistencias y no crea ni guarda
    muestras o plantillas biométricas reales o falsas.
*/

"use strict";

const http = require("node:http");
const crypto = require("node:crypto");

const DIRECCION_LOCAL = "127.0.0.1";
const PUERTO_LOCAL = Number(process.env.PUERTO_PUENTE_BIOMETRICO || 4318);
if (!Number.isInteger(PUERTO_LOCAL) || PUERTO_LOCAL < 1024 || PUERTO_LOCAL > 65535) {
    throw new Error("PUERTO_PUENTE_BIOMETRICO debe ser un puerto local válido entre 1024 y 65535.");
}
const VERSION_CONTRATO = "1.0";
const TAMANO_MAXIMO_SOLICITUD = 16 * 1024;
const RETENCION_CAPTURA_MS = 5 * 60 * 1000;
const RESULTADOS_PERMITIDOS = new Set([
    "coincidencia",
    "sin_coincidencia",
    "muestra_invalida",
    "tiempo_agotado",
    "error_lector"
]);

const capturas = new Map();
let siguiente_resultado = "coincidencia";

function enviar_json(respuesta, estado_http, contenido) {
    respuesta.writeHead(estado_http, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
    });
    respuesta.end(JSON.stringify(contenido));
}

function enviar_error(respuesta, estado_http, codigo, mensaje, detalle = null) {
    enviar_json(respuesta, estado_http, {
        correcto: false,
        error: { codigo, mensaje, detalle }
    });
}

function obtener_clave_local() {
    return String(process.env.CLAVE_LOCAL_PUENTE || "");
}

function comparar_claves(clave_recibida, clave_esperada) {
    const recibida = Buffer.from(clave_recibida, "utf8");
    const esperada = Buffer.from(clave_esperada, "utf8");
    return recibida.length === esperada.length && crypto.timingSafeEqual(recibida, esperada);
}

function solicitud_autorizada(solicitud) {
    const encabezado = String(solicitud.headers.authorization || "");
    const coincidencia = encabezado.match(/^Bearer\s+(.+)$/i);
    return Boolean(coincidencia && comparar_claves(coincidencia[1], obtener_clave_local()));
}

async function leer_json(solicitud) {
    return new Promise((resolver, rechazar) => {
        const partes = [];
        let tamano = 0;

        solicitud.on("data", (parte) => {
            tamano += parte.length;
            if (tamano > TAMANO_MAXIMO_SOLICITUD) {
                rechazar(Object.assign(new Error("La solicitud es demasiado grande."), { estado_http: 413 }));
                solicitud.destroy();
                return;
            }
            partes.push(parte);
        });

        solicitud.on("end", () => {
            try {
                const texto = Buffer.concat(partes).toString("utf8");
                resolver(texto ? JSON.parse(texto) : {});
            } catch (_error) {
                rechazar(Object.assign(new Error("El contenido JSON no es válido."), { estado_http: 400 }));
            }
        });

        solicitud.on("error", rechazar);
    });
}

function buscar_captura_activa() {
    return Array.from(capturas.values()).find((captura) =>
        ["esperando_dedo", "procesando"].includes(captura.estado)
    );
}

function preparar_captura_para_respuesta(captura) {
    return {
        id: captura.id,
        operacion: captura.operacion,
        estado: captura.estado,
        modo: "mock",
        usuario_id: captura.usuario_id || "",
        ficha: captura.ficha || "",
        creada_en: captura.creada_en,
        vence_en: captura.vence_en,
        finalizada_en: captura.finalizada_en || null,
        resultado: captura.resultado,
        error: captura.error
    };
}

function programar_limpieza(captura) {
    if (captura.temporizador_limpieza) clearTimeout(captura.temporizador_limpieza);
    captura.temporizador_limpieza = setTimeout(() => capturas.delete(captura.id), RETENCION_CAPTURA_MS);
    if (typeof captura.temporizador_limpieza.unref === "function") captura.temporizador_limpieza.unref();
}

function finalizar_captura(captura) {
    captura.finalizada_en = new Date().toISOString();
    programar_limpieza(captura);
}

function completar_captura(captura, resultado_simulado) {
    if (!capturas.has(captura.id) || captura.estado !== "esperando_dedo") return;

    if (resultado_simulado === "tiempo_agotado") {
        captura.estado = "error";
        captura.error = {
            codigo: "TIEMPO_AGOTADO",
            mensaje: "Se agotó el tiempo de la captura simulada."
        };
        finalizar_captura(captura);
        return;
    }

    if (resultado_simulado === "muestra_invalida") {
        captura.estado = "error";
        captura.error = {
            codigo: "MUESTRA_INVALIDA",
            mensaje: "La muestra simulada fue marcada como inválida."
        };
        finalizar_captura(captura);
        return;
    }

    if (resultado_simulado === "error_lector") {
        captura.estado = "error";
        captura.error = {
            codigo: "LECTOR_NO_DISPONIBLE",
            mensaje: "Se simuló un error de disponibilidad del lector."
        };
        finalizar_captura(captura);
        return;
    }

    captura.estado = "completada";
    if (captura.operacion === "enrolamiento") {
        captura.resultado = { enrolamiento_completado: true, calidad: "simulada", plantilla_biometrica: null };
    } else if (captura.operacion === "identificacion") {
        captura.resultado = {
            coincidencia: resultado_simulado === "coincidencia",
            usuario_id: resultado_simulado === "coincidencia" ? (captura.candidatos[0] || "") : "",
            calidad: "simulada",
            puntaje: null,
            plantilla_biometrica: null
        };
    } else {
        captura.resultado = { coincidencia: resultado_simulado === "coincidencia", calidad: "simulada", puntaje: null, plantilla_biometrica: null };
    }
    finalizar_captura(captura);
}

function programar_resultado(captura, resultado_simulado) {
    const demora = resultado_simulado === "tiempo_agotado"
        ? captura.tiempo_limite_segundos * 1000
        : 250;

    captura.temporizador = setTimeout(() => completar_captura(captura, resultado_simulado), demora);
}

function mostrar_pagina_informativa(respuesta) {
    const pagina = `<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Puente biométrico mock</title>
    <style>
        :root { color-scheme: dark; font-family: system-ui, sans-serif; }
        body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #071a2b; color: #eef7ff; }
        main { width: min(680px, calc(100% - 48px)); padding: 40px; border: 1px solid #2d668d; border-radius: 18px; background: #0d2940; box-shadow: 0 24px 70px #0008; }
        h1 { color: #62d6ff; letter-spacing: .04em; }
        strong { display: block; margin: 24px 0; padding: 16px; border-radius: 10px; background: #ffcb3d; color: #241b00; text-align: center; }
        code { color: #9ee7ff; }
    </style>
</head>
<body>
    <main>
        <h1>Puente biométrico local</h1>
        <strong>MODO BIOMÉTRICO DE PRUEBA</strong>
        <p>El servicio mock está activo en <code>127.0.0.1:${PUERTO_LOCAL}</code>.</p>
        <p>No existe captura biométrica real y no se crean ni guardan plantillas biométricas.</p>
        <p>Estado autenticado: <code>GET /v1/salud</code></p>
    </main>
</body>
</html>`;

    respuesta.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff"
    });
    respuesta.end(pagina);
}

async function atender_solicitud(solicitud, respuesta) {
    const url = new URL(solicitud.url, `http://${DIRECCION_LOCAL}:${PUERTO_LOCAL}`);
    const ruta = url.pathname;

    if (solicitud.method === "GET" && ruta === "/") {
        mostrar_pagina_informativa(respuesta);
        return;
    }

    if (!ruta.startsWith("/v1/")) {
        enviar_error(respuesta, 404, "RUTA_NO_ENCONTRADA", "La ruta solicitada no existe.");
        return;
    }

    if (!solicitud_autorizada(solicitud)) {
        enviar_error(respuesta, 401, "NO_AUTORIZADO", "La clave local no es válida.");
        return;
    }

    if (solicitud.method === "GET" && ruta === "/v1/salud") {
        enviar_json(respuesta, 200, {
            correcto: true,
            servicio: "puente_biometrico",
            version_contrato: VERSION_CONTRATO,
            modo: "mock",
            mensaje: "MODO BIOMÉTRICO DE PRUEBA"
        });
        return;
    }

    if (solicitud.method === "GET" && ruta === "/v1/lector") {
        enviar_json(respuesta, 200, {
            correcto: true,
            version_contrato: VERSION_CONTRATO,
            modo: "mock",
            lector: {
                disponible: true,
                simulado: true,
                hardware_detectado: false,
                modelo: "DigitalPersona U.are.U 4500 simulado",
                estado: buscar_captura_activa() ? "ocupado" : "listo"
            },
            mensaje: "MODO BIOMÉTRICO DE PRUEBA"
        });
        return;
    }

    if (solicitud.method === "POST" && ruta === "/v1/pruebas/siguiente_resultado") {
        const datos = await leer_json(solicitud);
        if (!RESULTADOS_PERMITIDOS.has(datos.resultado)) {
            enviar_error(respuesta, 400, "SOLICITUD_INVALIDA", "El resultado de prueba no es válido.", {
                resultados_permitidos: Array.from(RESULTADOS_PERMITIDOS)
            });
            return;
        }
        siguiente_resultado = datos.resultado;
        enviar_json(respuesta, 200, {
            correcto: true,
            siguiente_resultado,
            mensaje: "El resultado se aplicará solamente a la próxima captura simulada."
        });
        return;
    }

    if (solicitud.method === "POST" && ruta === "/v1/capturas") {
        if (buscar_captura_activa()) {
            enviar_error(respuesta, 409, "CAPTURA_EN_CURSO", "Ya existe una captura simulada en curso.");
            return;
        }

        const datos = await leer_json(solicitud);
        const operacion = String(datos.operacion || "");
        const usuario_id = String(datos.usuario_id || "").trim();
        const ficha = String(datos.ficha || "").trim();
        const candidatos = Array.isArray(datos.candidatos)
            ? datos.candidatos.map((valor) => String(valor || "").trim()).filter(Boolean)
            : [];
        const tiempo_limite_segundos = Number(datos.tiempo_limite_segundos ?? 30);

        if (!["verificacion", "identificacion", "enrolamiento"].includes(operacion)) {
            enviar_error(respuesta, 400, "SOLICITUD_INVALIDA", "Debes indicar una operación biométrica válida.");
            return;
        }
        if (operacion === "identificacion") {
            if (!/^\d+$/.test(ficha) || candidatos.length < 1 || candidatos.length > 1000) {
                enviar_error(respuesta, 400, "SOLICITUD_INVALIDA", "La identificación requiere ficha y candidatos válidos.");
                return;
            }
        } else if (!usuario_id) {
            enviar_error(respuesta, 400, "SOLICITUD_INVALIDA", "Debes indicar usuario_id para esta operación.");
            return;
        }

        if (!Number.isInteger(tiempo_limite_segundos) || tiempo_limite_segundos < 1 || tiempo_limite_segundos > 120) {
            enviar_error(respuesta, 400, "SOLICITUD_INVALIDA", "El tiempo límite debe estar entre 1 y 120 segundos.");
            return;
        }

        const ahora = Date.now();
        const captura = {
            id: `cap_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
            operacion,
            estado: "esperando_dedo",
            usuario_id,
            ficha,
            candidatos,
            tiempo_limite_segundos,
            creada_en: new Date(ahora).toISOString(),
            vence_en: new Date(ahora + tiempo_limite_segundos * 1000).toISOString(),
            finalizada_en: null,
            resultado: null,
            error: null,
            temporizador: null,
            temporizador_limpieza: null
        };

        const resultado_simulado = siguiente_resultado;
        siguiente_resultado = "coincidencia";
        capturas.set(captura.id, captura);
        programar_resultado(captura, resultado_simulado);

        enviar_json(respuesta, 202, {
            correcto: true,
            captura: preparar_captura_para_respuesta(captura),
            mensaje: "Captura de prueba iniciada."
        });
        return;
    }

    const coincidencia_captura = ruta.match(/^\/v1\/capturas\/([a-zA-Z0-9_-]+)$/);
    if (coincidencia_captura) {
        const captura = capturas.get(coincidencia_captura[1]);
        if (!captura) {
            enviar_error(respuesta, 404, "CAPTURA_NO_ENCONTRADA", "La captura solicitada no existe.");
            return;
        }

        if (solicitud.method === "GET") {
            enviar_json(respuesta, 200, {
                correcto: true,
                captura: preparar_captura_para_respuesta(captura),
                mensaje: captura.estado === "esperando_dedo"
                    ? "Esperando una huella simulada."
                    : "Consulta de captura completada."
            });
            return;
        }

        if (solicitud.method === "DELETE") {
            if (captura.temporizador) clearTimeout(captura.temporizador);
            captura.estado = "cancelada";
            captura.resultado = null;
            captura.error = null;
            finalizar_captura(captura);
            enviar_json(respuesta, 200, {
                correcto: true,
                captura: preparar_captura_para_respuesta(captura),
                mensaje: "La captura simulada fue cancelada."
            });
            return;
        }
    }

    enviar_error(respuesta, 404, "RUTA_NO_ENCONTRADA", "La ruta solicitada no existe.");
}

function manejar_error_solicitud(error, respuesta) {
    if (respuesta.headersSent) {
        respuesta.end();
        return;
    }
    const estado_http = Number(error.estado_http) || 500;
    const codigo = estado_http === 500 ? "ERROR_INTERNO" : "SOLICITUD_INVALIDA";
    const mensaje = estado_http === 500
        ? "Ocurrió un error interno en el puente biométrico de prueba."
        : error.message;
    enviar_error(respuesta, estado_http, codigo, mensaje);
}

function iniciar_puente() {
    if (obtener_clave_local().length < 12) {
        throw new Error("CLAVE_LOCAL_PUENTE debe contener al menos 12 caracteres.");
    }

    const servidor = http.createServer((solicitud, respuesta) => {
        atender_solicitud(solicitud, respuesta).catch((error) => {
            console.error("Error al atender una solicitud del puente mock:", error.message);
            manejar_error_solicitud(error, respuesta);
        });
    });

    servidor.on("error", (error) => {
        console.error("No fue posible iniciar el puente biométrico de prueba:", error.message);
        process.exitCode = 1;
    });

    servidor.listen(PUERTO_LOCAL, DIRECCION_LOCAL, () => {
        console.log("MODO BIOMÉTRICO DE PRUEBA");
        console.log(`Puente mock disponible en http://${DIRECCION_LOCAL}:${PUERTO_LOCAL}/`);
        console.log("No se capturan huellas ni se crean plantillas biométricas.");
    });

    return servidor;
}

if (require.main === module) {
    iniciar_puente();
}

module.exports = { iniciar_puente };
