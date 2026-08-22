const { crearRutasAcceso } = require("./acceso");
const { crearRutasUsuarios } = require("./usuarios");
const { crearRutasFormacion } = require("./formacion");
const { crearRutasSistema } = require("./sistema");

function crearEnrutadorApi(controladores) {
    const grupos = [
        crearRutasAcceso(controladores.acceso),
        crearRutasUsuarios(controladores.usuarios),
        crearRutasFormacion(controladores.formacion),
        crearRutasSistema(controladores.sistema)
    ];

    return async function atenderApi(contexto) {
        for (const atender of grupos) {
            if (await atender(contexto)) return true;
        }
        return false;
    };
}

module.exports = { crearEnrutadorApi };
