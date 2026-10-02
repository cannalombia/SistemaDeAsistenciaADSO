"use strict";

const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const { sendJson, readRequestJsonBody } = require("../servidor/modulos/http");

function requestFrom(chunks) {
    return Readable.from(chunks.map((chunk) => Buffer.from(chunk)));
}

async function main() {
    const response = {
        writeHead(status, headers) {
            this.status = status;
            this.headers = headers;
        },
        end(body) {
            this.body = body;
        }
    };

    sendJson(response, 201, { created: true }, { "X-Test": "http" });
    assert.equal(response.status, 201);
    assert.equal(response.headers["Content-Type"], "application/json; charset=utf-8");
    assert.equal(response.headers["Cache-Control"], "no-store");
    assert.equal(response.headers["X-Test"], "http");
    assert.deepEqual(JSON.parse(response.body), { created: true });

    assert.deepEqual(
        await readRequestJsonBody(requestFrom(['{"nombre":"María"}'])),
        { nombre: "María" }
    );
    assert.deepEqual(await readRequestJsonBody(requestFrom([])), {});

    await assert.rejects(
        readRequestJsonBody(requestFrom(["{"])),
        (error) => error.status === 400 && error.message === "El contenido enviado no es válido."
    );
    await assert.rejects(
        readRequestJsonBody(requestFrom(["12345"]), 4),
        (error) => error.status === 413 && error.message === "Solicitud demasiado grande."
    );

    console.log("OK: respuestas JSON y lectura segura del cuerpo HTTP validadas.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
