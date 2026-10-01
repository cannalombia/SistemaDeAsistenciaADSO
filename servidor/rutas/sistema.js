function crearRutasSistema(controladores) {
    return async function atenderSistema({ request, response, requestUrl, pathname }) {
        if (pathname === "/api/restore" && request.method === "POST") {
            await controladores.restaurarRespaldo(request, response);
            return true;
        }
        if (request.method !== "GET") return false;
        if (pathname === "/api/health") await controladores.consultarEstado(request, response);
        else if (pathname === "/api/audit") await controladores.consultarAuditoria(request, response, requestUrl);
        else if (pathname === "/api/notifications") await controladores.consultarNotificaciones(request, response);
        else if (pathname === "/api/backup") await controladores.exportarRespaldo(request, response);
        else return false;
        return true;
    };
}

module.exports = { crearRutasSistema };
