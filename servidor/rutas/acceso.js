function crearRutasAcceso(controladores) {
    const rutas = new Map([
        ["POST /api/auth/password", controladores.iniciarConContrasena],
        ["POST /api/auth/email/request", controladores.solicitarCodigo],
        ["POST /api/auth/email/verify", controladores.verificarCodigo],
        ["GET /api/auth/email/status", controladores.estadoCorreo],
        ["GET /api/auth/email/history", controladores.historialCorreo],
        ["GET /api/auth/session", controladores.consultarSesion],
        ["POST /api/auth/logout", controladores.cerrarSesion]
    ]);

    return async function atenderAcceso({ request, response, pathname }) {
        const controlador = rutas.get(`${request.method} ${pathname}`);
        if (!controlador) return false;
        await controlador(request, response);
        return true;
    };
}

module.exports = { crearRutasAcceso };
