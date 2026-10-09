const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));
const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};

const crear = read("aplicacion/paginas HTML/crear_usuario.html");
const stats = read("aplicacion/paginas HTML/estadisticas.html");
const usersCss = read("aplicacion/recursos/estilos CCS/estadisticas_usuarios.css");
const statsCss = read("aplicacion/recursos/estilos CCS/estadisticas_reportes.css");
const navCss = read("aplicacion/recursos/estilos CCS/navegacion_aprendiz.css");
const usuariosJs = read("aplicacion/recursos/JS scripts/usuarios.js");
const appJs = read("aplicacion/recursos/JS scripts/aplicacion.js");

const buildId = read("BUILD_ID.txt").trim();
const serverJs = read("servidor/servidor.js");
const supervisor = read("herramientas/automatizacion/asegurar_servidor.ps1");
const launcher = read("ABRIR_PROYECTO.cmd");
assert(buildId === "2026-10-08-dark-theme-instance-v4", "El paquete debe identificar de forma única la versión corregida.");
assert(serverJs.includes('buildIdFile = path.join(root, "BUILD_ID.txt")'), "El servidor debe leer el identificador de build.");
assert(serverJs.includes("            buildId,"), "El health check debe publicar el build activo.");
assert(supervisor.includes('$health.buildId -eq $ExpectedBuildId'), "El supervisor debe rechazar una instancia de otra versión.");
assert(supervisor.includes('Test-CurrentProjectServer'), "El supervisor debe comprobar que el proceso pertenece a la carpeta actual.");
assert(supervisor.includes('otra carpeta/versión'), "El supervisor debe cerrar una copia antigua antes de arrancar la actual.");
assert(launcher.includes('ESTA carpeta y ESTA version'), "El lanzador debe dejar explícita la comprobación de instancia actual.");

const darkThemeCss = read("aplicacion/recursos/estilos CCS/tema_oscuro_modulos_20261008.css");
assert(crear.includes('tema_oscuro_modulos_20261008.css?v=20261008-1930'), "Crear usuario debe cargar el refuerzo oscuro al final de la cascada.");
assert(stats.includes('tema_oscuro_modulos_20261008.css?v=20261008-1930'), "Estadísticas debe cargar el refuerzo oscuro al final de la cascada.");
[
    "body.dark-mode.create-user-page .user-import-panel",
    "body.dark-mode.create-user-page .user-directory-panel",
    "body.dark-mode.create-user-page .user-form-panel",
    "body.dark-mode.create-user-page .user-directory-table td",
    "body.dark-mode.create-user-page .user-form-panel .form-group input",
    "body.dark-mode.statistics-page .dashboard-stat-card",
    "body.dark-mode.statistics-page .dashboard-panel"
].forEach((selector) => assert(darkThemeCss.includes(selector), `Falta refuerzo oscuro final para ${selector}`));
assert(darkThemeCss.includes("!important"), "El refuerzo final debe imponerse sobre reglas claras heredadas.");

assert(crear.includes('id="create-user-dark-mode-hotfix-20261008"'), "Crear usuario debe incluir el hotfix inline final para evitar regresiones por caché/cascada.");
[
    "body.dark-mode.create-user-page .user-sync-status",
    "body.dark-mode.create-user-page .app-notification-button",
    "body.dark-mode.create-user-page .user-import-panel",
    "body.dark-mode.create-user-page .user-directory-table td",
    "body.dark-mode.create-user-page .user-form-panel .form-group input"
].forEach((selector) => assert(crear.includes(selector), `El hotfix inline debe cubrir ${selector}`));
const baseCss = read("aplicacion/recursos/estilos CCS/base.css");
assert(baseCss.includes("NOTIFICACIONES · PARIDAD MODO OSCURO 2026-10-08"), "Las notificaciones deben tener paridad global de modo oscuro.");
assert(baseCss.includes("body.dark-mode .app-notification-button"), "La campana debe adoptar el tema oscuro.");
assert(baseCss.includes("body.dark-mode .notification-entry"), "El diálogo/listado de notificaciones debe adoptar el tema oscuro.");
assert(usuariosJs.includes('new Date().toLocaleString("es-CO")'), "La fecha/hora de actualización debe seguir generándose en usuarios.js.");
assert(appJs.includes('fetch("/api/notifications"'), "La carga funcional de notificaciones debe conservarse.");

assert(crear.includes('localStorage.getItem("sena-dark-mode")'), "Crear usuario debe aplicar el tema guardado antes de pintar la vista.");
assert(usersCss.includes("CREATE USER DARK MODE 2026-10-08"), "Falta la cobertura integral de modo oscuro para Crear usuario.");
[
    ".user-directory-panel",
    ".user-form-panel",
    ".user-import-panel",
    ".user-directory-table td",
    ".user-directory-search",
    ".user-form-panel .form-group input",
    ".user-form-panel .form-group select"
].forEach((selector) => assert(usersCss.includes(selector), `Falta regla de tema oscuro para ${selector}`));

assert(statsCss.includes("KPI ESTADISTICAS = TARJETAS CREAR USUARIO 2026-10-08"), "Falta la unificación visual de indicadores de Estadísticas.");
assert((stats.match(/dashboard-stat-card/g) || []).length >= 3, "Estadísticas debe conservar sus tres indicadores funcionales.");
assert(stats.includes('dashboard-stat-card stat-green'), "El primer indicador debe conservar acento verde.");
assert(stats.includes('dashboard-stat-card stat-blue'), "El segundo indicador debe usar el acento azul del sistema visual de Crear usuario.");
assert(stats.includes('dashboard-stat-card stat-purple'), "El tercer indicador debe usar el acento violeta del sistema visual de Crear usuario.");
assert(statsCss.includes("grid-template-columns:58px minmax(0,1fr)"), "Los KPI deben usar la misma estructura icono/contenido que Crear usuario.");
assert(statsCss.includes("border-radius:20px"), "Los KPI deben conservar el radio volumétrico del diseño de Crear usuario.");
assert(statsCss.includes("background:linear-gradient(145deg,#eef0f3,#e5e7eb)"), "Los KPI deben conservar la superficie neumórfica clara.");
assert(statsCss.includes("body.dark-mode.statistics-page .dashboard-stat-card"), "Los KPI deben tener paridad de modo oscuro.");

assert(navCss.includes('url("sidebar_campus_20261008.png")'), "La barra lateral debe conservar la imagen del campus a la izquierda.");
assert(exists("aplicacion/recursos/imagenes/sidebar_campus_20261008.png"), "Falta el recurso local del campus usado por la barra lateral.");

console.log("OK: tema oscuro integral verificado en Crear usuario, fecha/hora, notificaciones, tarjetas, importación, directorio, formulario y sidebar.");
