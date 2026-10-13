(function () {
    "use strict";

    if (window.__blueMagicFetchResilienceInstalled) return;
    window.__blueMagicFetchResilienceInstalled = true;

    const originalFetch = window.fetch.bind(window);
    const idempotencyCache = new Map();
    const IDEMPOTENCY_TTL_MS = 10000;

    function normalizedUrl(input) {
        try {
            const raw = typeof input === "string" ? input : input?.url;
            return new URL(raw, window.location.href);
        } catch (_) {
            return null;
        }
    }

    function methodOf(input, init) {
        return String(init?.method || input?.method || "GET").toUpperCase();
    }

    function bodyFingerprint(body) {
        if (body == null) return "";
        if (typeof body === "string") return body.slice(0, 5000);
        if (body instanceof URLSearchParams) return body.toString().slice(0, 5000);
        if (body instanceof FormData) {
            const parts = [];
            for (const [key, value] of body.entries()) {
                parts.push(`${key}:${value instanceof File ? `${value.name}:${value.size}:${value.lastModified}` : String(value)}`);
            }
            return parts.join("|").slice(0, 5000);
        }
        return Object.prototype.toString.call(body);
    }

    function idempotencyKeyFor(method, url, body) {
        const now = Date.now();
        for (const [key, item] of idempotencyCache) if (item.expiresAt <= now) idempotencyCache.delete(key);
        const fingerprint = `${method}|${url.pathname}${url.search}|${bodyFingerprint(body)}`;
        const existing = idempotencyCache.get(fingerprint);
        if (existing && existing.expiresAt > now) return existing.key;
        const key = `${Date.now().toString(36)}-${crypto.randomUUID()}`;
        idempotencyCache.set(fingerprint, { key, expiresAt: now + IDEMPOTENCY_TTL_MS });
        return key;
    }

    window.fetch = function resilientFetch(input, init = {}) {
        const url = normalizedUrl(input);
        if (!url || url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) {
            return originalFetch(input, init);
        }

        const method = methodOf(input, init);
        const headers = new Headers(init.headers || input?.headers || {});
        if (!headers.has("X-Request-Id")) headers.set("X-Request-Id", crypto.randomUUID());

        const isMutation = ["POST", "PATCH", "DELETE"].includes(method);
        const authRoute = url.pathname.startsWith("/api/auth/");
        if (isMutation && !authRoute && !headers.has("Idempotency-Key")) {
            headers.set("Idempotency-Key", idempotencyKeyFor(method, url, init.body));
        }

        return originalFetch(input, { ...init, headers });
    };
})();
