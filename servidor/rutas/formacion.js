function crearRutasFormacion(controladores) {
    return async function atenderFormacion({ request, response, requestUrl, pathname }) {
        if (pathname === "/api/training" && request.method === "GET") {
            await controladores.consultarFormacion(request, response);
            return true;
        }
        for (const [segmento, listar, crear, actualizar, eliminar] of [
            ["fichas", controladores.listarFichas, controladores.crearFicha, controladores.actualizarFicha, controladores.eliminarFicha],
            ["schedules", controladores.listarHorarios, controladores.crearHorario, controladores.actualizarHorario, controladores.eliminarHorario],
            ["environments", controladores.listarAmbientes, controladores.crearAmbiente, controladores.actualizarAmbiente, controladores.eliminarAmbiente]
        ]) {
            if (pathname === `/api/${segmento}`) {
                if (request.method === "GET") await listar(request, response);
                else if (request.method === "POST") await crear(request, response);
                else return false;
                return true;
            }
            const item = pathname.match(new RegExp(`^/api/${segmento}/([^/]+)$`));
            if (item && ["PATCH", "DELETE"].includes(request.method)) {
                await (request.method === "PATCH" ? actualizar : eliminar)(request, response, item[1]);
                return true;
            }
        }
        if (pathname === "/api/attendance/qr" && request.method === "POST") {
            await controladores.generarQr(request, response);
            return true;
        }
        if (pathname === "/api/attendance/qr/register" && request.method === "POST") {
            await controladores.registrarQr(request, response);
            return true;
        }
        if (pathname === "/api/attendance/close" && request.method === "POST") {
            await controladores.cerrarAsistencia(request, response);
            return true;
        }
        if (pathname === "/api/attendance/reopen" && request.method === "POST") {
            await controladores.reabrirAsistencia(request, response);
            return true;
        }
        if (pathname === "/api/excuses") {
            if (request.method === "GET") await controladores.listarExcusas(request, response, requestUrl);
            else if (request.method === "POST") await controladores.crearExcusa(request, response);
            else return false;
            return true;
        }
        const excuseSupport = pathname.match(/^\/api\/excuses\/([a-f0-9-]+)\/support$/);
        if (excuseSupport && request.method === "GET") {
            await controladores.consultarSoporteExcusa(request, response, excuseSupport[1]);
            return true;
        }
        const excuse = pathname.match(/^\/api\/excuses\/([a-f0-9-]+)$/);
        if (excuse && request.method === "PATCH") {
            await controladores.revisarExcusa(request, response, excuse[1]);
            return true;
        }
        if (pathname === "/api/reports" && ["GET", "POST"].includes(request.method)) {
            await controladores.reportes(request, response, requestUrl);
            return true;
        }
        const reporte = pathname.match(/^\/api\/reports\/([a-f0-9-]+)(\/pdf)?$/);
        if (reporte && request.method === "GET") {
            await controladores.consultarReporte(request, response, reporte[1], Boolean(reporte[2]));
            return true;
        }
        if (pathname === "/api/programs") {
            if (request.method === "GET") await controladores.listarProgramas(request, response);
            else if (request.method === "POST") await controladores.crearPrograma(request, response);
            else return false;
            return true;
        }

        const programa = pathname.match(/^\/api\/programs\/(\d+)$/);
        if (programa && ["PATCH", "DELETE"].includes(request.method)) {
            await (request.method === "PATCH" ? controladores.actualizarPrograma : controladores.eliminarPrograma)(request, response, programa[1]);
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
