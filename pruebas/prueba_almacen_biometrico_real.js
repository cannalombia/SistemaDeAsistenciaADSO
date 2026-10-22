/*
    Archivo: prueba_almacen_biometrico_real.js

    Propósito:
    Validar que las plantillas reales se cifren, puedan recuperarse y eliminarse
    sin escribir el contenido biométrico en texto plano.
*/
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { crearAlmacenBiometricoReal } = require("../servidor/modulos/almacen_biometrico_real");

const temporal = fs.mkdtempSync(path.join(os.tmpdir(), "sena-bio-real-"));
try {
    const clave = crypto.randomBytes(32).toString("hex");
    const almacen = crearAlmacenBiometricoReal({ directorio: temporal, clave });
    const plantilla = Buffer.from("plantilla-libfprint-prueba-binaria").toString("base64");
    almacen.guardar("aprendiz-1", plantilla, { dedo: "indice_derecho", fecha_registro: "2026-10-17T00:00:00.000Z" });
    assert.equal(almacen.consultar("aprendiz-1").dedo, "indice_derecho");
    assert.equal(almacen.obtenerPlantilla("aprendiz-1"), plantilla);
    const nuevaPlantilla = Buffer.from("plantilla-nueva-de-prueba").toString("base64");
    const anteriorRename = fs.renameSync;
    try {
        fs.renameSync = (origen, destino) => {
            if (destino.endsWith(".bio.json")) {
                const error = new Error("Windows bloqueó el reemplazo");
                error.code = "EPERM";
                throw error;
            }
            return anteriorRename(origen, destino);
        };
        assert.throws(() => almacen.guardar("aprendiz-1", nuevaPlantilla), /Windows bloqueó/);
    } finally { fs.renameSync = anteriorRename; }
    assert.equal(almacen.obtenerPlantilla("aprendiz-1"), plantilla, "Si el reemplazo falla, la plantilla previa permanece intacta");
    assert.equal(fs.readdirSync(temporal).filter((nombre) => nombre.endsWith(".tmp")).length, 0, "No quedan temporales sensibles");
    almacen.guardar("aprendiz-1", nuevaPlantilla);
    assert.equal(almacen.obtenerPlantilla("aprendiz-1"), nuevaPlantilla);
    const contenido = fs.readFileSync(path.join(temporal, fs.readdirSync(temporal)[0]), "utf8");
    assert.doesNotMatch(contenido, /plantilla-libfprint-prueba-binaria/);
    assert.equal(almacen.eliminar("aprendiz-1"), true);
    assert.equal(almacen.consultar("aprendiz-1"), null);
    console.log("OK: almacén biométrico real cifra, recupera y elimina plantillas.");
} finally {
    fs.rmSync(temporal, { recursive: true, force: true });
}
