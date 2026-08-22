const path = require("path");

const raizProyecto = path.resolve(__dirname, "..", "..");
const datos = path.join(raizProyecto, "datos");
const paginas = path.join(raizProyecto, "aplicacion", "paginas");

const directoriosPublicos = Object.freeze({
    ".html": paginas,
    ".js": path.join(raizProyecto, "aplicacion", "recursos", "scripts"),
    ".css": path.join(raizProyecto, "aplicacion", "recursos", "estilos"),
    ".png": path.join(raizProyecto, "aplicacion", "recursos", "imagenes")
});

module.exports = {
    raizProyecto,
    datos,
    paginas,
    directoriosPublicos,
    usuariosCsv: path.join(datos, "importaciones", "usuarios_activos.csv"),
    estructuraSql: path.join(raizProyecto, "base_datos", "estructura_sistema_asistencia.sql")
};
