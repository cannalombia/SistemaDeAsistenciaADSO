/*
    Archivo: estado_biometria_mock.js

    Propósito:
    Conservar únicamente el estado administrativo de enrolamiento simulado.

    Responsabilidad:
    Registrar si un usuario completó una simulación de enrolamiento, permitir
    consultarla y eliminarla de forma atómica.

    Comunicación:
    Es usado exclusivamente por el servidor principal durante BIOMETRIC_MODE=mock.

    Límites:
    No guarda huellas, plantillas, imágenes, muestras ni datos biométricos reales.
*/

"use strict";

const fs = require("fs");
const path = require("path");

function crearEstadoBiometriaMock(opciones = {}) {
    const archivo = opciones.archivo || null;
    const inicial = opciones.inicial && typeof opciones.inicial === "object" ? opciones.inicial : {};
    let registros = { ...inicial };

    if (archivo && fs.existsSync(archivo)) {
        try {
            const contenido = JSON.parse(fs.readFileSync(archivo, "utf8"));
            if (contenido && typeof contenido === "object" && !Array.isArray(contenido)) registros = contenido;
        } catch (_) {
            registros = {};
        }
    }

    function persistir() {
        if (!archivo) return;
        fs.mkdirSync(path.dirname(archivo), { recursive: true });
        const temporal = `${archivo}.tmp`;
        fs.writeFileSync(temporal, `${JSON.stringify(registros, null, 2)}\n`, "utf8");
        fs.renameSync(temporal, archivo);
    }

    function clave(usuario_id) {
        return String(usuario_id || "").trim();
    }

    function consultar(usuario_id) {
        const id = clave(usuario_id);
        const registro = id ? registros[id] : null;
        return registro ? { ...registro } : null;
    }

    function registrar(usuario_id, datos = {}) {
        const id = clave(usuario_id);
        if (!id) throw new Error("usuario_id requerido para estado biométrico mock.");
        registros[id] = {
            estado: "simulado",
            modo: "mock",
            fecha: datos.fecha || new Date().toISOString(),
            registrado_por: String(datos.registrado_por || "")
        };
        persistir();
        return consultar(id);
    }

    function eliminar(usuario_id) {
        const id = clave(usuario_id);
        if (!id || !Object.hasOwn(registros, id)) return false;
        delete registros[id];
        persistir();
        return true;
    }

    return { consultar, registrar, eliminar };
}

module.exports = { crearEstadoBiometriaMock };
