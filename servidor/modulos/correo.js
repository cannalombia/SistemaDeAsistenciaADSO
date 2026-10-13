const nodemailer = require("nodemailer");
const { normalizeEmail, wait, maskEmail } = require("./utilidades");

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[character]));
}

function shortName(value) {
    return String(value || "Usuario")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
}

function verificationMessage(user, code, from) {
    const email = normalizeEmail(user.email);
    const name = shortName(user.name);
    const safeName = escapeHtml(name);
    const safeCode = escapeHtml(code);
    return {
        from,
        to: [email],
        subject: "Tu código de acceso al Sistema SENA",
        text: `Hola ${name},\n\nTu código de acceso es:\n\n${code}\n\nExpira en 10 minutos.\n\nSi no solicitaste este código, ignora este mensaje.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:30px;color:#263238;border:1px solid #e5ece8;border-radius:18px"><h2 style="margin:0 0 24px;color:#39b54a">Sistema de Asistencia SENA</h2><p>Hola ${safeName},</p><p>Tu código de acceso es:</p><p style="font-size:36px;font-weight:800;letter-spacing:9px;margin:26px 0;color:#00304d">${safeCode}</p><p><strong>Expira en 10 minutos.</strong></p><p style="margin-top:28px;color:#68737a;font-size:13px">Si no solicitaste este código, ignora este mensaje.</p></div>`
    };
}

function passwordRecoveryMessage(user, code, from) {
    const email = normalizeEmail(user.email);
    const name = shortName(user.name);
    const safeName = escapeHtml(name);
    const safeCode = escapeHtml(code);
    return {
        from,
        to: [email],
        subject: "Código para recuperar el acceso administrativo",
        text: `Hola ${name},\n\nRecibimos una solicitud para cambiar la contraseña administrativa. Tu código de recuperación es:\n\n${code}\n\nExpira en 10 minutos y solo puede usarse una vez.\n\nSi no solicitaste este cambio, ignora este mensaje y conserva tu contraseña actual.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:30px;color:#263238;border:1px solid #e5ece8;border-radius:18px"><h2 style="margin:0 0 24px;color:#39b54a">Recuperación administrativa</h2><p>Hola ${safeName},</p><p>Recibimos una solicitud para cambiar la contraseña administrativa. Tu código de recuperación es:</p><p style="font-size:36px;font-weight:800;letter-spacing:9px;margin:26px 0;color:#00304d">${safeCode}</p><p><strong>Expira en 10 minutos y solo puede usarse una vez.</strong></p><p style="margin-top:28px;color:#68737a;font-size:13px">Si no solicitaste este cambio, ignora este mensaje y conserva tu contraseña actual.</p></div>`
    };
}

function retryAfterMilliseconds(response) {
    const value = response.headers.get("retry-after");
    if (!value) return 0;
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(value);
    return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

function createEmailService(config, { appendHistory = () => {}, outbox = null } = {}) {
    const provider = config.emailProvider || (config.gmailUser && config.gmailAppPassword ? "gmail" : "resend");
    const gmailTransport = provider === "gmail" && config.gmailUser && config.gmailAppPassword
        ? nodemailer.createTransport({
            service: "gmail",
            auth: { user: config.gmailUser, pass: config.gmailAppPassword },
            connectionTimeout: config.emailTimeoutMs,
            greetingTimeout: config.emailTimeoutMs,
            socketTimeout: config.emailTimeoutMs * 2
        })
        : null;
    const senderAddress = normalizeEmail((String(config.emailFrom).match(/<([^>]+)>/) || [])[1] || config.emailFrom);
    const testMode = provider === "resend" && senderAddress.endsWith("@resend.dev");
    let deliveryTail = Promise.resolve();
    let lastDeliveryStartedAt = 0;
    let health = {
        configured: Boolean(config.emailSender) || (provider === "gmail" ? Boolean(gmailTransport) : Boolean(config.resendApiKey)),
        ready: null,
        checkedAt: null,
        message: "Validación pendiente."
    };
    const circuitFailureThreshold = Math.max(2, Math.min(10, Number(config.emailCircuitFailureThreshold) || 5));
    const circuitResetMs = Math.max(5000, Math.min(5 * 60 * 1000, Number(config.emailCircuitResetMs) || 30000));
    const circuit = { state: "closed", failures: 0, openedAt: 0, halfOpenProbe: false };

    function circuitSnapshot() {
        const retryInMs = circuit.state === "open" ? Math.max(0, circuitResetMs - (Date.now() - circuit.openedAt)) : 0;
        return { state: circuit.state, failures: circuit.failures, threshold: circuitFailureThreshold, resetMs: circuitResetMs, retryInMs };
    }

    function assertCircuitAllows() {
        if (circuit.state !== "open") return;
        if (Date.now() - circuit.openedAt < circuitResetMs) {
            throw Object.assign(new Error("El proveedor de correo está temporalmente aislado por protección automática. Intenta nuevamente en unos segundos."), {
                status: 503, retryable: false, errorCode: "circuit_open"
            });
        }
        circuit.state = "half_open";
        circuit.halfOpenProbe = true;
    }

    function circuitSucceeded() {
        circuit.state = "closed";
        circuit.failures = 0;
        circuit.openedAt = 0;
        circuit.halfOpenProbe = false;
    }

    function circuitFailed() {
        circuit.failures += 1;
        if (circuit.state === "half_open" || circuit.failures >= circuitFailureThreshold) {
            circuit.state = "open";
            circuit.openedAt = Date.now();
            circuit.halfOpenProbe = false;
        }
    }

    async function runWithRetries(operation) {
        let lastError;
        for (let attempt = 1; attempt <= config.emailMaxAttempts; attempt += 1) {
            try {
                return { result: await operation(attempt), attempts: attempt };
            } catch (error) {
                lastError = error;
                lastError.deliveryAttempts = attempt;
                if (error.retryable !== true || attempt >= config.emailMaxAttempts) throw lastError;
                const exponential = config.emailRetryBaseMs * (2 ** (attempt - 1));
                const delay = Math.min(10000, Math.max(error.retryAfterMs || 0, exponential + Math.floor(Math.random() * 120)));
                await wait(delay);
            }
        }
        throw lastError;
    }

    function enqueue(operation) {
        const execute = async () => {
            const elapsed = Date.now() - lastDeliveryStartedAt;
            const delay = Math.max(0, config.emailMinIntervalMs - elapsed);
            if (delay) await wait(delay);
            lastDeliveryStartedAt = Date.now();
            return operation();
        };
        const queued = deliveryTail.then(execute, execute);
        deliveryTail = queued.catch(() => {});
        return queued;
    }

    async function sendWithResend(message, requestId) {
        if (!config.resendApiKey) {
            throw Object.assign(new Error("El envío por Resend no está configurado. Agrega RESEND_API_KEY en el archivo .env y reinicia el servidor."), { status: 503, retryable: false, errorCode: "not_configured" });
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), config.emailTimeoutMs);
        let response;
        try {
            response = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${config.resendApiKey}`,
                    "Content-Type": "application/json",
                    "User-Agent": "sena-attendance/1.0",
                    "Idempotency-Key": `sena-otp-${requestId}`
                },
                body: JSON.stringify(message),
                signal: controller.signal
            });
        } catch (error) {
            const timedOut = error?.name === "AbortError" || controller.signal.aborted;
            throw Object.assign(new Error(timedOut
                ? "El servicio de correo tardó demasiado en responder. El sistema volverá a intentarlo automáticamente."
                : "No fue posible conectar con el servicio de correo. El sistema volverá a intentarlo automáticamente."), {
                status: 502,
                retryable: true,
                errorCode: timedOut ? "timeout" : "network"
            });
        } finally {
            clearTimeout(timeout);
        }
        const payload = await response.json().catch(() => ({}));
        if (response.ok) return payload;

        const detail = String(payload.message || payload.name || "").trim();
        const testDomainRestriction = response.status === 403 && /testing emails|verify a domain|resend\.dev/i.test(detail);
        const messageText = testDomainRestriction
            ? "El remitente de Resend está en modo de prueba y no puede escribir a este destinatario. Configura un dominio verificado o Gmail en .env."
            : response.status === 401 || response.status === 403
                ? "Resend rechazó la autorización. Verifica la clave y el dominio remitente configurados."
                : response.status === 429
                    ? "El servicio de correo está temporalmente limitado. El sistema volverá a intentarlo."
                    : `No fue posible enviar el correo${detail ? `: ${detail}` : "."}`;
        const retryable = [408, 409, 425, 429].includes(response.status) || response.status >= 500;
        throw Object.assign(new Error(messageText), {
            status: retryable ? 503 : 502,
            retryable,
            retryAfterMs: retryAfterMilliseconds(response),
            errorCode: String(payload.name || `resend_${response.status}`),
            providerStatus: response.status
        });
    }

    async function sendWithGmail(message) {
        if (!gmailTransport) {
            throw Object.assign(new Error("El envío por Gmail no está configurado. Completa GMAIL_USER y GMAIL_APP_PASSWORD en el archivo .env y reinicia el servidor."), { status: 503, retryable: false, errorCode: "not_configured" });
        }
        try {
            return await gmailTransport.sendMail({ ...message, to: message.to[0] });
        } catch (error) {
            const authenticationError = error && ["EAUTH", "EENVELOPE"].includes(error.code);
            throw Object.assign(new Error(authenticationError
                ? "Gmail rechazó el acceso. Verifica el correo remitente y la contraseña de aplicación de 16 caracteres."
                : "Gmail no pudo enviar el código. El sistema volverá a intentarlo automáticamente."), {
                status: 502,
                retryable: !authenticationError,
                errorCode: String(error?.code || "gmail_error")
            });
        }
    }

    async function sendCode(user, code, requestId, createMessage, options = {}) {
        const email = normalizeEmail(user.email);
        const from = config.emailFrom || (gmailTransport
            ? `Sistema SENA <${config.gmailUser}>`
            : "Sistema SENA <onboarding@resend.dev>");
        const message = createMessage(user, code, from);
        const startedAt = Date.now();
        const expiresAt = Number(options.expiresAt) || (Date.now() + 10 * 60 * 1000);
        if (outbox?.enqueue) {
            await outbox.enqueue({ requestId, provider, recipient: email, payload: message, expiresAt });
        }
        try {
            assertCircuitAllows();
            const delivery = await runWithRetries(() => {
                if (config.emailSender) return config.emailSender(message);
                return provider === "gmail" ? sendWithGmail(message) : sendWithResend(message, requestId);
            });
            circuitSucceeded();
            const providerMessageId = String(delivery.result?.id || delivery.result?.messageId || "");
            if (outbox?.mark) {
                try { await outbox.mark(requestId, "sent", { incrementAttempts: delivery.attempts }); } catch (error) { console.error("No se pudo confirmar el outbox de correo:", error.message); }
            }
            appendHistory({
                requestId,
                recipient: maskEmail(email),
                provider,
                status: "accepted",
                attempts: delivery.attempts,
                durationMs: Date.now() - startedAt,
                providerMessageId: providerMessageId || null
            });
            health = {
                configured: true,
                ready: true,
                checkedAt: new Date().toISOString(),
                message: "Último envío aceptado correctamente."
            };
            return delivery.result;
        } catch (error) {
            circuitFailed();
            if (outbox?.mark) {
                try { await outbox.mark(requestId, "failed", { incrementAttempts: error.deliveryAttempts || 1, error: error.message }); } catch (outboxError) { console.error("No se pudo actualizar el outbox fallido:", outboxError.message); }
            }
            appendHistory({
                requestId,
                recipient: maskEmail(email),
                provider,
                status: "failed",
                attempts: error.deliveryAttempts || 1,
                durationMs: Date.now() - startedAt,
                errorCode: error.errorCode || "delivery_error",
                message: error.message
            });
            health = {
                configured: true,
                ready: false,
                checkedAt: new Date().toISOString(),
                message: error.message
            };
            throw error;
        }
    }

    async function deliverPreparedOutboxItem(item) {
        if (!item || !item.payload || !item.requestId) return false;
        if (Number(item.expiresAt) <= Date.now()) {
            await outbox?.mark?.(item.requestId, "expired", { error: "El correo caducó antes de ser enviado." });
            return false;
        }
        const startedAt = Date.now();
        try {
            assertCircuitAllows();
            const delivery = await runWithRetries(() => {
                if (config.emailSender) return config.emailSender(item.payload);
                return provider === "gmail" ? sendWithGmail(item.payload) : sendWithResend(item.payload, item.requestId);
            });
            circuitSucceeded();
            await outbox?.mark?.(item.requestId, "sent", { incrementAttempts: delivery.attempts });
            appendHistory({ requestId: item.requestId, recipient: maskEmail(item.recipient), provider, status: "accepted", attempts: delivery.attempts, durationMs: Date.now() - startedAt, recoveredFromOutbox: true });
            return true;
        } catch (error) {
            circuitFailed();
            await outbox?.mark?.(item.requestId, "failed", { incrementAttempts: error.deliveryAttempts || 1, error: error.message });
            appendHistory({ requestId: item.requestId, recipient: maskEmail(item.recipient), provider, status: "failed", attempts: error.deliveryAttempts || 1, durationMs: Date.now() - startedAt, errorCode: error.errorCode || "delivery_error", message: error.message, recoveredFromOutbox: true });
            return false;
        }
    }

    async function drainOutbox(limit = 20) {
        if (!outbox?.listPending) return { processed: 0, sent: 0 };
        const items = await outbox.listPending(limit);
        let sent = 0;
        for (const item of items) if (await deliverPreparedOutboxItem(item)) sent += 1;
        return { processed: items.length, sent };
    }

    async function probe() {
        const checkedAt = new Date().toISOString();
        if (config.emailSender) {
            health = { configured: true, ready: true, checkedAt, message: "Proveedor de correo de prueba disponible." };
            return getHealth();
        }
        if (provider === "gmail") {
            if (!gmailTransport) {
                health = { configured: false, ready: false, checkedAt, message: "Falta configurar Gmail." };
                return getHealth();
            }
            try {
                await gmailTransport.verify();
                health = { configured: true, ready: true, checkedAt, message: "Gmail autenticado y disponible." };
            } catch (_error) {
                health = { configured: true, ready: false, checkedAt, message: "Gmail no pudo validar las credenciales o la conexión." };
            }
            return getHealth();
        }
        if (!config.resendApiKey) {
            health = { configured: false, ready: false, checkedAt, message: "Falta configurar Resend." };
            return getHealth();
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), config.emailTimeoutMs);
        try {
            const response = await fetch("https://api.resend.com/domains", {
                headers: { "Authorization": `Bearer ${config.resendApiKey}`, "User-Agent": "sena-attendance/1.0" },
                signal: controller.signal
            });
            const payload = await response.json().catch(() => ({}));
            const sendOnlyKey = response.status === 401 && payload.name === "restricted_api_key";
            const ready = response.ok || sendOnlyKey;
            health = {
                configured: true,
                ready,
                checkedAt,
                message: ready ? "Resend autenticado y disponible." : "Resend rechazó la clave configurada."
            };
        } catch (_error) {
            health = { configured: true, ready: false, checkedAt, message: "No hay conexión con Resend." };
        } finally {
            clearTimeout(timeout);
        }
        return getHealth();
    }

    function getHealth() {
        return { ...health, circuit: circuitSnapshot() };
    }

    return {
        provider,
        testMode,
        enqueueVerificationCode: (user, code, requestId, options) => enqueue(() => sendCode(user, code, requestId, verificationMessage, options)),
        enqueuePasswordRecoveryCode: (user, code, requestId, options) => enqueue(() => sendCode(user, code, requestId, passwordRecoveryMessage, options)),
        drainOutbox,
        probe,
        getHealth
    };
}

module.exports = { createEmailService, verificationMessage, passwordRecoveryMessage };
