function crearRutasUsuarios(controladores) {
    return async function atenderUsuarios({ request, response, pathname }) {
        if (pathname === "/api/apprentice/me") {
            if (request.method === "GET") await controladores.consultarAprendiz(request, response);
            else if (request.method === "PATCH") await controladores.actualizarAprendiz(request, response);
            else return false;
            return true;
        }

        if (pathname === "/api/users") {
            if (request.method === "GET") await controladores.listar(request, response);
            else if (request.method === "POST") await controladores.crear(request, response);
            else return false;
            return true;
        }

        if (pathname === "/api/users/import" && request.method === "POST") {
            await controladores.importar(request, response);
            return true;
        }

        if (pathname === "/api/users/import-sql" && request.method === "POST") {
            await controladores.importarSql(request, response);
            return true;
        }
        if (pathname === "/api/users/export-sql" && request.method === "GET") {
            await controladores.exportarSql(request, response);
            return true;
        }

        const coincidencia = pathname.match(/^\/api\/users\/([^/]+)$/);
        if (!coincidencia) return false;
        if (request.method === "PATCH") await controladores.actualizar(request, response, coincidencia[1]);
        else if (request.method === "DELETE") await controladores.eliminar(request, response, coincidencia[1]);
        else return false;
        return true;
    };
}

module.exports = { crearRutasUsuarios };
