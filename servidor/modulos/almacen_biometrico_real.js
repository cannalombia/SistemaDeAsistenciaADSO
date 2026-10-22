/*
    Archivo: almacen_biometrico_real.js

    Propósito:
    Guardar plantillas biométricas reales cifradas fuera de los datos públicos.

    Responsabilidad:
    - Cifrar y descifrar plantillas libfprint con AES-256-GCM.
    - Asociar cada plantilla únicamente con su usuario.
    - Consultar, reemplazar y eliminar enrolamientos reales.

    Comunicación:
    Lo utiliza servidor.js. Las plantillas descifradas solo se entregan al cliente
    biométrico interno para una operación local contra el puente.

    Límites:
    No atiende HTTP, no captura huellas y nunca guarda imágenes.
*/

"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function normalizar_clave(valor) {
    const texto = String(valor || "").trim();
    if (!texto) throw new Error("Falta BIOMETRIC_ENCRYPTION_KEY.");

    if (/^[0-9a-f]{64}$/i.test(texto)) return Buffer.from(texto, "hex");
    try {
        const base64 = Buffer.from(texto, "base64");
        if (base64.length === 32 && base64.toString("base64").replace(/=+$/, "") === texto.replace(/=+$/, "")) return base64;
    } catch (_error) {}
    throw new Error("BIOMETRIC_ENCRYPTION_KEY debe contener exactamente 32 bytes en hex (64 caracteres) o Base64.");
}

function nombre_archivo(usuario_id) {
    return `${crypto.createHash("sha256").update(String(usuario_id)).digest("hex")}.bio.json`;
}

function crearAlmacenBiometricoReal({ directorio, clave }) {
    const clave_binaria = normalizar_clave(clave);
    const raiz = path.resolve(directorio);
    fs.mkdirSync(raiz, { recursive: true, mode: 0o700 });

    function ruta(usuario_id) {
        return path.join(raiz, nombre_archivo(usuario_id));
    }

    function guardar(usuario_id, plantilla_base64, metadatos = {}) {
        const id = String(usuario_id || "").trim();
        const plantilla = String(plantilla_base64 || "").trim();
        if (!id || !plantilla) throw new Error("Usuario y plantilla son obligatorios.");
        const datos = Buffer.from(plantilla, "base64");
        if (!datos.length) throw new Error("La plantilla biométrica está vacía.");

        const iv = crypto.randomBytes(12);
        const cifrador = crypto.createCipheriv("aes-256-gcm", clave_binaria, iv);
        cifrador.setAAD(Buffer.from(`biometria:${id}:v1`, "utf8"));
        const cifrado = Buffer.concat([cifrador.update(datos), cifrador.final()]);
        const etiqueta = cifrador.getAuthTag();
        const registro = {
            version: 1,
            algoritmo: "AES-256-GCM",
            usuario_hash: crypto.createHash("sha256").update(id).digest("hex"),
            iv: iv.toString("base64"),
            etiqueta: etiqueta.toString("base64"),
            datos: cifrado.toString("base64"),
            dedo: String(metadatos.dedo || "indice_derecho"),
            fecha_registro: metadatos.fecha_registro || new Date().toISOString()
        };
        const destino = ruta(id);
        const temporal = `${destino}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
        // Escribir completamente y sincronizar antes de reemplazar el destino.
        // Si Windows/antivirus bloquea el rename, se devuelve un error sin
        // sobrescribir parcialmente la plantilla anterior.
        let descriptor;
        try {
            descriptor = fs.openSync(temporal, "wx", 0o600);
            fs.writeFileSync(descriptor, JSON.stringify(registro, null, 2), "utf8");
            fs.fsyncSync(descriptor);
            fs.closeSync(descriptor);
            descriptor = null;
            fs.renameSync(temporal, destino);
        } catch (error) {
            if (descriptor !== null && descriptor !== undefined) {
                try { fs.closeSync(descriptor); } catch (_) {}
            }
            try { fs.unlinkSync(temporal); } catch (_) {}
            throw error;
        }
        return { dedo: registro.dedo, fecha_registro: registro.fecha_registro };
    }

    function consultar(usuario_id) {
        const id = String(usuario_id || "").trim();
        const archivo = ruta(id);
        if (!id || !fs.existsSync(archivo)) return null;
        const registro = JSON.parse(fs.readFileSync(archivo, "utf8"));
        return {
            dedo: String(registro.dedo || "indice_derecho"),
            fecha_registro: registro.fecha_registro || null
        };
    }

    function obtenerPlantilla(usuario_id) {
        const id = String(usuario_id || "").trim();
        const archivo = ruta(id);
        if (!id || !fs.existsSync(archivo)) return null;
        const registro = JSON.parse(fs.readFileSync(archivo, "utf8"));
        const iv = Buffer.from(registro.iv, "base64");
        const etiqueta = Buffer.from(registro.etiqueta, "base64");
        const cifrado = Buffer.from(registro.datos, "base64");
        const descifrador = crypto.createDecipheriv("aes-256-gcm", clave_binaria, iv);
        descifrador.setAAD(Buffer.from(`biometria:${id}:v1`, "utf8"));
        descifrador.setAuthTag(etiqueta);
        const plano = Buffer.concat([descifrador.update(cifrado), descifrador.final()]);
        return plano.toString("base64");
    }

    function eliminar(usuario_id) {
        const archivo = ruta(String(usuario_id || "").trim());
        if (!fs.existsSync(archivo)) return false;
        fs.unlinkSync(archivo);
        return true;
    }

    return { guardar, consultar, obtenerPlantilla, eliminar, directorio: raiz };
}

module.exports = { crearAlmacenBiometricoReal, normalizar_clave };
