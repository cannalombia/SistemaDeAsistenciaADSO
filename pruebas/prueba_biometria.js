/*
    Archivo: prueba_biometria.js

    Propósito:
    Este archivo valida la integración HTTP entre el servidor principal y un puente
    biométrico de prueba aislado.

    Responsabilidad:
    Comprobar configuración, autenticación, permisos, capturas, cancelación, tiempos
    límite, errores y limpieza de las respuestas entregadas al frontend.

    Comunicación:
    Inicia servidores HTTP temporales que representan al sistema principal y al puente.

    Límites:
    No usa el lector, no registra asistencia y no crea ni guarda plantillas biométricas.
*/

"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const { createProjectServer } = require("../servidor/servidor");

const CLAVE_PUENTE = "clave-puente-prueba-segura";

function esperar(milisegundos) {
    return new Promise((resolver) => setTimeout(resolver, milisegundos));
}

async function leer_cuerpo_json(solicitud) {
    const partes = [];
    for await (const parte of solicitud) partes.push(parte);
    return JSON.parse(Buffer.concat(partes).toString("utf8") || "{}");
}

function enviar_json(respuesta, estado_http, contenido) {
    respuesta.writeHead(estado_http, { "Content-Type": "application/json; charset=utf-8" });
    respuesta.end(JSON.stringify(contenido));
}

async function crear_puente_falso() {
    const estado = {
        demora_respuesta_ms: 0,
        respuesta_invalida: false,
        mantener_captura_pendiente: false,
        capturas_iniciadas: 0,
        ultima_solicitud_captura: null
    };
    const capturas = new Map();

    const servidor = http.createServer(async (solicitud, respuesta) => {
        if (estado.demora_respuesta_ms) await esperar(estado.demora_respuesta_ms);
        if (estado.respuesta_invalida) {
            respuesta.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
            respuesta.end("respuesta no válida");
            return;
        }
        if (solicitud.headers.authorization !== `Bearer ${CLAVE_PUENTE}`) {
            enviar_json(respuesta, 401, {
                correcto: false,
                error: { codigo: "NO_AUTORIZADO", mensaje: "Clave incorrecta." }
            });
            return;
        }

        const url = new URL(solicitud.url, "http://127.0.0.1");
        if (solicitud.method === "GET" && url.pathname === "/v1/salud") {
            enviar_json(respuesta, 200, {
                correcto: true,
                servicio: "puente_biometrico",
                version_contrato: "1.0",
                modo: "mock",
                mensaje: "MODO BIOMÉTRICO DE PRUEBA"
            });
            return;
        }
        if (solicitud.method === "GET" && url.pathname === "/v1/lector") {
            enviar_json(respuesta, 200, {
                correcto: true,
                modo: "mock",
                lector: {
                    disponible: true,
                    simulado: true,
                    hardware_detectado: false,
                    modelo: "DigitalPersona U.are.U 4500 simulado",
                    estado: "listo"
                }
            });
            return;
        }
        if (solicitud.method === "POST" && url.pathname === "/v1/capturas") {
            const cuerpo = await leer_cuerpo_json(solicitud);
            estado.capturas_iniciadas += 1;
            estado.ultima_solicitud_captura = cuerpo;
            const id = `cap_integracion_${estado.capturas_iniciadas}`;
            const captura = {
                id,
                operacion: cuerpo.operacion,
                estado: "esperando_dedo",
                modo: "mock",
                usuario_id: cuerpo.usuario_id,
                creada_en: new Date().toISOString(),
                vence_en: new Date(Date.now() + cuerpo.tiempo_limite_segundos * 1000).toISOString(),
                resultado: null,
                error: null
            };
            capturas.set(id, captura);
            if (!estado.mantener_captura_pendiente) {
                setTimeout(() => {
                    captura.estado = "completada";
                    captura.resultado = cuerpo.operacion === "enrolamiento"
                        ? { enrolamiento_completado: true, calidad: "simulada", plantilla_biometrica: "dato-que-no-debe-salir" }
                        : cuerpo.operacion === "identificacion"
                            ? { coincidencia: true, usuario_id: cuerpo.candidatos?.[0] || "", calidad: "simulada", puntaje: null, plantilla_biometrica: "dato-que-no-debe-salir" }
                            : { coincidencia: true, calidad: "simulada", puntaje: null, plantilla_biometrica: "dato-que-no-debe-salir" };
                }, 15);
            }
            enviar_json(respuesta, 202, { correcto: true, captura, mensaje: "Captura iniciada." });
            return;
        }

        const coincidencia = url.pathname.match(/^\/v1\/capturas\/([a-zA-Z0-9_-]+)$/);
        if (coincidencia) {
            const captura = capturas.get(coincidencia[1]);
            if (!captura) {
                enviar_json(respuesta, 404, {
                    correcto: false,
                    error: { codigo: "CAPTURA_NO_ENCONTRADA", mensaje: "No existe." }
                });
                return;
            }
            if (solicitud.method === "GET") {
                enviar_json(respuesta, 200, { correcto: true, captura });
                return;
            }
            if (solicitud.method === "DELETE") {
                captura.estado = "cancelada";
                captura.resultado = null;
                enviar_json(respuesta, 200, { correcto: true, captura });
                return;
            }
        }
        enviar_json(respuesta, 404, { correcto: false, error: { codigo: "RUTA_NO_ENCONTRADA" } });
    });

    await new Promise((resolver, rechazar) => {
        servidor.once("error", rechazar);
        servidor.listen(0, "127.0.0.1", resolver);
    });
    return {
        servidor,
        estado,
        url: `http://127.0.0.1:${servidor.address().port}`,
        cerrar: () => new Promise((resolver) => servidor.listening ? servidor.close(resolver) : resolver())
    };
}

async function crear_sistema(opciones = {}) {
    const registros_auditoria = [];
    const servidor = createProjectServer({
        adminPassword: "admin-biometria",
        instructorPassword: "instructor-biometria",
        apprentices: [{
            id: "aprendiz-prueba", document: "10000001", name: "Aprendiz Prueba", email: "aprendiz.prueba@gmail.com",
            role: "Aprendiz", status: "Activo", program: { ficha: "3349882", code: "3349882", name: "ADSO" }, attendance: []
        }],
        attendanceRecords: [],
        managedUsers: [{
            id: "aprendiz-prueba", document: "10000001", name: "Aprendiz Prueba", email: "aprendiz.prueba@gmail.com",
            role: "Aprendiz", status: "Activo", ficha: "3349882"
        }],
        csvUsers: [{ identificacion: "10000001", tipo_documento: "Cédula de Ciudadanía", nombre: "Aprendiz Prueba", correo: "aprendiz.prueba@gmail.com", rol: "Aprendiz", estado: "Activo", ficha: "3349882" }],
        auditRecords: registros_auditoria,
        auditFile: null,
        emailSender: async () => ({ id: "correo-prueba-biometria" }),
        publicUrl: "",
        allowedEmails: "",
        allowedDomain: "",
        sqlData: { ambientes: [], horarios: [], programas: [], fichas: [] },
        biometriaHabilitada: opciones.habilitado ?? true,
        biometriaModo: "mock",
        biometriaUrlServicio: opciones.url_puente || "http://127.0.0.1:4318",
        biometriaClaveServicio: opciones.clave_puente ?? CLAVE_PUENTE,
        biometriaTiempoLimiteMs: opciones.tiempo_limite_ms ?? 500
    });
    await new Promise((resolver) => servidor.listen(0, "127.0.0.1", resolver));
    return {
        servidor,
        registros_auditoria,
        url: `http://127.0.0.1:${servidor.address().port}`,
        cerrar: () => new Promise((resolver) => servidor.close(resolver))
    };
}

async function iniciar_sesion(url, identificador, contrasena) {
    const respuesta = await fetch(`${url}/api/auth/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identificador, password: contrasena })
    });
    assert.equal(respuesta.status, 200);
    return respuesta.headers.get("set-cookie").split(";")[0];
}

async function solicitar(url, ruta, cookie, metodo = "GET", cuerpo) {
    const respuesta = await fetch(`${url}${ruta}`, {
        method: metodo,
        headers: {
            Cookie: cookie,
            ...(cuerpo === undefined ? {} : { "Content-Type": "application/json" })
        },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
    });
    return { estado: respuesta.status, datos: await respuesta.json() };
}

async function probar_flujo_principal() {
    const puente = await crear_puente_falso();
    const sistema = await crear_sistema({ url_puente: puente.url });
    try {
        const cookie_admin = await iniciar_sesion(sistema.url, "admin", "admin-biometria");
        const cookie_instructor = await iniciar_sesion(sistema.url, "instructor", "instructor-biometria");

        const estado = await solicitar(sistema.url, "/api/biometria/estado", cookie_instructor);
        assert.equal(estado.estado, 200);
        assert.equal(estado.datos.modo, "mock");
        assert.equal(estado.datos.lector.simulado, true);
        assert.equal(estado.datos.lector.hardware_detectado, false);
        assert.equal(estado.datos.mensaje, "MODO BIOMÉTRICO DE PRUEBA");
        assert.doesNotMatch(JSON.stringify(estado.datos), /127\.0\.0\.1|Authorization|clave-puente/);

        const inicio = await solicitar(sistema.url, "/api/biometria/capturas", cookie_instructor, "POST", {
            operacion: "verificacion",
            usuario_id: "aprendiz-prueba",
            tiempo_limite_segundos: 5
        });
        assert.equal(inicio.estado, 202);
        assert.match(inicio.datos.mensaje, /simulada/i);
        assert.equal(inicio.datos.captura.resultado, null);

        await esperar(30);
        const consulta = await solicitar(sistema.url, `/api/biometria/capturas/${inicio.datos.captura.id}`, cookie_instructor);
        assert.equal(consulta.estado, 200);
        assert.equal(consulta.datos.captura.estado, "completada");
        assert.equal(consulta.datos.captura.resultado.coincidencia, true);
        assert.equal(consulta.datos.captura.resultado.plantilla_biometrica, null);
        assert.doesNotMatch(JSON.stringify(consulta.datos), /dato-que-no-debe-salir/);

        puente.estado.mantener_captura_pendiente = true;
        const para_cancelar = await solicitar(sistema.url, "/api/biometria/capturas", cookie_instructor, "POST", {
            operacion: "identificacion",
            ficha: "3349882",
            tiempo_limite_segundos: 10
        });
        assert.equal(para_cancelar.estado, 202);
        assert.equal(puente.estado.ultima_solicitud_captura.operacion, "identificacion");
        assert.deepEqual(puente.estado.ultima_solicitud_captura.candidatos, ["aprendiz-prueba"]);
        const cancelacion = await solicitar(sistema.url, `/api/biometria/capturas/${para_cancelar.datos.captura.id}`, cookie_admin, "DELETE");
        assert.equal(cancelacion.estado, 200);
        assert.equal(cancelacion.datos.captura.estado, "cancelada");

        const cantidad_antes_rechazo = puente.estado.capturas_iniciadas;
        const enrolamiento_rechazado = await solicitar(sistema.url, "/api/biometria/capturas", cookie_instructor, "POST", {
            operacion: "enrolamiento", consentimiento_confirmado: true,
            usuario_id: "aprendiz-prueba",
            tiempo_limite_segundos: 5
        });
        assert.equal(enrolamiento_rechazado.estado, 403);
        assert.equal(puente.estado.capturas_iniciadas, cantidad_antes_rechazo);

        puente.estado.mantener_captura_pendiente = false;
        const enrolamiento = await solicitar(sistema.url, "/api/biometria/capturas", cookie_admin, "POST", {
            operacion: "enrolamiento", consentimiento_confirmado: true,
            usuario_id: "aprendiz-prueba",
            tiempo_limite_segundos: 5
        });
        assert.equal(enrolamiento.estado, 202);
        await esperar(30);
        const enrolamiento_completo = await solicitar(sistema.url, `/api/biometria/capturas/${enrolamiento.datos.captura.id}`, cookie_admin);
        assert.equal(enrolamiento_completo.estado, 200);
        assert.match(enrolamiento_completo.datos.mensaje, /Enrolamiento simulado completado/);
        assert.equal(enrolamiento_completo.datos.captura.resultado.plantilla_biometrica, null);
        const estado_usuario = await solicitar(sistema.url, "/api/biometria/usuarios/aprendiz-prueba/estado", cookie_admin);
        assert.equal(estado_usuario.estado, 200);
        assert.equal(estado_usuario.datos.enrolado, true);
        const borrar_sin_motivo = await solicitar(sistema.url, "/api/biometria/usuarios/aprendiz-prueba/estado", cookie_admin, "DELETE");
        assert.equal(borrar_sin_motivo.estado, 400);
        assert.equal(borrar_sin_motivo.datos.error.codigo, "MOTIVO_REQUERIDO");
        const borrar_estado = await solicitar(sistema.url, "/api/biometria/usuarios/aprendiz-prueba/estado", cookie_admin, "DELETE", {
            motivo: "Revocación autorizada durante la prueba"
        });
        assert.equal(borrar_estado.estado, 200);
        assert.equal(borrar_estado.datos.enrolado, false);

        const auditoria_texto = JSON.stringify(sistema.registros_auditoria);
        assert.match(auditoria_texto, /BIOMETRIA_CAPTURA_INICIADA/);
        assert.match(auditoria_texto, /BIOMETRIA_CAPTURA_CANCELADA/);
        assert.match(auditoria_texto, /BIOMETRIA_ENROLAMIENTO_SIMULADO/);
        assert.match(auditoria_texto, /BIOMETRIA_ESTADO_SIMULADO_REVOCADO/);
        assert.doesNotMatch(auditoria_texto, /clave-puente|dato-que-no-debe-salir|plantilla_biometrica/);
        console.log("Correcto: estado, lector, captura, consulta, cancelación, permisos y auditoría.");
    } finally {
        await sistema.cerrar();
        await puente.cerrar();
    }
}

async function probar_biometria_deshabilitada() {
    const sistema = await crear_sistema({ habilitado: false });
    try {
        const cookie = await iniciar_sesion(sistema.url, "instructor", "instructor-biometria");
        const respuesta = await solicitar(sistema.url, "/api/biometria/estado", cookie);
        assert.equal(respuesta.estado, 503);
        assert.equal(respuesta.datos.error.codigo, "BIOMETRIA_DESHABILITADA");
        console.log("Correcto: biometría deshabilitada no afecta el inicio del sistema.");
    } finally {
        await sistema.cerrar();
    }
}

async function probar_puente_detenido() {
    const puente = await crear_puente_falso();
    const url_puente = puente.url;
    await puente.cerrar();
    const sistema = await crear_sistema({ url_puente });
    try {
        const cookie = await iniciar_sesion(sistema.url, "instructor", "instructor-biometria");
        const respuesta = await solicitar(sistema.url, "/api/biometria/estado", cookie);
        assert.equal(respuesta.estado, 503);
        assert.equal(respuesta.datos.error.codigo, "PUENTE_NO_DISPONIBLE");
        console.log("Correcto: puente detenido normalizado como PUENTE_NO_DISPONIBLE.");
    } finally {
        await sistema.cerrar();
    }
}

async function probar_clave_incorrecta() {
    const puente = await crear_puente_falso();
    const sistema = await crear_sistema({ url_puente: puente.url, clave_puente: "clave-incorrecta" });
    try {
        const cookie = await iniciar_sesion(sistema.url, "instructor", "instructor-biometria");
        const respuesta = await solicitar(sistema.url, "/api/biometria/estado", cookie);
        assert.equal(respuesta.estado, 502);
        assert.equal(respuesta.datos.error.codigo, "PUENTE_NO_AUTORIZADO");
        assert.doesNotMatch(JSON.stringify(respuesta.datos), /clave-incorrecta/);
        console.log("Correcto: la clave incorrecta se normaliza y nunca se expone.");
    } finally {
        await sistema.cerrar();
        await puente.cerrar();
    }
}

async function probar_tiempo_agotado() {
    const puente = await crear_puente_falso();
    puente.estado.demora_respuesta_ms = 200;
    const sistema = await crear_sistema({ url_puente: puente.url, tiempo_limite_ms: 50 });
    try {
        const cookie = await iniciar_sesion(sistema.url, "instructor", "instructor-biometria");
        const respuesta = await solicitar(sistema.url, "/api/biometria/estado", cookie);
        assert.equal(respuesta.estado, 504);
        assert.equal(respuesta.datos.error.codigo, "TIEMPO_AGOTADO");
        console.log("Correcto: las llamadas al puente tienen tiempo límite.");
    } finally {
        await sistema.cerrar();
        await puente.cerrar();
    }
}

async function probar_respuesta_invalida() {
    const puente = await crear_puente_falso();
    puente.estado.respuesta_invalida = true;
    const sistema = await crear_sistema({ url_puente: puente.url });
    try {
        const cookie = await iniciar_sesion(sistema.url, "instructor", "instructor-biometria");
        const respuesta = await solicitar(sistema.url, "/api/biometria/estado", cookie);
        assert.equal(respuesta.estado, 502);
        assert.equal(respuesta.datos.error.codigo, "ERROR_BIOMETRICO");
        console.log("Correcto: una respuesta inválida del puente no llega al frontend.");
    } finally {
        await sistema.cerrar();
        await puente.cerrar();
    }
}

async function ejecutar() {
    await probar_biometria_deshabilitada();
    await probar_flujo_principal();
    await probar_puente_detenido();
    await probar_clave_incorrecta();
    await probar_tiempo_agotado();
    await probar_respuesta_invalida();
    console.log("OK: integración biométrica mock validada en los doce escenarios solicitados.");
}

ejecutar().catch((error) => {
    console.error("Falló la integración biométrica mock:", error);
    process.exitCode = 1;
});
