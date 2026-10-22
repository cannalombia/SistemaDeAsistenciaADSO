/*
    Archivo: prueba_puente_mock.js

    Propósito:
    Este archivo comprueba automáticamente el contrato HTTP del puente mock.

    Responsabilidad:
    Validar la página, la salud, la autenticación, el lector, una captura completa,
    la cancelación y el error simulado por tiempo agotado.

    Comunicación:
    Envía solicitudes HTTP al servicio local en 127.0.0.1:4318.

    Límites:
    No inicia el servicio, no usa el lector y no crea ni valida plantillas biométricas.
*/

"use strict";

const assert = require("node:assert/strict");

const DIRECCION_PUENTE = "http://127.0.0.1:4318";
const clave_local = String(process.env.CLAVE_LOCAL_PUENTE || "");

function esperar(milisegundos) {
    return new Promise((resolver) => setTimeout(resolver, milisegundos));
}

async function solicitar(ruta, opciones = {}, clave = clave_local) {
    const encabezados = {
        Authorization: `Bearer ${clave}`,
        ...(opciones.body ? { "Content-Type": "application/json" } : {}),
        ...(opciones.headers || {})
    };
    const respuesta = await fetch(`${DIRECCION_PUENTE}${ruta}`, { ...opciones, headers: encabezados });
    const tipo = respuesta.headers.get("content-type") || "";
    const contenido = tipo.includes("application/json")
        ? await respuesta.json()
        : await respuesta.text();
    return { estado: respuesta.status, contenido };
}

async function esperar_captura(id, estado_esperado, intentos = 20) {
    for (let intento = 0; intento < intentos; intento += 1) {
        const consulta = await solicitar(`/v1/capturas/${id}`);
        if (consulta.contenido.captura.estado === estado_esperado) return consulta.contenido.captura;
        await esperar(100);
    }
    throw new Error(`La captura ${id} no llegó al estado ${estado_esperado}.`);
}

async function ejecutar_pruebas() {
    assert.ok(clave_local.length >= 12, "CLAVE_LOCAL_PUENTE debe tener al menos 12 caracteres.");

    const pagina = await solicitar("/", {}, "clave-no-utilizada");
    assert.equal(pagina.estado, 200);
    assert.match(pagina.contenido, /MODO BIOMÉTRICO DE PRUEBA/);
    console.log("Correcto: la página informativa responde.");

    const salud = await solicitar("/v1/salud");
    assert.equal(salud.estado, 200);
    assert.equal(salud.contenido.modo, "mock");
    console.log("Correcto: la ruta de salud identifica el modo mock.");

    const acceso_incorrecto = await solicitar("/v1/salud", {}, "clave-incorrecta-para-prueba");
    assert.equal(acceso_incorrecto.estado, 401);
    assert.equal(acceso_incorrecto.contenido.error.codigo, "NO_AUTORIZADO");
    console.log("Correcto: una clave incorrecta recibe 401.");

    const lector = await solicitar("/v1/lector");
    assert.equal(lector.estado, 200);
    assert.equal(lector.contenido.lector.hardware_detectado, false);
    assert.equal(lector.contenido.lector.simulado, true);
    console.log("Correcto: el lector se informa claramente como simulado.");

    await solicitar("/v1/pruebas/siguiente_resultado", {
        method: "POST",
        body: JSON.stringify({ resultado: "coincidencia" })
    });
    const inicio = await solicitar("/v1/capturas", {
        method: "POST",
        body: JSON.stringify({ operacion: "verificacion", usuario_id: "aprendiz_prueba", tiempo_limite_segundos: 2 })
    });
    assert.equal(inicio.estado, 202);
    const captura_completa = await esperar_captura(inicio.contenido.captura.id, "completada");
    assert.equal(captura_completa.resultado.coincidencia, true);
    assert.equal(captura_completa.resultado.plantilla_biometrica, null);
    console.log("Correcto: la captura simulada completó sin crear una plantilla.");

    await solicitar("/v1/pruebas/siguiente_resultado", {
        method: "POST",
        body: JSON.stringify({ resultado: "tiempo_agotado" })
    });
    const inicio_error = await solicitar("/v1/capturas", {
        method: "POST",
        body: JSON.stringify({ operacion: "verificacion", usuario_id: "aprendiz_prueba", tiempo_limite_segundos: 1 })
    });
    const captura_error = await esperar_captura(inicio_error.contenido.captura.id, "error");
    assert.equal(captura_error.error.codigo, "TIEMPO_AGOTADO");
    assert.equal(captura_error.resultado, null);
    console.log("Correcto: el escenario de tiempo agotado fue informado sin datos biométricos.");

    await solicitar("/v1/pruebas/siguiente_resultado", {
        method: "POST",
        body: JSON.stringify({ resultado: "tiempo_agotado" })
    });
    const inicio_cancelacion = await solicitar("/v1/capturas", {
        method: "POST",
        body: JSON.stringify({ operacion: "enrolamiento", usuario_id: "aprendiz_prueba", tiempo_limite_segundos: 10 })
    });
    const cancelacion = await solicitar(`/v1/capturas/${inicio_cancelacion.contenido.captura.id}`, { method: "DELETE" });
    assert.equal(cancelacion.contenido.captura.estado, "cancelada");
    assert.equal(cancelacion.contenido.captura.resultado, null);
    console.log("Correcto: la captura simulada puede cancelarse.");

    console.log("Todas las pruebas del puente biométrico mock terminaron correctamente.");
}

ejecutar_pruebas().catch((error) => {
    console.error("Falló la prueba del puente biométrico mock:", error);
    process.exitCode = 1;
});
