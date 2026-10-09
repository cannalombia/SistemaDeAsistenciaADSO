// La navegación se mantiene en un solo lugar para evitar diferencias entre páginas.
(function () {
    "use strict";

    const logoSena = `
        <div class="logo">
            <div class="sena-logo-stage" aria-label="Logo SENA animado">
                <img class="sena-logo-session-frame" src="logo_sena_video_frame.webp?v=20261008-loop3" alt="" aria-hidden="true">
                <video class="sena-logo-video" autoplay loop muted playsinline preload="auto" aria-label="Logo SENA animado">
                    <source src="video%20sena%20logo.mp4?v=20261008-loop3" type="video/mp4">
                </video>
                <img class="sena-logo-fallback" src="logo_sena.png" alt="Logo SENA">
            </div>
        </div>`;

    function configurarLogoAnimado(sidebar) {
        const video = sidebar.querySelector(".sena-logo-video");
        if (!video) return;

        const logo = video.closest(".logo");
        const stage = video.closest(".sena-logo-stage");
        const sessionFrame = stage?.querySelector(".sena-logo-session-frame");
        const epochKey = "sena-logo-session-epoch-v2";
        const frameKey = "sena-logo-session-frame-v2";
        const frameTimeKey = "sena-logo-session-frame-time-v2";
        const maxStoredFrameAgeMs = 5000;
        let revealed = false;
        let restoringPhase = false;
        let memoryEpoch = null;

        const readNumber = (key) => {
            try {
                const value = Number(sessionStorage.getItem(key));
                return Number.isFinite(value) && value > 0 ? value : null;
            } catch (_) {
                return null;
            }
        };

        const getSessionEpoch = () => {
            const stored = readNumber(epochKey);
            if (stored) {
                memoryEpoch = stored;
                return stored;
            }
            if (memoryEpoch) return memoryEpoch;
            memoryEpoch = Date.now();
            try { sessionStorage.setItem(epochKey, String(memoryEpoch)); } catch (_) {}
            return memoryEpoch;
        };

        const restoreSessionFrame = () => {
            if (!sessionFrame) return;
            try {
                const savedAt = readNumber(frameTimeKey);
                const savedFrame = sessionStorage.getItem(frameKey);
                if (savedFrame && savedAt && Date.now() - savedAt <= maxStoredFrameAgeMs) {
                    sessionFrame.src = savedFrame;
                    sessionFrame.classList.add("is-session-frame");
                }
            } catch (_) {}
        };

        const captureSessionFrame = () => {
            if (!sessionFrame || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth <= 0 || video.videoHeight <= 0) return;
            try {
                const canvas = document.createElement("canvas");
                const size = 160;
                canvas.width = size;
                canvas.height = size;
                const context = canvas.getContext("2d", { alpha:false });
                if (!context) return;
                context.drawImage(video, 0, 0, size, size);
                const dataUrl = canvas.toDataURL("image/webp", 0.78);
                sessionStorage.setItem(frameKey, dataUrl);
                sessionStorage.setItem(frameTimeKey, String(Date.now()));
            } catch (_) {}
        };

        const targetSessionTime = () => {
            if (!Number.isFinite(video.duration) || video.duration <= 0) return 0;
            const elapsedSeconds = Math.max(0, (Date.now() - getSessionEpoch()) / 1000);
            return elapsedSeconds % video.duration;
        };

        const revealVideo = () => {
            if (revealed || restoringPhase || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || logo?.classList.contains("logo-video-error")) return;
            revealed = true;
            video.classList.add("is-ready");
            stage?.classList.add("is-video-ready");
        };

        const restoreLoopPhase = () => {
            if (!Number.isFinite(video.duration) || video.duration <= 0) return;
            const target = targetSessionTime();
            if (!Number.isFinite(target)) return;
            if (Math.abs(video.currentTime - target) <= 0.06) {
                restoringPhase = false;
                revealVideo();
                return;
            }
            restoringPhase = true;
            try {
                video.currentTime = target;
            } catch (_) {
                restoringPhase = false;
                revealVideo();
            }
        };

        const showFallback = () => {
            revealed = false;
            restoringPhase = false;
            video.classList.remove("is-ready");
            stage?.classList.remove("is-video-ready");
            logo?.classList.add("logo-video-error");
        };

        restoreSessionFrame();
        getSessionEpoch();

        if (!video.canPlayType("video/mp4")) {
            showFallback();
            return;
        }

        video.addEventListener("loadedmetadata", () => {
            restoreLoopPhase();
        }, { once:true });

        video.addEventListener("seeked", () => {
            restoringPhase = false;
            video.play().then(revealVideo).catch(() => revealVideo());
        });

        ["loadeddata", "canplay", "playing"].forEach((eventName) => {
            video.addEventListener(eventName, () => {
                if (!restoringPhase) revealVideo();
            });
        });

        // Captura el último fotograma visible antes de abandonar la página.
        // La siguiente página lo usa como puente hasta reanudar el mismo punto temporal.
        sidebar.addEventListener("pointerdown", (event) => {
            const link = event.target.closest("a[href]");
            if (link && !link.target && link.origin === window.location.origin) captureSessionFrame();
        }, { capture:true });
        window.addEventListener("pagehide", captureSessionFrame, { capture:true });
        window.addEventListener("pageshow", () => {
            if (video.readyState >= HTMLMediaElement.HAVE_METADATA) restoreLoopPhase();
        });
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") {
                captureSessionFrame();
                return;
            }
            if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
                restoreLoopPhase();
                if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) video.play().catch(() => {});
            }
        });

        video.addEventListener("error", showFallback);
        video.querySelector("source")?.addEventListener("error", showFallback);

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        const syncMotionPreference = () => {
            if (reducedMotion.matches) {
                video.pause();
                if (video.readyState >= HTMLMediaElement.HAVE_METADATA) restoreLoopPhase();
                return;
            }
            if (video.readyState >= HTMLMediaElement.HAVE_METADATA) restoreLoopPhase();
            video.play().catch(() => {});
        };
        reducedMotion.addEventListener("change", syncMotionPreference);
        syncMotionPreference();
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
