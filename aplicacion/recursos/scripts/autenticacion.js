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
    const USERS_KEY = "sena-local-users-v1";
    const SESSION_KEY = "sena-auth-session-v1";
    const isLoginPage = /(^|\/)login\.html$/.test(window.location.pathname);
    const pageFile = window.location.pathname.split("/").pop() || "index.html";
    const currentDestination = `${pageFile}${window.location.search}${window.location.hash}`;

    const DEFAULT_USER = Object.freeze({
        id: "local-admin-v2",
        username: "admin",
        document: "100000001",
        firstName: "Administrador",
        lastName: "SENA",
        name: "Administrador SENA",
        email: "admin@sena.edu.co",
        phone: "",
        role: "Administrador",
        picture: "logo_sena.png",
        passwordHash: "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9"
    });

    let activeUser = null;
    let pendingDocument = "";

    function readJson(storage, key, fallback) {
        try {
            const value = storage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch (_error) {
            return fallback;
        }
    }

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

    function getStoredUsers() {
        const stored = readJson(localStorage, USERS_KEY, []);
        return Array.isArray(stored) ? stored : [];
    }

    function getLocalUsers() {
        const users = new Map([[DEFAULT_USER.id, { ...DEFAULT_USER }]]);
        getStoredUsers().forEach((user) => users.set(user.id, user));
        return Array.from(users.values());
    }

    function saveStoredUser(user) {
        const stored = getStoredUsers();
        const index = stored.findIndex((item) => item.id === user.id);
        if (index >= 0) stored[index] = user;
        else stored.push(user);
        localStorage.setItem(USERS_KEY, JSON.stringify(stored));
    }

    function getLocalSession() {
        const candidates = [
            readJson(sessionStorage, SESSION_KEY, null),
            readJson(localStorage, SESSION_KEY, null)
        ];
        const session = candidates.find((item) => item && item.method === "local");
        if (!session) return null;
        if (!session.expiresAt || session.expiresAt <= Date.now()) {
            sessionStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
        return session;
    }

    function storeLocalSession(user, remember) {
        const storage = remember ? localStorage : sessionStorage;
        const otherStorage = remember ? sessionStorage : localStorage;
        const duration = remember ? 30 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;
        otherStorage.removeItem(SESSION_KEY);
        storage.setItem(SESSION_KEY, JSON.stringify({
            method: "local",
            user: publicUser(user, "local"),
            expiresAt: Date.now() + duration
        }));
    }

    function updateCurrentLocalSession(user) {
        [sessionStorage, localStorage].forEach((storage) => {
            const session = readJson(storage, SESSION_KEY, null);
            if (session && session.method === "local") {
                session.user = publicUser(user, "local");
                storage.setItem(SESSION_KEY, JSON.stringify(session));
            }
        });
    }

    async function hashPassword(value) {
        const bytes = new TextEncoder().encode(String(value));
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        return Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
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

    async function loginWithLocalCredentials(username, password, remember) {
        const identifier = normalize(username);
        const user = getLocalUsers().find((item) =>
            [item.username, item.email, item.document].some((value) => normalize(value) === identifier)
        );
        if (!user || user.passwordHash !== await hashPassword(password)) {
            throw new Error("Usuario o contraseña incorrectos.");
        }
        storeLocalSession(user, remember);
        return publicUser(user, "local");
    }

    async function createLocalUser(data) {
        const required = ["username", "document", "firstName", "lastName", "email", "role", "password"];
        if (required.some((field) => !String(data[field] || "").trim())) {
            throw new Error("Completa todos los campos obligatorios.");
        }
        if (String(data.password).length < 8) {
            throw new Error("La contraseña debe tener al menos 8 caracteres.");
        }
        const users = getLocalUsers();
        if (users.some((user) => normalize(user.email) === normalize(data.email))) {
            throw new Error("Ya existe un usuario con ese correo.");
        }
        if (users.some((user) => normalize(user.document) === normalize(data.document))) {
            throw new Error("Ya existe un usuario con ese documento.");
        }
        if (users.some((user) => normalize(user.username) === normalize(data.username))) {
            throw new Error("Ese nombre de usuario ya está en uso.");
        }

        const user = {
            id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            username: normalize(data.username),
            document: String(data.document).trim(),
            documentType: String(data.documentType || "Cédula de Ciudadanía"),
            firstName: String(data.firstName).trim(),
            lastName: String(data.lastName).trim(),
            name: `${String(data.firstName).trim()} ${String(data.lastName).trim()}`,
            email: normalize(data.email),
            phone: String(data.phone || "").trim(),
            role: String(data.role).trim(),
            picture: "logo_sena.png",
            passwordHash: await hashPassword(data.password)
        };
        saveStoredUser(user);
        return publicUser(user, "local");
    }

    async function updateLocalProfile(changes) {
        const session = getLocalSession();
        if (!session) throw new Error("Esta función requiere una cuenta local.");
        const user = getLocalUsers().find((item) => item.id === session.user.id);
        if (!user) throw new Error("No se encontró el usuario.");
        const updated = {
            ...user,
            firstName: String(changes.firstName || user.firstName).trim(),
            lastName: String(changes.lastName || user.lastName).trim(),
            email: normalize(changes.email || user.email)
        };
        updated.name = `${updated.firstName} ${updated.lastName}`.trim();
        saveStoredUser(updated);
        updateCurrentLocalSession(updated);
        renderUser(publicUser(updated, "local"));
        return publicUser(updated, "local");
    }

    async function changeLocalPassword(currentPassword, newPassword) {
        const session = getLocalSession();
        if (!session) throw new Error("Esta función requiere una cuenta local.");
        const user = getLocalUsers().find((item) => item.id === session.user.id);
        if (!user || user.passwordHash !== await hashPassword(currentPassword)) {
            throw new Error("La contraseña actual no es correcta.");
        }
        if (String(newPassword).length < 8) {
            throw new Error("La nueva contraseña debe tener al menos 8 caracteres.");
        }
        user.passwordHash = await hashPassword(newPassword);
        saveStoredUser(user);
    }

    async function logout() {
        setLoginBusy(true);
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY);
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
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY);

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
        createLocalUser,
        updateLocalProfile,
        changeLocalPassword,
        getLocalUsers: () => getLocalUsers().map((user) => publicUser(user, "local")),
        getCurrentUser: () => activeUser,
        logout
    });

    initialize();
})();
