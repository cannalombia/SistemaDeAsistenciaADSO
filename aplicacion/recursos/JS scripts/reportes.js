(function () {
    "use strict";
    async function request(url, options = {}) {
        const response = await fetch(url, { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", ...options.headers } });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "No fue posible consultar los informes.");
        return data;
    }
    async function download(id) {
        const response = await fetch(`/api/reports/${encodeURIComponent(id)}/pdf`, { credentials: "same-origin" });
        if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || "No se pudo descargar el PDF."); }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || "informe-asistencia.pdf";
        document.body.appendChild(link); link.click(); link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    window.SenaReports = { request, download, create: (filters) => request("/api/reports", { method: "POST", body: JSON.stringify(filters) }) };
})();
