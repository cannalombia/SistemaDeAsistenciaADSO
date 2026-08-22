function crearRutasSistema(controladores) {
    return async function atenderSistema({ request, response, pathname }) {
        if (pathname !== "/api/health" || request.method !== "GET") return false;
        await controladores.consultarEstado(request, response);
        return true;
    };
}

module.exports = { crearRutasSistema };
