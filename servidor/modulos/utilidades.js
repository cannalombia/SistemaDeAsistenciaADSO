const crypto = require("crypto");

function normalizeEmail(value) {
    const email = String(value || "").trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : "";
}

function boundedInteger(value, fallback, minimum, maximum) {
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

function wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function maskEmail(value) {
    const email = normalizeEmail(value);
    if (!email) return "correo no válido";
    const [local, domain] = email.split("@");
    return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}

function readCookies(request) {
    return Object.fromEntries(String(request.headers.cookie || "").split(";").map((part) => {
        const index = part.indexOf("=");
        return index > 0 ? [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))] : ["", ""];
    }).filter(([key]) => key));
}

function safeEqual(left, right) {
    const a = Buffer.from(String(left));
    const b = Buffer.from(String(right));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { normalizeEmail, boundedInteger, wait, maskEmail, readCookies, safeEqual };
