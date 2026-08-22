function crearRutasFormacion(controladores) {
    return async function atenderFormacion({ request, response, requestUrl, pathname }) {
        if (pathname === "/api/programs") {
            if (request.method === "GET") await controladores.listarProgramas(request, response);
            else if (request.method === "POST") await controladores.crearPrograma(request, response);
            else return false;
            return true;
        }

        const programa = pathname.match(/^\/api\/programs\/(\d+)$/);
        if (programa && request.method === "PATCH") {
            await controladores.actualizarPrograma(request, response, programa[1]);
            return true;
        }

        if (pathname === "/api/attendance") {
            if (request.method === "GET") await controladores.consultarAsistencia(request, response, requestUrl);
            else if (request.method === "POST") await controladores.guardarAsistencia(request, response);
            else return false;
            return true;
        }

        if (pathname === "/api/statistics" && request.method === "GET") {
            await controladores.consultarEstadisticas(request, response, requestUrl);
            return true;
        }
        return false;
    };
}

module.exports = { crearRutasFormacion };
