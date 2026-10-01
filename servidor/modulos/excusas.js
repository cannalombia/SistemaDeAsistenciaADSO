const Busboy = require("busboy");
const crypto = require("crypto");
const path = require("path");

const MAX_EXCUSE_BYTES = 5 * 1024 * 1024;
const TYPES = new Map([
    [".pdf", "application/pdf"],
    [".png", "image/png"],
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"]
]);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

function hasValidSignature(buffer, type) {
    if (type === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    if (type === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (type === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    return false;
}

function readExcuseSubmission(request) {
    return new Promise((resolve, reject) => {
        let parser;
        try { parser = Busboy({ headers: request.headers, limits: { fileSize: MAX_EXCUSE_BYTES + 1, files: 1, fields: 4, parts: 5, fieldSize: 1000 } }); }
        catch (_) { reject(fail("Envía la excusa mediante multipart/form-data.")); return; }
        const fields = {};
        let support = null;
        let error = null;
        const bad = (message, status) => { error ||= fail(message, status); };
        parser.on("field", (name, value) => {
            if (!["fecha", "ficha", "motivo"].includes(name)) return bad("La solicitud contiene campos no permitidos.");
            fields[name] = String(value || "").trim();
        });
        parser.on("file", (name, stream, info) => {
            const extension = path.extname(info.filename || "").toLowerCase();
            const expectedType = TYPES.get(extension);
            if (name !== "SOPORTE" || !expectedType || expectedType !== info.mimeType) bad("Adjunta un único soporte PDF, JPG o PNG válido.");
            const chunks = [];
            stream.on("limit", () => bad("El soporte supera el máximo de 5 MB.", 413));
            stream.on("data", (chunk) => chunks.push(chunk));
            stream.on("error", reject);
            stream.on("end", () => {
                const buffer = Buffer.concat(chunks);
                if (!buffer.length || !hasValidSignature(buffer, expectedType)) return bad("La firma del archivo no coincide con un PDF, JPG o PNG válido.");
                support = {
                    name: path.basename(info.filename).replace(/[^a-zA-Z0-9._() -]/g, "_").slice(0, 120),
                    mimeType: expectedType,
                    size: buffer.length,
                    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
                    dataBase64: buffer.toString("base64")
                };
            });
        });
        for (const event of ["filesLimit", "fieldsLimit", "partsLimit"]) parser.on(event, () => bad("La solicitud de excusa supera los límites permitidos."));
        parser.on("error", () => reject(fail("La carga de la excusa está incompleta o mal formada.")));
        parser.on("close", () => {
            if (error) return reject(error);
            if (!support) return reject(fail("Debes adjuntar el soporte de la excusa."));
            resolve({ ...fields, support });
        });
        request.pipe(parser);
    });
}

module.exports = { readExcuseSubmission, MAX_EXCUSE_BYTES };
