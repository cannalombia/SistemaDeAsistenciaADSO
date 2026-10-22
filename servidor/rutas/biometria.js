/*
    Archivo: biometria.js

    Propósito:
    Este archivo define las rutas biométricas expuestas por el servidor principal.

    Responsabilidad:
    Relacionar cada método y dirección HTTP con su controlador correspondiente.

    Comunicación:
    Recibe solicitudes del frontend y delega su atención a los controladores creados
    en servidor.js.

    Límites:
    No conoce la clave ni la URL del puente, no aplica permisos y no registra asistencia.
*/

"use strict";

function esSolicitudLocalBiometria(request) {
    // El túnel HTTP puede entrar por 127.0.0.1, pero conserva Host público.
    // Nunca confiar únicamente en socket.remoteAddress.
    const host = String(request.headers?.host || "").trim();
    const origen = String(request.headers?.origin || "").trim();
    const remota = String(request.socket?.remoteAddress || "");
    const localHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(host);
    const localSocket = /^(?:127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(remota);
    let localOrigen = true;
    if (origen) {
        try {
            const urlOrigen = new URL(origen);
            localOrigen = urlOrigen.protocol === "http:" && urlOrigen.host.toLowerCase() === host.toLowerCase();
        } catch (_) { localOrigen = false; }
    }
    return localHost && localSocket && localOrigen;
}

function crearRutasBiometria(controladores) {
    return async function atenderBiometria({ request, response, pathname }) {
        if (pathname === "/api/biometria" || pathname.startsWith("/api/biometria/")) {
            if (!esSolicitudLocalBiometria(request)) {
                response.writeHead(403, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
                response.end(JSON.stringify({ correcto: false, error: { codigo: "ACCESO_LOCAL_REQUERIDO", mensaje: "Por seguridad, la biometría se administra únicamente desde localhost en el equipo del lector." } }));
                return true;
            }
        }
        if (pathname === "/api/biometria/estado" && request.method === "GET") {
            await controladores.consultarEstado(request, response);
            return true;
        }

        if (pathname === "/api/biometria/resumen" && request.method === "GET") {
            await controladores.consultarResumen(request, response);
            return true;
        }

        if (pathname === "/api/biometria/capturas" && request.method === "POST") {
            await controladores.iniciarCaptura(request, response);
            return true;
        }

        if (pathname === "/api/biometria/asistencia/confirmar" && request.method === "POST") {
            await controladores.confirmarAsistencia(request, response);
            return true;
        }

        const usuario = pathname.match(/^\/api\/biometria\/usuarios\/([a-zA-Z0-9_-]+)\/estado$/);
        if (usuario) {
            if (request.method === "GET") await controladores.consultarEstadoUsuario(request, response, usuario[1]);
            else if (request.method === "DELETE") await controladores.eliminarEstadoUsuario(request, response, usuario[1]);
            else return false;
            return true;
        }

        const captura = pathname.match(/^\/api\/biometria\/capturas\/([a-zA-Z0-9_-]+)$/);
        if (!captura) return false;
        if (request.method === "GET") await controladores.consultarCaptura(request, response, captura[1]);
        else if (request.method === "DELETE") await controladores.cancelarCaptura(request, response, captura[1]);
        else return false;
        return true;
    };
}

module.exports = { crearRutasBiometria, esSolicitudLocalBiometria };
