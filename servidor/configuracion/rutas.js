const path = require("path");

const raizProyecto = path.resolve(__dirname, "..", "..");
const datos = path.join(raizProyecto, "datos");
const paginas = path.join(raizProyecto, "aplicacion", "paginas HTML");

const directoriosPublicos = Object.freeze({
    ".html": paginas,
    ".js": path.join(raizProyecto, "aplicacion", "recursos", "JS scripts"),
    ".css": path.join(raizProyecto, "aplicacion", "recursos", "estilos CCS"),
    ".png": path.join(raizProyecto, "aplicacion", "recursos", "imagenes")
});

module.exports = {
    raizProyecto,
    datos,
    paginas,
    directoriosPublicos,
    usuariosCsv: path.join(raizProyecto, "usuarios_listo_para_importar.csv"),
    estructuraSql: path.join(raizProyecto, "base_datos", "estructura_sistema_asistencia.sql")
};
