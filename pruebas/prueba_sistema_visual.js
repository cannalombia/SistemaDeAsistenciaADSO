const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};

const stylesDir = path.join(root, "aplicacion", "recursos", "estilos CCS");
const visualFile = "sistema_visual.css";
assert(fs.existsSync(path.join(stylesDir, visualFile)), "Falta sistema_visual.css");
assert(visualFile === visualFile.toLowerCase(), "El CSS compartido debe conservar nombre en minúscula");

const entryCss = read("aplicacion/recursos/estilos CCS/estilos_generales.css");
assert(entryCss.includes('@import url("sistema_visual.css");'), "estilos_generales.css debe importar el sistema visual compartido");

const visualCss = read("aplicacion/recursos/estilos CCS/sistema_visual.css");
for (const token of ["--ui-primary", "--ui-space-4", "--ui-radius-md", "--ui-shadow-sm", "--ui-control-height"]) {
    assert(visualCss.includes(token), `Falta token visual ${token}`);
}
for (const selector of [".ui-state", ".ui-badge", ".ui-table-scroll", ":focus-visible", "body.dark-mode.ui-v72"]) {
    assert(visualCss.includes(selector), `Falta componente o regla compartida ${selector}`);
}

const pageClasses = new Map([
    ["fichas.html", "fichas-page"],
    ["horario.html", "schedule-page"],
    ["ambiente.html", "environment-page"],
    ["programa_formacion.html", "programas-page ui-v72"],
    ["ajustes.html", "settings-page ui-v72"],
    ["asistencia.html", "attendance-page ui-v72"],
    ["aprendiz.html", "apprentice-portal ui-v72"],
    ["login.html", "ui-v72 access-page"],
    ["asistencia_qr.html", "ui-v72 qr-result-page"]
]);
for (const [file, expected] of pageClasses) {
    const html = read(`aplicacion/paginas HTML/${file}`);
    for (const className of expected.split(/\s+/)) {
        assert(html.includes(className), `${file}: falta clase visual ${className}`);
    }
}

const accessCss = read("aplicacion/recursos/estilos CCS/estilos_acceso.css");
assert(accessCss.includes('@import url("sistema_visual.css");'), "Login debe reutilizar el mismo sistema visual");
assert(accessCss.includes("max-height:820px"), "Login debe incluir el ajuste para portátiles a 100% de zoom");
assert(accessCss.includes("height:min(100dvh - 16px,720px)"), "La imagen de acceso debe respetar la altura visible");
assert(visualCss.includes("DENSIDAD RESPONSIVA DE ESCRITORIO"), "Las vistas internas deben incluir densidad responsiva de escritorio");
assert(visualCss.includes("body:is(.ui-v72,.create-user-page,.statistics-page):not(.access-page)"), "La densidad compacta debe cubrir todas las vistas internas");


const themeInitPath = path.join(root, "aplicacion", "recursos", "JS scripts", "tema_inicial.js");
assert(fs.existsSync(themeInitPath), "Falta tema_inicial.js para aplicar el tema antes del contenido visible");
const themeInit = fs.readFileSync(themeInitPath, "utf8");
assert(themeInit.includes('localStorage.getItem("sena-dark-mode")'), "tema_inicial.js debe reutilizar sena-dark-mode");
assert(themeInit.includes('classList.toggle("dark-mode"'), "tema_inicial.js debe conservar la clase dark-mode existente");

for (const file of ["ajustes.html","ambiente.html","aprendiz.html","asistencia.html","asistencia_qr.html","crear_usuario.html","estadisticas.html","fichas.html","horario.html","index.html","login.html","programa_formacion.html"]) {
    const html = read(`aplicacion/paginas HTML/${file}`);
    const bodyAt = html.search(/<body\b/i);
    const initAt = html.indexOf('<script src="tema_inicial.js"></script>');
    assert(initAt > bodyAt && initAt - bodyAt < 220, `${file}: tema_inicial.js debe cargarse al inicio del body`);
}
const qrFinalHtml = read("aplicacion/paginas HTML/asistencia_qr.html");
assert(qrFinalHtml.includes('tema_inicial.js'), "asistencia_qr.html debe aplicar el tema visual compartido tras la autorización D7");
assert(qrFinalHtml.includes('qr-result-card'), "asistencia_qr.html debe usar la tarjeta visual final de QR");
assert(!qrFinalHtml.includes('style="max-width:540px;margin:40px auto;padding:24px"'), "asistencia_qr.html no debe conservar el estilo inline anterior");

for (const selector of ["body.dark-mode.ui-v72.access-page", ".dialog-danger-action", ".table-crud-actions", ".qr-result-card", "prefers-reduced-motion"]) {
    assert(visualCss.includes(selector), `Falta cobertura visual compartida ${selector}`);
}

console.log("OK: sistema visual compartido, tema inicial, responsive y accesibilidad base.");
