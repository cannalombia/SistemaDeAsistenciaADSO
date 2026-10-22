(function () {
    "use strict";

    function wait(milliseconds) {
        return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
    }

    async function resilientFetch(url, options = {}, settings = {}) {
        const method = String(options.method || "GET").toUpperCase();
        const retries = Number.isInteger(settings.retries) ? settings.retries : (method === "GET" || method === "HEAD" ? 1 : 0);
        const timeoutMs = settings.timeoutMs || 12000;
        let lastError = null;

        if (navigator.onLine === false) throw new Error("Sin conexión de red. Verifica la conexión y vuelve a intentar.");

        for (let attempt = 0; attempt <= retries; attempt += 1) {
            const controller = new AbortController();
            let timedOut = false;
            const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
            try {
                return await fetch(url, {
                    credentials: "same-origin",
                    cache: method === "GET" ? "no-store" : undefined,
                    ...options,
                    signal: controller.signal,
                    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
                });
            } catch (_error) {
                lastError = timedOut
                    ? new Error("El servidor tardó demasiado en responder. La consulta fue reintentada automáticamente.")
                    : new Error("No fue posible conectar con el servidor. La consulta fue reintentada automáticamente.");
                if (attempt < retries) await wait(450);
            } finally {
                window.clearTimeout(timeout);
            }
        }
        throw lastError || new Error("No fue posible completar la solicitud.");
    }

    async function request(url, options = {}) {
        const response = await resilientFetch(url, options);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || `No fue posible consultar los informes (error ${response.status}).`);
        return data;
    }

    async function download(id) {
        const response = await resilientFetch(`/api/reports/${encodeURIComponent(id)}/pdf`, {}, { retries: 1, timeoutMs: 20000 });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || "No se pudo descargar el PDF.");
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || "informe-asistencia.pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    window.SenaReports = {
        request,
        download,
        create: (filters) => request("/api/reports", { method: "POST", body: JSON.stringify(filters) }),
        archive: (id) => request(`/api/reports/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ action: "archive" }) }),
        restore: (id) => request(`/api/reports/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ action: "restore" }) }),
        remove: (id) => request(`/api/reports/${encodeURIComponent(id)}`, { method: "DELETE", body: JSON.stringify({ confirm: true }) })
    };
})();
