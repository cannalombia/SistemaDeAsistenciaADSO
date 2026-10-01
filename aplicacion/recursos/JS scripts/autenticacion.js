/**
 * Autenticación compartida del Sistema de Asistencia SENA.
 * Admite cuentas locales y acceso mediante código enviado al correo registrado.
 */
(function () {
    "use strict";

    const LOCAL_APP_ORIGIN = "http://localhost:3000";
    const isLocalAddress = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    if (isLocalAddress && window.location.origin !== LOCAL_APP_ORIGIN) {
        const destination = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        window.location.replace(`${LOCAL_APP_ORIGIN}${destination}`);
        return;
    }

    const LOGIN_PAGE = "login.html";
    const DEFAULT_PAGE = "estadisticas.html";
    const APPRENTICE_PAGE = "aprendiz.html";
    const isLoginPage = /(^|\/)login\.html$/.test(window.location.pathname);
    const pageFile = window.location.pathname.split("/").pop() || "index.html";
    const currentDestination = `${pageFile}${window.location.search}${window.location.hash}`;

    let activeUser = null;
    let pendingDocument = "";

    function normalize(value) {
        return String(value || "").trim().toLocaleLowerCase("es");
    }

    function publicUser(user, method) {
        return {
            id: user.id || user.sub || "usuario",
            username: user.username || "",
            document: user.document || "",
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            name: user.name || user.nickname || user.email || "Usuario",
            email: user.email || "",
            phone: user.phone || "",
            role: user.role || "Usuario",
            picture: user.picture || "logo_sena.png",
            method
        };
    }

    function safeDestination(value) {
        if (!value || typeof value !== "string") return DEFAULT_PAGE;
        try {
            const parsed = new URL(value, window.location.href);
            if (parsed.origin !== window.location.origin) return DEFAULT_PAGE;
            const targetPage = parsed.pathname.split("/").pop() || "index.html";
            if (targetPage === "index.html") return DEFAULT_PAGE;
            return `${targetPage}${parsed.search}${parsed.hash}`;
        } catch (_error) {
            return DEFAULT_PAGE;
        }
    }

    function requestedDestination() {
        return safeDestination(new URLSearchParams(window.location.search).get("returnTo"));
    }

    function loginUrl(destination) {
        return `${LOGIN_PAGE}?returnTo=${encodeURIComponent(safeDestination(destination))}`;
    }

    function setLoginStatus(message, isError) {
        const status = document.getElementById("auth-status");
        if (!status) return;
        status.textContent = message;
        status.hidden = !message;
        status.classList.toggle("error", Boolean(isError));
    }

    function setLoginBusy(isBusy) {
        document.querySelectorAll("[data-auth-action], #staff-login-form input, #staff-login-form button, .email-code-form input, .email-code-form button").forEach((control) => {
            control.disabled = isBusy;
        });
    }

    function renderUser(user) {
        const profile = publicUser(user, user.method || "password");
        activeUser = profile;
        document.querySelectorAll("[data-auth-name]").forEach((element) => {
            element.textContent = profile.name;
        });
        document.querySelectorAll("[data-auth-email]").forEach((element) => {
            element.textContent = profile.email;
        });
        document.querySelectorAll("[data-auth-role]").forEach((element) => {
            element.textContent = profile.role;
        });
        document.querySelectorAll("[data-auth-method]").forEach((element) => {
            const labels = { local: "Cuenta local", password: profile.role, email: "Código por correo" };
            element.textContent = labels[profile.method] || "Cuenta autenticada";
        });
        document.querySelectorAll("[data-auth-avatar]").forEach((image) => {
            image.src = profile.picture;
            image.alt = `Perfil de ${profile.name}`;
        });
    }

    function showLoginAccount(user) {
        renderUser(user);
        const account = document.getElementById("auth-account");
        const actions = document.getElementById("auth-actions");
        if (account) account.hidden = false;
        if (actions) actions.hidden = true;
    }

    function showLoginActions() {
        const account = document.getElementById("auth-account");
        const actions = document.getElementById("auth-actions");
        if (account) account.hidden = true;
        if (actions) actions.hidden = false;
    }

    async function apiRequest(url, options = {}) {
        let response;
        try {
            response = await fetch(url, {
                credentials: "same-origin",
                headers: { "Content-Type": "application/json", ...(options.headers || {}) },
                ...options
            });
        } catch (_error) {
            throw new Error("No hay conexión con la API. Inicia el proyecto con npm.cmd start y abre http://localhost:3000/login.html.");
        }
        let data = {};
        try {
            data = await response.json();
        } catch (_error) {
            data = {};
        }
        if (!response.ok) {
            const apiNotRunning = [404, 405].includes(response.status) && url.startsWith("/api/");
            throw new Error(data.message || (apiNotRunning
                ? "La autenticación está abierta desde un servidor incorrecto. Usa http://localhost:3000/login.html y no uses Live Server ni http-server."
                : `No fue posible completar la solicitud (error ${response.status}).`));
        }
        return data;
    }

    async function getServerSession() {
        try {
            const data = await apiRequest("/api/auth/session", { method: "GET", headers: {} });
            return data.authenticated && data.user ? publicUser(data.user, data.user.method || "password") : null;
        } catch (_error) {
            return null;
        }
    }

    function isApprentice(user) {
        return normalize(user && user.role) === "aprendiz";
    }

    function destinationFor(user, requested = DEFAULT_PAGE) {
        const qrDestination = safeDestination(requested);
        if (qrDestination.split("?")[0] === "asistencia_qr.html") return qrDestination;
        if (isApprentice(user)) return APPRENTICE_PAGE;
        const destination = safeDestination(requested);
        return destination === APPRENTICE_PAGE ? DEFAULT_PAGE : destination;
    }

    function enforcePageAccess(user) {
        if (isApprentice(user) && ![LOGIN_PAGE, "index.html", APPRENTICE_PAGE].includes(pageFile)) {
            window.location.replace(APPRENTICE_PAGE);
            return false;
        }
        if (!isApprentice(user) && pageFile === APPRENTICE_PAGE) {
            window.location.replace(DEFAULT_PAGE);
            return false;
        }
        return true;
    }

    async function updateProfile(changes) {
        const result = await apiRequest("/api/auth/profile", {
            method: "PATCH",
            body: JSON.stringify({ name: changes.name, email: changes.email })
        });
        renderUser(result.user);
        return result;
    }

    async function changePassword(currentPassword, newPassword) {
        return apiRequest("/api/auth/password/change", {
            method: "POST",
            body: JSON.stringify({ currentPassword, newPassword })
        });
    }

    async function logout() {
        setLoginBusy(true);
        try {
            await apiRequest("/api/auth/logout", { method: "POST", body: "{}" });
        } catch (_error) {
            // La sesión también expira en el servidor; siempre vuelve al login.
        } finally {
            window.location.replace(LOGIN_PAGE);
        }
    }

    function logoutLetterMarkup(text) {
        return [...text].map((character, index) => `<span class="logout-letter" style="--logout-letter-index:${index}">${character === " " ? "&nbsp;" : character}</span>`).join("");
    }

    function enhanceLogoutButtons() {
        document.querySelectorAll(".logout").forEach((button) => {
            if (button.querySelector(".logout-copy")) return;
            button.type = "button";
            button.setAttribute("aria-label", "Cerrar sesión");
            button.innerHTML = `
                <svg class="logout-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"/>
                </svg>
                <span class="logout-copy" aria-hidden="true">
                    <span class="logout-text logout-text-default">${logoutLetterMarkup("Cerrar sesión")}</span>
                    <span class="logout-text logout-text-progress">${logoutLetterMarkup("Cerrando...")}</span>
                </span>`;
        });
    }

    function bindActions() {
        const staffForm = document.getElementById("staff-login-form");
        if (staffForm) {
            staffForm.addEventListener("submit", async (event) => {
                event.preventDefault();
                setLoginBusy(true);
                setLoginStatus("Comprobando tus datos…", false);
                try {
                    const result = await apiRequest("/api/auth/password", {
                        method: "POST",
                        body: JSON.stringify({
                            identifier: staffForm.elements.identifier.value,
                            password: staffForm.elements.password.value
                        })
                    });
                    window.location.replace(destinationFor(result.user, requestedDestination()));
                } catch (error) {
                    setLoginBusy(false);
                    setLoginStatus(error.message, true);
                    staffForm.elements.password.focus();
                    staffForm.elements.password.select();
                }
            });
        }

        const emailRequestForm = document.getElementById("email-request-form");
        const emailVerifyForm = document.getElementById("email-verify-form");
        if (emailRequestForm && emailVerifyForm) {
            emailRequestForm.addEventListener("submit", async (event) => {
                event.preventDefault();
                setLoginBusy(true);
                setLoginStatus("Enviando el código a tu correo…", false);
                try {
                    pendingDocument = emailRequestForm.elements.document.value.replace(/\D/g, "");
                    const result = await apiRequest("/api/auth/email/request", {
                        method: "POST",
                        body: JSON.stringify({ document: pendingDocument })
                    });
                    emailRequestForm.hidden = true;
                    emailVerifyForm.hidden = false;
                    setLoginStatus(result.message, false);
                    emailVerifyForm.elements.code.focus();
                } catch (error) {
                    setLoginStatus(error.message, true);
                } finally {
                    setLoginBusy(false);
                }
            });

            emailVerifyForm.addEventListener("submit", async (event) => {
                event.preventDefault();
                setLoginBusy(true);
                setLoginStatus("Verificando el código…", false);
                try {
                    const result = await apiRequest("/api/auth/email/verify", {
                        method: "POST",
                        body: JSON.stringify({
                            document: pendingDocument,
                            code: emailVerifyForm.elements.code.value
                        })
                    });
                    renderUser(result.user);
                    window.location.replace(destinationFor(result.user, requestedDestination()));
                } catch (error) {
                    setLoginBusy(false);
                    setLoginStatus(error.message, true);
                    emailVerifyForm.elements.code.focus();
                    emailVerifyForm.elements.code.select();
                }
            });

            document.querySelector('[data-auth-action="change-email"]')?.addEventListener("click", () => {
                pendingDocument = "";
                emailVerifyForm.reset();
                emailVerifyForm.hidden = true;
                emailRequestForm.hidden = false;
                setLoginStatus("", false);
                emailRequestForm.elements.document.focus();
            });
        }

        document.querySelectorAll('[data-auth-action="continue"]').forEach((button) => {
            button.addEventListener("click", () => window.location.replace(destinationFor(activeUser, requestedDestination())));
        });
        document.querySelectorAll('[data-auth-action="logout"], .logout').forEach((button) => {
            button.addEventListener("click", (event) => {
                event.preventDefault();
                button.classList.add("is-logging-out");
                button.setAttribute("aria-busy", "true");
                logout();
            });
        });

        document.querySelectorAll("[data-auth-tab]").forEach((tab) => {
            tab.addEventListener("click", () => {
                const selected = tab.dataset.authTab;
                document.querySelectorAll("[data-auth-tab]").forEach((item) => {
                    const active = item === tab;
                    item.classList.toggle("active", active);
                    item.setAttribute("aria-selected", String(active));
                });
                document.getElementById("staff-panel").hidden = selected !== "staff";
                document.getElementById("apprentice-panel").hidden = selected !== "apprentice";
                setLoginStatus("", false);
            });
        });
    }

    async function initialize() {
        enhanceLogoutButtons();
        bindActions();

        if (isLoginPage) showLoginActions();

        const serverUser = await getServerSession();
        if (serverUser) {
            renderUser(serverUser);
            if (!enforcePageAccess(serverUser)) return;
            if (isLoginPage) {
                window.location.replace(destinationFor(serverUser, requestedDestination()));
                return;
            }
            if (pageFile === "index.html") {
                window.location.replace(destinationFor(serverUser, DEFAULT_PAGE));
                return;
            }
            document.documentElement.classList.remove("auth-pending");
            return;
        }

        if (isLoginPage) {
            document.documentElement.classList.remove("auth-pending");
            return;
        }

        window.location.replace(loginUrl(currentDestination));
    }

    window.SenaAuth = Object.freeze({
        updateProfile,
        changePassword,
        getCurrentUser: () => activeUser,
        logout
    });

    initialize();
})();
