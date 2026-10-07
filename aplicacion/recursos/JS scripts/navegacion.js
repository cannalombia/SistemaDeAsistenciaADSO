// La navegación se mantiene en un solo lugar para evitar diferencias entre páginas.
(function () {
    "use strict";

    const logoSena = `
        <div class="logo">
            <video class="sena-logo-video" autoplay loop muted playsinline preload="auto" poster="logo_sena.png" aria-label="Logo SENA animado">
                <source src="video%20sena%20logo.mp4" type="video/mp4">
                <img src="logo_sena.png" alt="Logo SENA">
            </video>
            <img class="sena-logo-fallback" src="logo_sena.png" alt="Logo SENA">
        </div>`;

    function configurarLogoAnimado(sidebar) {
        const video = sidebar.querySelector(".sena-logo-video");
        if (!video) return;

        const mostrarFallback = () => video.closest(".logo")?.classList.add("logo-video-error");
        video.addEventListener("error", mostrarFallback);
        video.querySelector("source")?.addEventListener("error", mostrarFallback);

        const movimientoReducido = window.matchMedia("(prefers-reduced-motion: reduce)");
        const sincronizarMovimiento = () => {
            if (movimientoReducido.matches) {
                video.pause();
                return;
            }
            video.play().catch(() => {});
        };
        movimientoReducido.addEventListener("change", sincronizarMovimiento);
        sincronizarMovimiento();
    }

    function configurarMenuAdaptable(sidebar) {
        const main = document.querySelector(".main");
        const header = main?.querySelector(".header");
        if (!main || !header) return;

        sidebar.id = sidebar.id || "app-sidebar";
        const botonMenu = document.createElement("button");
        botonMenu.type = "button";
        botonMenu.className = "app-menu-toggle";
        botonMenu.setAttribute("aria-controls", sidebar.id);
        botonMenu.setAttribute("aria-label", "Abrir menú principal");
        botonMenu.innerHTML = '<i class="fas fa-bars" aria-hidden="true"></i><span>Menú</span>';

        const inicioCabecera = document.createElement("div");
        inicioCabecera.className = "header-start";
        const bloqueTitulo = header.firstElementChild;
        header.insertBefore(inicioCabecera, bloqueTitulo);
        inicioCabecera.append(botonMenu);
        if (bloqueTitulo) inicioCabecera.append(bloqueTitulo);

        const fondo = document.createElement("button");
        fondo.type = "button";
        fondo.className = "sidebar-overlay";
        fondo.setAttribute("aria-label", "Cerrar menú principal");
        fondo.hidden = true;
        document.body.append(fondo);

        const vistaMovil = window.matchMedia("(max-width: 1100px)");
        const sincronizar = () => {
            const abierto = vistaMovil.matches
                ? document.body.classList.contains("sidebar-open")
                : true;
            botonMenu.setAttribute("aria-expanded", String(abierto));
            botonMenu.setAttribute("aria-label", abierto ? "Cerrar menú principal" : "Abrir menú principal");
            botonMenu.innerHTML = `<i class="fas ${abierto ? "fa-xmark" : "fa-bars"}" aria-hidden="true"></i><span>Menú</span>`;
            sidebar.setAttribute("aria-hidden", String(!abierto));
            sidebar.inert = !abierto;
            fondo.hidden = !(vistaMovil.matches && abierto);
            document.body.classList.toggle("menu-locked", vistaMovil.matches && abierto);
        };

        const cerrar = () => {
            document.body.classList.remove("sidebar-open");
            sincronizar();
        };

        botonMenu.addEventListener("click", () => {
            if (!vistaMovil.matches) return;
            document.body.classList.toggle("sidebar-open");
            sincronizar();
        });
        fondo.addEventListener("click", () => {
            cerrar();
            botonMenu.focus();
        });
        sidebar.querySelectorAll("a, [data-apprentice-section]").forEach((control) => {
            control.addEventListener("click", () => {
                if (vistaMovil.matches) cerrar();
            });
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && document.body.classList.contains("sidebar-open")) {
                cerrar();
                botonMenu.focus();
            }
        });
        vistaMovil.addEventListener("change", () => {
            document.body.classList.remove("sidebar-open", "menu-locked");
            sincronizar();
        });
        sincronizar();
    }

    const sidebar = document.querySelector("[data-navegacion-principal]");
    if (!sidebar) return;

    const paginaActual = window.location.pathname.split("/").pop() || "index.html";
    const enlace = (archivo, icono, etiqueta) => `
        <li class="${paginaActual === archivo ? "active" : ""}">
            <a href="${archivo}"><i class="fas ${icono}" aria-hidden="true"></i>${etiqueta}</a>
        </li>`;

    if (document.body.classList.contains("apprentice-portal")) {
        sidebar.innerHTML = `
            ${logoSena}
            <div class="apprentice-identity">
                <strong data-auth-name>Aprendiz</strong>
                <small data-auth-email></small>
            </div>
            <ul class="menu apprentice-menu">
                <li class="active"><button type="button" data-apprentice-section="attendance"><i class="fas fa-calendar-check" aria-hidden="true"></i>Mi asistencia</button></li>
                <li><button type="button" data-apprentice-section="program"><i class="fas fa-book" aria-hidden="true"></i>Mi programa</button></li>
                <li><button type="button" data-apprentice-section="profile"><i class="fas fa-user-pen" aria-hidden="true"></i>Actualizar datos</button></li>
            </ul>
            <button type="button" class="logout">Cerrar sesión</button>`;
        configurarLogoAnimado(sidebar);
        configurarMenuAdaptable(sidebar);
        return;
    }

    sidebar.innerHTML = `
        ${logoSena}
        <ul class="menu">
            ${enlace("estadisticas.html", "fa-chart-line", "Estadísticas")}
            ${enlace("asistencia.html", "fa-calendar-check", "Asistencia")}
            ${enlace("crear_usuario.html", "fa-user-plus", "Crear usuario")}
            ${enlace("programa_formacion.html", "fa-book", "Programa de formación")}
            ${enlace("fichas.html", "fa-folder", "Fichas")}
            ${enlace("horario.html", "fa-clock", "Horario")}
            ${enlace("ambiente.html", "fa-building", "Ambientes")}
        </ul>
        <div class="settings ${paginaActual === "ajustes.html" ? "active" : ""}">
            <a href="ajustes.html"><i class="fas fa-cog" aria-hidden="true"></i>Configuración</a>
        </div>
        <button type="button" class="logout">Cerrar sesión</button>`;
    configurarLogoAnimado(sidebar);
    const notificationButton = document.createElement("button");
    notificationButton.type = "button";
    notificationButton.className = "notification app-notification-button";
    notificationButton.dataset.action = "notifications";
    notificationButton.setAttribute("aria-label", "Ver notificaciones");
    notificationButton.innerHTML = '<i class="fas fa-bell" aria-hidden="true"></i><span class="notification-badge" data-notification-count hidden>0</span>';
    document.querySelector(".main .header")?.append(notificationButton);
    configurarMenuAdaptable(sidebar);
})();
