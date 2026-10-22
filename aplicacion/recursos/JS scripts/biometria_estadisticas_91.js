/* BioSecure 9.1 — Resumen de huellas exclusivo para administradores, sin datos sensibles. */
(function () {
    "use strict";
    const section = document.getElementById("dashboard-biometric-summary");
    const header = document.getElementById("dashboard-biometric-enroll-header");
    if (!section) return;
    const detail = document.getElementById("dashboard-biometric-detail");
    const count = document.getElementById("dashboard-biometric-count");
    const label = document.getElementById("dashboard-biometric-count-label");
    const refresh = document.getElementById("dashboard-biometric-refresh");
    let pending = false;

    async function update() {
        if (pending) return;
        pending = true;
        refresh.disabled = true;
        try {
            const response = await fetch("/api/biometria/resumen", {
                credentials: "same-origin", cache: "no-store"
            });
            const data = await response.json().catch(() => ({}));
            if (response.status === 403 || response.status === 401) {
                // No mostrar controles de enrolamiento a instructores, aprendices o accesos remotos.
                section.hidden = true;
                header.hidden = true;
                return;
            }
            section.hidden = false;
            header.hidden = false;
            if (!response.ok || data.correcto !== true) {
                count.textContent = "—";
                label.textContent = "Sin consultar";
                detail.textContent = data?.error?.mensaje || "No fue posible consultar los registros biométricos.";
                return;
            }
            const real = data.modo === "real" && data.registros_reales === true;
            count.textContent = String(data.registrados ?? 0);
            label.textContent = real ? "Huellas registradas" : "Registros de prueba";
            detail.textContent = real
                ? `${data.pendientes} pendientes de ${data.total_aprendices} aprendices · ${data.habilitado ? "Biometría configurada" : "Biometría deshabilitada"}. La detección del lector se comprueba al registrar.`
                : `Modo simulado: ${data.registrados} registros de prueba de ${data.total_aprendices} aprendices. No son huellas físicas.`;
        } catch (_error) {
            // La red puede estar fuera de servicio: no inventamos un resultado ni un lector conectado.
            if (!section.hidden) {
                count.textContent = "—";
                label.textContent = "Sin conexión";
                detail.textContent = "No se pudo consultar el servidor. Comprueba la conexión local.";
            }
        } finally {
            pending = false;
            refresh.disabled = false;
        }
    }

    refresh.addEventListener("click", update);
    window.addEventListener("focus", () => { if (!document.hidden) update(); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) update(); });
    update();
})();
