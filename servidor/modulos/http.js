"use strict";

function sendJson(response, status, value, headers = {}) {
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ...headers
    });
    response.end(JSON.stringify(value));
}

async function readRequestJsonBody(request, maxBytes = 128 * 1024) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        request.on("data", (chunk) => {
            size += chunk.length;
            if (size > maxBytes) {
                reject(Object.assign(new Error("Solicitud demasiado grande."), { status: 413 }));
                request.destroy();
                return;
            }
            chunks.push(chunk);
        });
        request.on("end", () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
            } catch (_error) {
                reject(Object.assign(new Error("El contenido enviado no es válido."), { status: 400 }));
            }
        });
        request.on("error", reject);
    });
}

module.exports = { sendJson, readRequestJsonBody };
