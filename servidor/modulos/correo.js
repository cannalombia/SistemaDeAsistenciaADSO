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

function retryAfterMilliseconds(response) {
    const value = response.headers.get("retry-after");
    if (!value) return 0;
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(value);
    return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

function createEmailService(config, { appendHistory = () => {} } = {}) {
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

    async function sendVerificationCode(user, code, requestId) {
        const email = normalizeEmail(user.email);
        const from = config.emailFrom || (gmailTransport
            ? `Sistema SENA <${config.gmailUser}>`
            : "Sistema SENA <onboarding@resend.dev>");
        const message = verificationMessage(user, code, from);
        const startedAt = Date.now();
        try {
            const delivery = await runWithRetries(() => {
                if (config.emailSender) return config.emailSender(message);
                return provider === "gmail" ? sendWithGmail(message) : sendWithResend(message, requestId);
            });
            const providerMessageId = String(delivery.result?.id || delivery.result?.messageId || "");
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
        return { ...health };
    }

    return {
        provider,
        testMode,
        enqueueVerificationCode: (user, code, requestId) => enqueue(() => sendVerificationCode(user, code, requestId)),
        probe,
        getHealth
    };
}

module.exports = { createEmailService, verificationMessage };
