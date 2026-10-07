const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { createProjectServer, loadCsvUsers } = require("../servidor/servidor");

const projectRoot = path.resolve(__dirname, "..");
const root = path.join(projectRoot, "aplicacion", "paginas HTML");
const scriptsRoot = path.join(projectRoot, "aplicacion", "recursos", "JS scripts");
const stylesRoot = path.join(projectRoot, "aplicacion", "recursos", "estilos CCS");
const imagesRoot = path.join(projectRoot, "aplicacion", "recursos", "imagenes");
const videosRoot = path.join(projectRoot, "aplicacion", "recursos", "video");
const serverFile = path.join(projectRoot, "servidor", "servidor.js");
const emailModuleFile = path.join(projectRoot, "servidor", "modulos", "correo.js");
const apiRoutesRoot = path.join(projectRoot, "servidor", "rutas");
const automationRoot = path.join(projectRoot, "herramientas", "automatizacion");
const htmlFiles = fs.readdirSync(root).filter((name) => name.endsWith(".html")).sort();
const failures = [];

for (const publicDocument of ["README.md", "Estructura.txt"]) {
    const content = fs.readFileSync(path.join(projectRoot, publicDocument), "utf8");
    check(!/^(?:usuario|clave|contraseña)\s*:\s*\S+/im.test(content), `${publicDocument}: contiene una credencial escrita en texto visible`);
}

function publicFile(file) {
    const directories = {
        ".html": root,
        ".js": scriptsRoot,
        ".css": stylesRoot,
        ".png": imagesRoot,
        ".mp4": videosRoot
    };
    const directory = directories[path.extname(file).toLowerCase()];
    return directory && path.basename(file) === file ? path.join(directory, file) : "";
}

function check(condition, message) {
    if (!condition) failures.push(message);
}

function occurrences(text, pattern) {
    return (text.match(pattern) || []).length;
}

for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    check(/^<!DOCTYPE html>/i.test(html.trim()), `${file}: falta DOCTYPE`);
    check(occurrences(html, /<html\b/gi) === 1, `${file}: debe contener una sola etiqueta <html>`);
    check(occurrences(html, /<\/html>/gi) === 1, `${file}: debe contener un solo cierre </html>`);
    check(occurrences(html, /<body\b/gi) === 1, `${file}: debe contener una sola etiqueta <body>`);
    check(occurrences(html, /<\/body>/gi) === 1, `${file}: debe contener un solo cierre </body>`);
    check(html.indexOf("</body>") < html.indexOf("</html>"), `${file}: el cierre de body debe ir antes de html`);

    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/gi)) {
        const target = match[1];
        if (/^(?:https?:|#|data:|mailto:|tel:)/i.test(target)) continue;
        const localPath = target.split(/[?#]/)[0];
        check(Boolean(publicFile(localPath)) && fs.existsSync(publicFile(localPath)), `${file}: no existe el recurso ${localPath}`);
    }

    for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
            new vm.Script(match[1], { filename: `${file}:script` });
        } catch (error) {
            failures.push(`${file}: JavaScript interno inválido: ${error.message}`);
        }
    }

    // El receptor QR comprueba la sesión en su script y no muestra datos privados.
    if (!["login.html", "asistencia_qr.html"].includes(file)) {
        check(html.includes('src="autenticacion.js"'), `${file}: falta la protección de autenticación`);
        check(html.includes('src="aplicacion.js"'), `${file}: falta el comportamiento de la aplicación`);
        check(html.includes("auth-pending"), `${file}: puede mostrar contenido antes de autenticar`);
        check(html.includes("data-navegacion-principal"), `${file}: falta el componente de navegación compartida`);
    }
}

for (const file of fs.readdirSync(scriptsRoot).filter((name) => name.endsWith(".js"))) {
    try {
        new vm.Script(fs.readFileSync(path.join(scriptsRoot, file), "utf8"), { filename: file });
    } catch (error) {
        failures.push(`${file}: ${error.message}`);
    }
}
try {
    new vm.Script(fs.readFileSync(serverFile, "utf8"), { filename: "servidor.js" });
} catch (error) {
    failures.push(`servidor.js: ${error.message}`);
}

const login = fs.readFileSync(path.join(root, "login.html"), "utf8");
const appSource = ["aplicacion.js", "asistencia.js", "estadisticas.js", "programas.js", "usuarios.js"]
    .map((file) => fs.readFileSync(path.join(scriptsRoot, file), "utf8"))
    .join("\n");
const authSource = fs.readFileSync(path.join(scriptsRoot, "autenticacion.js"), "utf8");
const navigationSource = fs.readFileSync(path.join(scriptsRoot, "navegacion.js"), "utf8");
const crudSource = fs.readFileSync(path.join(scriptsRoot, "usuarios.js"), "utf8");
const operationalApprentices = path.join(projectRoot, "datos", "aprendices.json");
const sampleApprentices = path.join(projectRoot, "datos", "ejemplos", "aprendices.ejemplo.json");
const operationalUsers = require("../servidor/configuracion/rutas").usuariosCsv;
const sampleUsers = path.join(projectRoot, "datos", "ejemplos", "usuarios_activos.ejemplo.csv");
const usesOperationalData = fs.existsSync(operationalApprentices) && fs.existsSync(operationalUsers);
const apprenticeData = JSON.parse(fs.readFileSync(usesOperationalData ? operationalApprentices : sampleApprentices, "utf8"));
const csvUsers = loadCsvUsers(usesOperationalData ? operationalUsers : sampleUsers);
check(login.includes('id="staff-login-form"'), "login.html: falta formulario de administrador e instructor");
check(login.includes('data-auth-tab="staff"'), "login.html: falta la pestaña Admin / Instructor");
check(login.includes('data-auth-tab="apprentice"'), "login.html: falta la pestaña Aprendiz");
check(authSource.includes('window.location.replace(destinationFor(serverUser, requestedDestination()))'), "auth.js: una sesión activa debe salir automáticamente del login");
check(authSource.includes('window.location.replace(destinationFor(result.user, requestedDestination()))'), "auth.js: el código verificado debe dirigir según el rol del usuario");
check(authSource.includes('const LOCAL_APP_ORIGIN = "http://localhost:3000"'), "auth.js: falta asegurar el servidor local correcto");
check(authSource.includes('[404, 405].includes(response.status)'), "auth.js: falta detectar servidores que rechazan la API");
if (usesOperationalData) {
    const activeApprentices = csvUsers.filter((item) => item.rol === "aprendiz" && item.estado === "activo");
    check(apprenticeData.length === activeApprentices.length, "Datos: los perfiles de aprendices no coinciden con el directorio activo");
    check(activeApprentices.every((row) => apprenticeData.some((item) => item.document === row.identificacion && item.email.toLowerCase() === row.correo.toLowerCase())), "Datos: hay aprendices activos sin un perfil vinculado por documento y correo");
}
check(csvUsers.length > 0, "usuarios.csv: no se encontraron usuarios");
check(csvUsers.some((item) => item.rol === "aprendiz" && item.estado === "activo"), "usuarios.csv: falta al menos un aprendiz activo");
const uniqueDocuments = new Set(csvUsers.map((item) => item.identificacion).filter(Boolean));
const uniqueEmails = new Set(csvUsers.map((item) => item.correo.toLowerCase()).filter(Boolean));
check(uniqueDocuments.size === csvUsers.filter((item) => item.identificacion).length, "usuarios_activos.csv: hay documentos duplicados");
check(uniqueEmails.size === csvUsers.filter((item) => item.correo).length, "usuarios_activos.csv: hay correos duplicados");
check(Object.keys(csvUsers[0] || {}).join(";") === "identificacion;tipo_documento;nombre;correo;rol;estado;ficha", "usuarios.csv: el esquema debe contener exactamente las siete columnas definidas");
check(login.includes('id="email-request-form"'), "login.html: falta la solicitud de código por correo");
check(login.includes('id="email-verify-form"'), "login.html: falta la verificación del código por correo");
check(login.includes('id="apprentice-document" name="document"'), "login.html: falta el ingreso por cédula del aprendiz");
check(login.includes('id="login-identifier" name="identifier" type="text"'), "login.html: falta el ingreso por usuario o correo");
check(login.includes('autocomplete="username"'), "login.html: falta autocompletado accesible del usuario");
check(login.includes('autocomplete="current-password"'), "login.html: falta autocompletado accesible de contraseña");

check(!login.includes("admin123"), "login.html: la contraseña no debe mostrarse en la interfaz");
check(!login.includes("instructor123"), "login.html: la contraseña del instructor no debe mostrarse en la interfaz");
check(!login.includes("demo-access"), "login.html: no debe mostrar las credenciales iniciales");
check(login.includes('id="login-password" name="password" type="password"'), "login.html: la contraseña debe permanecer oculta");

for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    for (const match of html.matchAll(/data-action="([^"]+)"/g)) {
        check(appSource.includes(`data-action=\\"${match[1]}\\"`) || appSource.includes(`data-action="${match[1]}"`), `${file}: la acción ${match[1]} no está conectada`);
    }
    for (const match of html.matchAll(/data-auth-action="([^"]+)"/g)) {
        check(authSource.includes(`data-auth-action=\\"${match[1]}\\"`) || authSource.includes(`data-auth-action="${match[1]}"`), `${file}: la acción de acceso ${match[1]} no está conectada`);
    }
}

const requiredFeatures = {
    "crear_usuario.html": ['id="create-user-form"', 'name="identificacion"', 'name="tipo_documento"', 'name="nombre"', 'name="correo"', 'name="rol"', 'name="estado"', 'name="ficha"', 'id="user-directory-body"', 'data-user-filter="Instructor"', 'id="user-csv-import-form"', 'id="user-csv-file"', 'id="user-csv-import-button"'],
    "programa_formacion.html": ['data-action="new-program"', 'id="tablaProgramas"', 'id="program-search"', 'id="program-ficha-filter"', 'id="program-level-filter"', 'id="program-status-filter"', 'id="program-modality-filter"', 'id="program-export"', 'id="program-pagination"', 'id="program-distribution"', 'id="program-featured"'],
    "fichas.html": ['data-action="new-ficha"', 'id="tablaFichas"'],
    "horario.html": ['data-action="new-schedule"', 'id="tablaHorarios"'],
    "ambiente.html": ['data-action="new-environment"', 'id="tablaAmbientes"'],
    "asistencia.html": ['id="attendance-table-body"', 'id="attendance-ficha"', 'id="attendance-search"', 'data-action="save-attendance"', 'data-action="mark-all-present"'],
    "estadisticas.html": ['id="dashboard-date-from"', 'id="dashboard-date-to"', 'id="dashboard-period"', 'id="dashboard-composition"', 'id="daily-chart"', 'id="statistics-students"', 'id="reports-list"'],
    "ajustes.html": ['data-action="edit-profile"', 'data-action="backup"', 'id="email-service-state"', 'data-action="view-email-history"'],
    "aprendiz.html": ['id="apprentice-attendance-table"', 'id="apprentice-profile-form"', 'data-apprentice-section="program"']
};

const statisticsPage = fs.readFileSync(path.join(root, "estadisticas.html"), "utf8");
check(occurrences(navigationSource, /"estadisticas\.html"/g) === 1, "navegacion.js: debe definir un solo acceso a Estadísticas");
check(navigationSource.includes('class="logout"') && navigationSource.lastIndexOf('class="logout"') > navigationSource.indexOf('class="settings'), "navegacion.js: Cerrar sesión debe estar debajo de Configuración");
check(!statisticsPage.includes('href="index.html"'), "estadisticas.html: no debe duplicar el resumen con una entrada Inicio");
check(!statisticsPage.includes("dashboard-help"), "estadisticas.html: no debe mostrar la opción Ayuda");
check(!fs.readFileSync(path.join(root, "asistencia.html"), "utf8").includes("attendance-help"), "asistencia.html: no debe mostrar la opción Ayuda");
check(fs.existsSync(path.join(scriptsRoot, "aplicacion.js")), "Falta el archivo funcional aplicacion.js");
check(fs.readFileSync(path.join(root, "programa_formacion.html"), "utf8").includes('src="programas.js"'), "programa_formacion.html: falta su módulo de pantalla");
check(fs.readFileSync(path.join(root, "crear_usuario.html"), "utf8").includes('src="usuarios.js"'), "crear_usuario.html: falta cargar usuarios.js");
check(fs.existsSync(path.join(automationRoot, "asegurar_servidor.ps1")) && fs.existsSync(path.join(automationRoot, "vigilante_servidor.ps1")) && fs.existsSync(path.join(automationRoot, "instalar_inicio_automatico.ps1")), "Faltan los scripts de recuperación automática del servidor");
check(navigationSource.includes("function configurarMenuAdaptable"), "navegacion.js: falta el menú adaptable para los roles");
check(appSource.includes("academic-committee-dialog") && appSource.includes("fallas sin justificación"), "usuarios.js: falta la alerta académica del aprendiz");
check(crudSource.includes('fetch("/api/users"'), "usuarios.js: la creación de usuarios no consulta la API real");
check(!statisticsPage.includes("Tendencia de asistencia general") && !statisticsPage.includes("Acciones rápidas"), "estadisticas.html: debe ocultar tendencia general y acciones rápidas");
const createUserPage = fs.readFileSync(path.join(root, "crear_usuario.html"), "utf8");
check(!/reloj-crud|historial-crud|reproducirSonidoDinero|crud-learning-row/.test(createUserPage), "crear_usuario.html: conserva elementos de demostración que no pertenecen al CRUD");
check(!/AudioContext|playUserSavedSound|registerCrudActivity/.test(crudSource), "usuarios.js: conserva sonidos o historiales artificiales sin relación con la gestión de usuarios");
check(appSource.includes('data-user-action="edit"') && appSource.includes('data-user-action="status"') && appSource.includes('data-user-action="delete"'), "usuarios.js: faltan acciones reales para modificar, activar, desactivar o eliminar usuarios");
for (const routeFile of ["acceso.js", "usuarios.js", "formacion.js", "sistema.js", "index.js"]) {
    check(fs.existsSync(path.join(apiRoutesRoot, routeFile)), `Servidor: falta el grupo de rutas ${routeFile}`);
}
check(appSource.includes("/api/programs") && appSource.includes("downloadProgramCsv"), "usuarios.js: programas no consulta la API real o no exporta los resultados filtrados");
check(!appSource.includes('loadData("programs")'), "usuarios.js: programas no debe volver a la lista simulada de localStorage");
check(fs.readFileSync(serverFile, "utf8").includes("pendingCodeRequests") && fs.readFileSync(serverFile, "utf8").includes("emailService.enqueueVerificationCode"), "servidor.js: falta protección contra envíos duplicados o saturación del correo");
check(fs.existsSync(emailModuleFile) && fs.readFileSync(emailModuleFile, "utf8").includes("deliveryTail"), "correo.js: falta la cola independiente de entrega");
check(navigationSource.includes('className = "sidebar-overlay"'), "navegacion.js: falta cerrar el menú móvil desde el fondo");
check(navigationSource.includes('class="sena-logo-video"'), "navegacion.js: falta el logo institucional animado");
check(navigationSource.includes('poster="logo_sena.png"') && navigationSource.includes('class="sena-logo-fallback"'), "navegacion.js: falta el fallback estático del logo institucional");
check(fs.existsSync(path.join(videosRoot, "video sena logo.mp4")), "Recursos: falta el video institucional del logo SENA");

for (const [file, markers] of Object.entries(requiredFeatures)) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    const source = file === "aprendiz.html" ? `${html}\n${navigationSource}` : html;
    markers.forEach((marker) => check(source.includes(marker), `${file}: falta ${marker}`));
}

async function smokeTest() {
    const server = http.createServer((request, response) => {
        const requested = request.url === "/" ? "index.html" : decodeURIComponent(request.url.slice(1));
        const resolved = publicFile(requested);
        if (!resolved || !fs.existsSync(resolved)) {
            response.writeHead(404).end("Not found");
            return;
        }
        response.writeHead(200).end(fs.readFileSync(resolved));
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    try {
        const recursosPublicos = [
            "navegacion.js",
            "datos_demostracion.js",
            "autenticacion.js",
            "aplicacion.js",
            "asistencia.js",
            "estadisticas.js",
            "programas.js",
            "usuarios.js",
            "estilos_generales.css",
            "estilos_acceso.css",
            "base.css",
            "paneles_academicos.css",
            "navegacion_aprendiz.css",
            "estadisticas_usuarios.css",
            "programas_indicadores.css"
        ];
        for (const file of [...htmlFiles, ...recursosPublicos]) {
            const response = await fetch(`http://127.0.0.1:${port}/${encodeURIComponent(file)}`);
            check(response.status === 200, `${file}: respuesta HTTP ${response.status}`);
        }
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

async function emailApiTest() {
    const sentMessages = [];
    const testApprentice = {
        id: "aprendiz-prueba",
        document: "123456789",
        name: "Aprendiz de Prueba",
        email: "prueba@example.com",
        phone: "3001234567",
        address: "",
        role: "Aprendiz",
        program: {
            code: "3349882",
            name: "Análisis y Desarrollo de Software",
            level: "Tecnólogo",
            ficha: "3349882",
            schedule: "Mañana",
            mode: "Presencial",
            status: "En formación"
        },
        attendance: [
            { quarter: "Trimestre 1", present: 58, late: 1, absent: 2, justified: 1, percentage: 95 }
        ]
    };
    const today = new Date();
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    const academicAlertRecords = Array.from({ length: 5 }, (_, index) => {
        // Mantiene todos los registros dentro del periodo vigente incluso durante
        // los primeros cuatro días de un trimestre (cuando index + 1 sería futuro).
        const date = new Date(today.getFullYear(), quarterStartMonth, Math.min(today.getDate(), index + 1), 12);
        const fecha = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        return {
            identificacion: testApprentice.document,
            nombre: testApprentice.name,
            ficha: testApprentice.program.ficha,
            fecha,
            jornada: "Mañana",
            estado: "ausente",
            observacion: "Falla de asistencia sin justificar",
            hora_registro: `${fecha}T07:00:00-05:00`,
            registrado_por: "Prueba automática"
        };
    });
    const server = createProjectServer({
        adminPassword: "admin123",
        instructorPassword: "instructor123",
        otpSecret: "secreto-de-prueba",
        exposeTestCode: true,
        apprentices: [testApprentice],
        attendanceRecords: academicAlertRecords,
        managedUsers: [],
        emailSender: async (message) => {
            sentMessages.push(message);
            return { id: "correo-prueba" };
        }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    try {
        const adminResponse = await fetch(`${baseUrl}/api/auth/password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: "admin", password: "admin123" })
        });
        const adminData = await adminResponse.json();
        const adminCookie = adminResponse.headers.get("set-cookie")?.split(";")[0] || "";
        check(adminResponse.status === 200 && adminData.user.role === "Administrador", "API contraseña: no autenticó al administrador");

        const logoVideoResponse = await fetch(`${baseUrl}/video%20sena%20logo.mp4`, { method: "HEAD" });
        check(logoVideoResponse.status === 200, `Video institucional: respuesta HTTP ${logoVideoResponse.status}`);
        check(logoVideoResponse.headers.get("content-type") === "video/mp4", "Video institucional: MIME distinto de video/mp4");
        check((adminResponse.headers.get("set-cookie") || "").includes("HttpOnly"), "API contraseña: la sesión no usa cookie HttpOnly");

        const adminProfileResponse = await fetch(`${baseUrl}/api/auth/profile`, { headers: { Cookie: adminCookie } });
        const adminProfileData = await adminProfileResponse.json();
        check(adminProfileResponse.status === 200 && adminProfileData.user.name === "Administrador SENA", "API perfil: no entregó el perfil administrativo");

        const profileUpdateResponse = await fetch(`${baseUrl}/api/auth/profile`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Cookie: adminCookie },
            body: JSON.stringify({ name: "Administrador de Prueba", email: "admin.prueba@example.com" })
        });
        const updatedProfile = await profileUpdateResponse.json();
        check(profileUpdateResponse.status === 200 && updatedProfile.user.email === "admin.prueba@example.com", "API perfil: no actualizó el nombre y el correo");

        const passwordChangeResponse = await fetch(`${baseUrl}/api/auth/password/change`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: adminCookie },
            body: JSON.stringify({ currentPassword: "admin123", newPassword: "NuevaClave123" })
        });
        check(passwordChangeResponse.status === 200, "API perfil: no cambió la contraseña administrativa");

        const newPasswordLoginResponse = await fetch(`${baseUrl}/api/auth/password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: "admin", password: "NuevaClave123" })
        });
        check(newPasswordLoginResponse.status === 200, "API perfil: la contraseña nueva no permite iniciar sesión");

        const oldPasswordLoginResponse = await fetch(`${baseUrl}/api/auth/password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: "admin", password: "admin123" })
        });
        check(oldPasswordLoginResponse.status === 401, "API perfil: la contraseña anterior siguió funcionando");

        const usersResponse = await fetch(`${baseUrl}/api/users`, { headers: { Cookie: adminCookie } });
        const usersData = await usersResponse.json();
        check(usersResponse.status === 200 && usersData.summary.students === 1 && usersData.fichas[0].codigo === "3349882", "API usuarios: no entregó el directorio y las fichas reales");

        const createdUserResponse = await fetch(`${baseUrl}/api/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: adminCookie },
            body: JSON.stringify({
                documentType: "Cédula de Ciudadanía",
                document: "987654321",
                username: "instructor.prueba",
                firstName: "Instructor",
                lastName: "Nuevo",
                email: "instructor.nuevo@example.com",
                phone: "3005550101",
                role: "Instructor",
                password: "ClaveSegura123"
            })
        });
        const createdUserData = await createdUserResponse.json();
        check(createdUserResponse.status === 201 && createdUserData.user.role === "Instructor", "API usuarios: no creó la cuenta persistente");
        check(!("passwordHash" in createdUserData.user) && !JSON.stringify(createdUserData).includes("ClaveSegura123"), "API usuarios: expuso información sensible de la cuenta");

        const createdLoginResponse = await fetch(`${baseUrl}/api/auth/password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: "instructor.prueba", password: "ClaveSegura123" })
        });
        const createdLoginData = await createdLoginResponse.json();
        check(createdLoginResponse.status === 200 && createdLoginData.user.role === "Instructor", "API usuarios: la cuenta creada no pudo iniciar sesión");

        const duplicateUserResponse = await fetch(`${baseUrl}/api/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: adminCookie },
            body: JSON.stringify({ document: "987654321", username: "otro.usuario", firstName: "Otro", lastName: "Usuario", email: "otro@example.com", role: "Instructor", password: "ClaveSegura123" })
        });
        check(duplicateUserResponse.status === 409, "API usuarios: permitió duplicar el documento");
        const forbiddenUsersResponse = await fetch(`${baseUrl}/api/users`);
        check(forbiddenUsersResponse.status === 403, "API usuarios: expuso el directorio sin sesión administrativa");

        const attendanceListResponse = await fetch(`${baseUrl}/api/attendance`, { headers: { Cookie: adminCookie } });
        const attendanceListData = await attendanceListResponse.json();
        check(attendanceListResponse.status === 200 && attendanceListData.fichas[0].codigo === "3349882", "API asistencia: no entregó las fichas reales al administrador");

        const attendanceSaveResponse = await fetch(`${baseUrl}/api/attendance`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: adminCookie },
            body: JSON.stringify({
                ficha: "3349882",
                fecha: "2026-08-07",
                jornada: "Mañana",
                aprendices: [{ identificacion: testApprentice.document, estado: "justificado", observacion: "Cita médica" }]
            })
        });
        const attendanceSaveData = await attendanceSaveResponse.json();
        check(attendanceSaveResponse.status === 200 && attendanceSaveData.guardados === 1, "API asistencia: no guardó el registro completo");

        const attendanceReadResponse = await fetch(`${baseUrl}/api/attendance?ficha=3349882&fecha=2026-08-07&jornada=${encodeURIComponent("Mañana")}`, { headers: { Cookie: adminCookie } });
        const attendanceReadData = await attendanceReadResponse.json();
        check(attendanceReadData.aprendices[0].estado === "justificado" && attendanceReadData.aprendices[0].observacion === "Cita médica", "API asistencia: no recuperó el estado y la observación guardados");

        const attendanceForbiddenResponse = await fetch(`${baseUrl}/api/attendance`);
        check(attendanceForbiddenResponse.status === 403, "API asistencia: permitió consultar sin una sesión de instructor o administrador");

        const statisticsResponse = await fetch(`${baseUrl}/api/statistics?from=2026-08-07&to=2026-08-07&period=custom&trendDays=7`, { headers: { Cookie: adminCookie } });
        const statisticsData = await statisticsResponse.json();
        check(statisticsResponse.status === 200 && statisticsData.summary.apprentices === 1, "API estadísticas: no entregó el resumen real al administrador");
        check(statisticsData.summary.attendanceRecords === 1 && statisticsData.composition[0].counts.justificado === 1, "API estadísticas: no agregó los registros del periodo");
        check(statisticsData.trend.length === 7 && statisticsData.trend.at(-1).date === "2026-08-07" && statisticsData.trend.at(-1).total === 1, "API estadísticas: la tendencia de 7 días no termina con los datos reales del rango");
        check(!JSON.stringify(statisticsData).includes("NaN"), "API estadísticas: devolvió un porcentaje inválido");

        for (const days of [15, 30]) {
            const trendResponse = await fetch(`${baseUrl}/api/statistics?from=2026-08-07&to=2026-08-07&period=custom&trendDays=${days}`, { headers: { Cookie: adminCookie } });
            const trendData = await trendResponse.json();
            check(trendResponse.status === 200 && trendData.filters.trendDays === days && trendData.trend.length === days && trendData.trend.at(-1).date === "2026-08-07", `API estadísticas: la tendencia de ${days} días no respondió correctamente`);
        }

        const now = new Date();
        const currentPeriod = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
        const currentPeriodResponse = await fetch(`${baseUrl}/api/statistics?period=${currentPeriod}`, { headers: { Cookie: adminCookie } });
        const currentPeriodData = await currentPeriodResponse.json();
        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        check(currentPeriodResponse.status === 200 && currentPeriodData.filters.to === todayKey, "API estadísticas: el periodo vigente no se limitó a la fecha actual");

        const statisticsForbiddenResponse = await fetch(`${baseUrl}/api/statistics`);
        check(statisticsForbiddenResponse.status === 403, "API estadísticas: permitió consultar sin autenticación");

        const instructorResponse = await fetch(`${baseUrl}/api/auth/password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "instructor@sena.edu.co", password: "instructor123" })
        });
        const instructorData = await instructorResponse.json();
        const instructorCookie = instructorResponse.headers.get("set-cookie")?.split(";")[0] || "";
        check(instructorResponse.status === 200 && instructorData.user.role === "Instructor", "API contraseña: no autenticó al instructor");

        const instructorStatisticsResponse = await fetch(`${baseUrl}/api/statistics`, { headers: { Cookie: instructorCookie } });
        check(instructorStatisticsResponse.status === 200, "API estadísticas: no permitió consultar informes al instructor");

        const invalidPasswordResponse = await fetch(`${baseUrl}/api/auth/password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: "admin", password: "incorrecta" })
        });
        check(invalidPasswordResponse.status === 401, "API contraseña: aceptó una clave incorrecta");

        const requestResponse = await fetch(`${baseUrl}/api/auth/email/request`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ document: testApprentice.document })
        });
        const requestData = await requestResponse.json();
        check(requestResponse.status === 200 && /^\d{6}$/.test(requestData.testCode || ""), "API correo: no generó el código");
        check(sentMessages.length === 1 && sentMessages[0].to[0] === "prueba@example.com", "API correo: no preparó el mensaje correcto");
        check(sentMessages[0].text.includes("Hola Aprendiz De") && sentMessages[0].text.includes("Expira en 10 minutos"), "API correo: falta el saludo personalizado o el vencimiento");

        const statusResponse = await fetch(`${baseUrl}/api/auth/email/status`);
        const statusData = await statusResponse.json();
        check(statusResponse.status === 200 && statusData.configured === true, "API correo: no informa que el servicio está listo");

        const invalidCode = requestData.testCode === "000000" ? "999999" : "000000";
        const invalidResponse = await fetch(`${baseUrl}/api/auth/email/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ document: testApprentice.document, code: invalidCode })
        });
        check(invalidResponse.status === 401, "API correo: aceptó un código incorrecto");

        const verifyResponse = await fetch(`${baseUrl}/api/auth/email/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ document: testApprentice.document, code: requestData.testCode })
        });
        const sessionCookie = verifyResponse.headers.get("set-cookie")?.split(";")[0] || "";
        check(verifyResponse.status === 200 && sessionCookie.startsWith("sena_session="), "API correo: no creó la sesión protegida");

        const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, { headers: { Cookie: sessionCookie } });
        const sessionData = await sessionResponse.json();
        check(sessionData.authenticated === true && sessionData.user.role === "Aprendiz", "API correo: no recuperó la sesión del aprendiz");

        const profileResponse = await fetch(`${baseUrl}/api/apprentice/me`, { headers: { Cookie: sessionCookie } });
        const profileData = await profileResponse.json();
        check(profileResponse.status === 200 && profileData.apprentice.document === testApprentice.document, "API aprendiz: no entregó su perfil privado");
        check(profileData.apprentice.attendance[0].percentage === 95, "API aprendiz: no entregó la asistencia trimestral");
        check(profileData.academicAlert?.unjustifiedAbsences === 5 && profileData.academicAlert?.message.includes("Comité Académico"), "API aprendiz: no entregó la alerta por más de cuatro fallas injustificadas");

        const repeatedProfileResponse = await fetch(`${baseUrl}/api/apprentice/me`, { headers: { Cookie: sessionCookie } });
        const repeatedProfileData = await repeatedProfileResponse.json();
        check(repeatedProfileData.academicAlert === null, "API aprendiz: repitió la alerta académica durante la misma sesión");

        const apprenticeAttendanceResponse = await fetch(`${baseUrl}/api/attendance`, { headers: { Cookie: sessionCookie } });
        check(apprenticeAttendanceResponse.status === 403, "API asistencia: permitió que un aprendiz entrara a la interfaz administrativa");

        const apprenticeReportsResponse = await fetch(`${baseUrl}/api/reports`, { headers: { Cookie: sessionCookie } });
        check(apprenticeReportsResponse.status === 403, "API informes: permitió consultar al aprendiz");
        const apprenticeStatisticsResponse = await fetch(`${baseUrl}/api/statistics`, { headers: { Cookie: sessionCookie } });
        check(apprenticeStatisticsResponse.status === 403, "API estadísticas: permitió el acceso a un aprendiz");

        const updateResponse = await fetch(`${baseUrl}/api/apprentice/me`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Cookie: sessionCookie },
            body: JSON.stringify({ phone: "3110000000", address: "Dirección actualizada", role: "Administrador" })
        });
        const updateData = await updateResponse.json();
        check(updateResponse.status === 200 && updateData.apprentice.phone === "3110000000", "API aprendiz: no actualizó los datos permitidos");
        check(updateData.apprentice.role === "Aprendiz", "API aprendiz: permitió cambiar el rol");

        const forbiddenResponse = await fetch(`${baseUrl}/api/apprentice/me`);
        check(forbiddenResponse.status === 403, "API aprendiz: expuso datos sin una sesión autorizada");

        const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST", headers: { Cookie: sessionCookie } });
        check(logoutResponse.status === 200, "API correo: no cerró la sesión");

        const envResponse = await fetch(`${baseUrl}/.env`);
        check(envResponse.status === 404, "Servidor: expuso el archivo secreto .env");
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

async function csvEmailLookupTest() {
    const sentMessages = [];
    const server = createProjectServer({
        adminPassword: "csv-email-test-password",
        otpSecret: "secreto-csv-prueba",
        exposeTestCode: true,
        apprentices: [],
        csvUsers: [{
            identificacion: "1000000002",
            tipo_documento: "Cédula de Ciudadanía",
            nombre: "Aprendiz de prueba",
            correo: "aprendiz@example.com",
            rol: "aprendiz",
            estado: "activo",
            ficha: "3349882"
        }],
        emailSender: async (message) => {
            sentMessages.push(message);
            return { id: "correo-csv-prueba" };
        }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    try {
        const response = await fetch(`${baseUrl}/api/auth/email/request`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ document: "1000000002" })
        });
        const data = await response.json();
        check(response.status === 200 && /^\d{6}$/.test(data.testCode || ""), "usuarios.csv: no generó el código para la cédula registrada");
        check(sentMessages[0]?.to[0] === "aprendiz@example.com", "usuarios.csv: no envió el código al correo relacionado con la cédula");
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

async function programApiTest() {
    const server = createProjectServer({
        adminPassword: "admin123",
        apprentices: [],
        attendanceRecords: [],
        managedUsers: [],
        programs: [
            { id: 1, nombre: "Análisis y Desarrollo de Software", nivel: "Tecnologo", duracion: "27 Meses", estado: "Activo" }
        ],
        sqlData: {
            ambientes: [],
            horarios: [],
            programas: [],
            fichas: [
                { id: 1, numero: 3349882, jornada: "Mañana", modalidad: "Presencial", estado: "Activa", programaId: 1, instructorId: 10 },
                { id: 2, numero: 3349883, jornada: "Tarde", modalidad: "Presencial", estado: "Activa", programaId: 1, instructorId: 11 }
            ]
        }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    try {
        const loginResponse = await fetch(`${baseUrl}/api/auth/password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: "admin", password: "admin123" })
        });
        const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0] || "";

        const listResponse = await fetch(`${baseUrl}/api/programs`, { headers: { Cookie: cookie } });
        const list = await listResponse.json();
        check(listResponse.status === 200 && list.programs[0].fichas === 2 && list.programs[0].instructors === 2, "API programas: no calculó las fichas e instructores relacionados");
        check(list.summary.active === 1 && list.summary.fichas === 2 && list.filters.modalities.includes("Presencial"), "API programas: no entregó tarjetas y filtros desde datos reales");
        check(list.filters.fichas?.map((ficha) => ficha.number).join(",") === "3349882,3349883", "API programas: no entregó las fichas reales para facilitar la consulta");

        const createResponse = await fetch(`${baseUrl}/api/programs`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: cookie },
            body: JSON.stringify({ code: "2", name: "Gestión de Datos", level: "Técnico", duration: "12 Meses", status: "En revisión" })
        });
        const created = await createResponse.json();
        check(createResponse.status === 201 && created.program.status === "En revisión" && created.summary.review === 1, "API programas: no creó un programa en revisión");
        check(created.program.fichas === 0 && created.program.modality === "Sin fichas", "API programas: inventó relaciones para un programa nuevo");

        const duplicateResponse = await fetch(`${baseUrl}/api/programs`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: cookie },
            body: JSON.stringify({ code: "2", name: "Otro programa", level: "Técnico", duration: "6 Meses", status: "Activo" })
        });
        check(duplicateResponse.status === 409, "API programas: permitió duplicar el código");

        const updateResponse = await fetch(`${baseUrl}/api/programs/2`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Cookie: cookie },
            body: JSON.stringify({ name: "Gestión y Analítica de Datos", status: "Activo" })
        });
        const updated = await updateResponse.json();
        check(updateResponse.status === 200 && updated.program.name === "Gestión y Analítica de Datos" && updated.summary.active === 2, "API programas: no editó el programa o su estado");

        const forbiddenResponse = await fetch(`${baseUrl}/api/programs`);
        check(forbiddenResponse.status === 403, "API programas: expuso datos sin sesión de personal");
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

async function userManagementApiTest() {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "sena-users-test-"));
    const csvFile = path.join(tempDirectory, "usuarios.csv");
    fs.writeFileSync(csvFile, "identificacion;tipo_documento;nombre;correo;rol;estado;ficha\n", "utf8");
    const sentMessages = [];
    const server = createProjectServer({
        adminPassword: "admin123",
        apprentices: [],
        attendanceRecords: [],
        managedUsers: [],
        usersCsvFile: csvFile,
        otpSecret: "secreto-usuarios-prueba",
        exposeTestCode: true,
        emailSender: async (message) => {
            sentMessages.push(message);
            return { id: "correo-usuario-prueba" };
        },
        sqlData: {
            ambientes: [],
            horarios: [],
            programas: [{ id: 1, nombre: "Análisis y Desarrollo de Software", nivel: "Tecnologo", duracion: "27 Meses", estado: "Activo" }],
            fichas: [{ id: 1, numero: 3349882, jornada: "Mañana", modalidad: "Presencial", estado: "Activa", programaId: 1, instructorId: 10 }]
        }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    try {
        const loginResponse = await fetch(`${baseUrl}/api/auth/password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: "admin", password: "admin123" })
        });
        const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0] || "";

        const manualResponse = await fetch(`${baseUrl}/api/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: cookie },
            body: JSON.stringify({
                identificacion: "900000001",
                tipo_documento: "Cédula de Ciudadanía",
                nombre: "Instructor CSV",
                correo: "instructor.csv@example.com",
                rol: "Instructor",
                estado: "Activo",
                ficha: "3349882"
            })
        });
        const manualData = await manualResponse.json();
        const manualUser = manualData.users?.find((user) => user.document === "900000001");
        check(manualResponse.status === 201 && manualUser?.role === "Instructor", "API usuarios CSV: no creó el usuario manual");
        check(loadCsvUsers(csvFile).some((user) => user.identificacion === "900000001" && user.correo === "instructor.csv@example.com"), "API usuarios CSV: la creación manual no se guardó en usuarios.csv");

        const staffCodeResponse = await fetch(`${baseUrl}/api/auth/email/request`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ document: "900000001" })
        });
        const staffCodeData = await staffCodeResponse.json();
        const verifyStaffResponse = await fetch(`${baseUrl}/api/auth/email/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ document: "900000001", code: staffCodeData.testCode })
        });
        const verifiedStaff = await verifyStaffResponse.json();
        check(staffCodeResponse.status === 200 && sentMessages.at(-1)?.to[0] === "instructor.csv@example.com", "API usuarios CSV: no envió el código al correo del instructor creado");
        check(verifyStaffResponse.status === 200 && verifiedStaff.user?.role === "Instructor", "API usuarios CSV: el instructor no pudo ingresar con el código enviado al correo");

        const disableStaffResponse = await fetch(`${baseUrl}/api/users/${encodeURIComponent(manualUser.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Cookie: cookie },
            body: JSON.stringify({ estado: "Inactivo" })
        });
        const disabledLoginResponse = await fetch(`${baseUrl}/api/auth/email/request`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ document: "900000001" })
        });
        check(disableStaffResponse.status === 200 && disabledLoginResponse.status === 403, "API usuarios CSV: una cuenta de personal desactivada todavía puede solicitar un código");

        const enableStaffResponse = await fetch(`${baseUrl}/api/users/${encodeURIComponent(manualUser.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Cookie: cookie },
            body: JSON.stringify({ nombre: "Instructor CSV Editado", estado: "Activo" })
        });
        check(enableStaffResponse.status === 200 && loadCsvUsers(csvFile).some((user) => user.nombre === "Instructor CSV Editado" && user.estado === "activo"), "API usuarios CSV: no reactivó o modificó la cuenta de personal");

        const importCsv = [
            "identificacion;tipo_documento;nombre;correo;rol;estado;ficha",
            "900000002;Cédula de Ciudadanía;Aprendiz Importado;aprendiz.importado@example.com;aprendiz;activo;3349882"
        ].join("\n");
        const importResponse = await fetch(`${baseUrl}/api/users/import`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: cookie },
            body: JSON.stringify({ fileName: "aprendices.csv", csv: importCsv })
        });
        const imported = await importResponse.json();
        const importedUser = imported.users?.find((user) => user.document === "900000002");
        check(importResponse.status === 201 && imported.importResult.created === 1 && importedUser?.role === "Aprendiz", "API usuarios CSV: no importó el aprendiz");
        check(loadCsvUsers(csvFile).some((user) => user.identificacion === "900000002" && user.estado === "activo"), "API usuarios CSV: no persistió el aprendiz importado");

        const deactivateResponse = await fetch(`${baseUrl}/api/users/${encodeURIComponent(importedUser.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Cookie: cookie },
            body: JSON.stringify({ estado: "Inactivo" })
        });
        check(deactivateResponse.status === 200 && loadCsvUsers(csvFile).find((user) => user.identificacion === "900000002")?.estado === "inactivo", "API usuarios CSV: no desactivó y sincronizó el usuario");
        const inactiveLoginResponse = await fetch(`${baseUrl}/api/auth/email/request`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ document: "900000002" })
        });
        check(inactiveLoginResponse.status === 403, "API usuarios CSV: un aprendiz desactivado todavía puede solicitar acceso");

        const editResponse = await fetch(`${baseUrl}/api/users/${encodeURIComponent(importedUser.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Cookie: cookie },
            body: JSON.stringify({ tipo_documento: "Cédula de Ciudadanía", nombre: "Aprendiz Editado", correo: "aprendiz.editado@example.com", ficha: "3349882", estado: "Activo" })
        });
        check(editResponse.status === 200 && loadCsvUsers(csvFile).some((user) => user.nombre === "Aprendiz Editado" && user.correo === "aprendiz.editado@example.com"), "API usuarios CSV: no modificó el usuario en usuarios.csv");

        const deleteResponse = await fetch(`${baseUrl}/api/users/${encodeURIComponent(importedUser.id)}`, {
            method: "DELETE",
            headers: { Cookie: cookie }
        });
        check(deleteResponse.status === 200 && !loadCsvUsers(csvFile).some((user) => user.identificacion === "900000002"), "API usuarios CSV: no eliminó el usuario de usuarios.csv");

        const deleteStaffResponse = await fetch(`${baseUrl}/api/users/${encodeURIComponent(manualUser.id)}`, { method: "DELETE", headers: { Cookie: cookie } });
        const deletedStaffLoginResponse = await fetch(`${baseUrl}/api/auth/email/request`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ document: "900000001" })
        });
        check(deleteStaffResponse.status === 200 && deletedStaffLoginResponse.status === 404 && !loadCsvUsers(csvFile).some((user) => user.identificacion === "900000001"), "API usuarios CSV: no eliminó por completo la cuenta de personal");

        const duplicateCsv = [
            "identificacion;tipo_documento;nombre;correo;rol;estado;ficha",
            "900000003;Cédula de Ciudadanía;Uno;uno@example.com;aprendiz;activo;3349882",
            "900000003;Cédula de Ciudadanía;Dos;dos@example.com;aprendiz;activo;3349882"
        ].join("\n");
        const beforeInvalidImport = fs.readFileSync(csvFile, "utf8");
        const invalidImportResponse = await fetch(`${baseUrl}/api/users/import`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: cookie },
            body: JSON.stringify({ fileName: "duplicados.csv", csv: duplicateCsv })
        });
        check(invalidImportResponse.status === 400 && fs.readFileSync(csvFile, "utf8") === beforeInvalidImport, "API usuarios CSV: modificó la base pese a errores de validación");
    } finally {
        await new Promise((resolve) => server.close(resolve));
        fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
}

async function resilientEmailDeliveryTest() {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "sena-email-resilience-"));
    const authStateFile = path.join(tempDirectory, "email-auth-state.json");
    const emailHistoryFile = path.join(tempDirectory, "email-delivery-history.json");
    const apprentice = {
        id: "aprendiz-resiliencia",
        document: "123123123",
        name: "Aprendiz Resiliencia",
        email: "resiliencia@correo.test",
        role: "Aprendiz",
        status: "Activo",
        program: { ficha: "3349882", code: "3349882", name: "Programa", status: "En formación" },
        attendance: []
    };
    let deliveryAttempts = 0;
    const commonOptions = {
        adminPassword: "admin123",
        otpSecret: "secreto-persistente-de-prueba",
        exposeTestCode: true,
        apprentices: [apprentice],
        attendanceRecords: [],
        managedUsers: [],
        authStateFile,
        emailHistoryFile,
        emailMaxAttempts: 3,
        emailRetryBaseMs: 10
    };
    const firstServer = createProjectServer({
        ...commonOptions,
        emailSender: async () => {
            deliveryAttempts += 1;
            if (deliveryAttempts < 3) {
                throw Object.assign(new Error("Falla temporal simulada"), { retryable: true, errorCode: "temporary_test" });
            }
            return { id: "correo-reintentado" };
        }
    });
    let verificationCode = "";
    try {
        await new Promise((resolve) => firstServer.listen(0, "127.0.0.1", resolve));
        const baseUrl = `http://127.0.0.1:${firstServer.address().port}`;
        const requestResponse = await fetch(`${baseUrl}/api/auth/email/request`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ document: apprentice.document })
        });
        const requestData = await requestResponse.json();
        verificationCode = requestData.testCode;
        check(requestResponse.status === 200 && deliveryAttempts === 3, "API correo resiliente: no recuperó un fallo temporal mediante reintentos");

        const adminResponse = await fetch(`${baseUrl}/api/auth/password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: "admin", password: "admin123" })
        });
        const adminCookie = adminResponse.headers.get("set-cookie")?.split(";")[0] || "";
        const historyResponse = await fetch(`${baseUrl}/api/auth/email/history`, { headers: { Cookie: adminCookie } });
        const historyData = await historyResponse.json();
        const delivery = historyData.deliveries?.[0];
        check(historyResponse.status === 200 && delivery?.status === "accepted" && delivery?.attempts === 3, "API correo resiliente: no guardó el historial de reintentos");
        check(delivery?.recipient === "re***@correo.test" && !JSON.stringify(historyData).includes(verificationCode), "API correo resiliente: el historial expone datos sensibles");

        const healthResponse = await fetch(`${baseUrl}/api/health`);
        const healthData = await healthResponse.json();
        check(healthResponse.status === 200 && healthData.service === "sistema-asistencia-sena", "API salud: no informa que el servidor está disponible");
    } finally {
        if (firstServer.listening) await new Promise((resolve) => firstServer.close(resolve));
    }

    const secondServer = createProjectServer({
        ...commonOptions,
        emailSender: async () => ({ id: "correo-segundo-servidor" })
    });
    try {
        await new Promise((resolve) => secondServer.listen(0, "127.0.0.1", resolve));
        const baseUrl = `http://127.0.0.1:${secondServer.address().port}`;
        const verifyResponse = await fetch(`${baseUrl}/api/auth/email/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ document: apprentice.document, code: verificationCode })
        });
        check(verifyResponse.status === 200, "API correo resiliente: el código pendiente no sobrevivió al reinicio del servidor");
        const storedState = JSON.parse(fs.readFileSync(authStateFile, "utf8"));
        check(storedState.codes.length === 0, "API correo resiliente: no eliminó el código persistido después de usarlo");
    } finally {
        if (secondServer.listening) await new Promise((resolve) => secondServer.close(resolve));
        fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
}

(async () => {
    await smokeTest();
    await emailApiTest();
    await programApiTest();
    await userManagementApiTest();
    await csvEmailLookupTest();
    await resilientEmailDeliveryTest();
    if (failures.length) {
        console.error(`\n${failures.length} prueba(s) fallaron:`);
        failures.forEach((failure) => console.error(`- ${failure}`));
        process.exitCode = 1;
        return;
    }
    console.log(`OK: ${htmlFiles.length} páginas, roles separados, acceso por contraseña y API de códigos por correo validados.`);
})();
