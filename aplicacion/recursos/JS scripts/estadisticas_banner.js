(function () {
    "use strict";

    const banner = document.querySelector(".insight-banner-live");
    if (!banner) return;

    const attendanceValue = document.getElementById("insight-attendance");
    const attendanceDelta = document.getElementById("insight-attendance-delta");
    const attendanceRing = document.getElementById("insight-attendance-ring");
    const absenceValue = document.getElementById("insight-absence");
    const absenceDetail = document.getElementById("insight-absence-detail");
    const trendPath = document.getElementById("insight-trend-path");
    const trendPoints = document.getElementById("insight-trend-points");
    const bars = [...document.querySelectorAll("#insight-bars i")];
    const connectionCard = banner.querySelector(".insight-status");
    const syncText = document.getElementById("dashboard-sync");
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animationFrames = new WeakMap();


    function setConnectionState(online, message) {
        connectionCard?.classList.toggle("is-offline", !online);
        if (syncText && message) syncText.textContent = message;
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, Number(value) || 0));
    }

    function percent(value) {
        const number = clamp(value, 0, 100);
        return `${Number.isInteger(number) ? number : number.toFixed(1)}%`;
    }

    function animateNumber(element, from, to, suffix = "%") {
        if (!element) return;
        const currentFrame = animationFrames.get(element);
        if (currentFrame) window.cancelAnimationFrame(currentFrame);
        if (prefersReducedMotion.matches) {
            element.textContent = `${to.toFixed(1)}${suffix}`;
            return;
        }
        const start = performance.now();
        const duration = 720;
        const tick = (now) => {
            const progress = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            const value = from + (to - from) * eased;
            element.textContent = `${value.toFixed(1)}${suffix}`;
            if (progress < 1) animationFrames.set(element, window.requestAnimationFrame(tick));
            else animationFrames.delete(element);
        };
        animationFrames.set(element, window.requestAnimationFrame(tick));
    }

    function getDisplayedPercent(element) {
        return Number(String(element?.textContent || "0").replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
    }

    function buildSmoothPath(points) {
        if (!points.length) return "";
        if (points.length === 1) return `M${points[0][0]} ${points[0][1]}`;
        let path = `M${points[0][0]} ${points[0][1]}`;
        for (let i = 0; i < points.length - 1; i += 1) {
            const current = points[i];
            const next = points[i + 1];
            const previous = points[i - 1] || current;
            const after = points[i + 2] || next;
            const control1X = current[0] + (next[0] - previous[0]) / 6;
            const control1Y = current[1] + (next[1] - previous[1]) / 6;
            const control2X = next[0] - (after[0] - current[0]) / 6;
            const control2Y = next[1] - (after[1] - current[1]) / 6;
            path += ` C${control1X.toFixed(1)} ${control1Y.toFixed(1)} ${control2X.toFixed(1)} ${control2Y.toFixed(1)} ${next[0]} ${next[1]}`;
        }
        return path;
    }

    function renderTrend(trend) {
        const values = (trend || []).slice(-7).map((item) => item?.percentage == null ? null : clamp(item.percentage, 0, 100));
        const fallback = [42, 48, 55, 52, 64, 73, 81];
        const display = values.length ? values : fallback;
        const maxIndex = Math.max(1, display.length - 1);
        const points = [];

        bars.forEach((bar, index) => {
            const sourceIndex = Math.round(index / Math.max(1, bars.length - 1) * maxIndex);
            const value = display[sourceIndex];
            const safe = value == null ? 8 : Math.max(8, value);
            bar.style.setProperty("--bar-height", `${safe}%`);
            bar.classList.toggle("is-empty", value == null);
        });

        display.forEach((value, index) => {
            if (value == null) return;
            const x = 10 + index / maxIndex * 400;
            const y = 112 - value / 100 * 92;
            points.push([Number(x.toFixed(1)), Number(y.toFixed(1))]);
        });

        if (points.length >= 2) {
            trendPath.setAttribute("d", buildSmoothPath(points));
            trendPoints.innerHTML = points.map(([x, y], index) => `<circle cx="${x}" cy="${y}" r="${index === points.length - 1 ? 4.6 : 3.3}"></circle>`).join("");
            trendPath.classList.remove("is-drawing");
            void trendPath.getBoundingClientRect();
            trendPath.classList.add("is-drawing");
        }
    }

    function renderBanner(data) {
        if (!data) return;
        const hasRecords = Number(data.summary?.attendanceRecords) > 0;
        const attendance = hasRecords ? clamp(data.summary?.attendance, 0, 100) : 0;
        const absences = hasRecords ? clamp(data.distribution?.percentages?.ausente, 0, 100) : 0;
        const absentCount = Number(data.distribution?.counts?.ausente) || 0;
        const oldAttendance = getDisplayedPercent(attendanceValue);
        const oldAbsence = getDisplayedPercent(absenceValue);

        if (hasRecords) {
            animateNumber(attendanceValue, oldAttendance, attendance);
            animateNumber(absenceValue, oldAbsence, absences);
        } else {
            attendanceValue.textContent = "—";
            absenceValue.textContent = "—";
        }

        attendanceRing.style.setProperty("--metric-progress", String(attendance));
        attendanceRing.setAttribute("aria-label", hasRecords ? `${percent(attendance)} de asistencia` : "Sin registros de asistencia");

        const delta = data.summary?.attendanceDelta;
        if (delta == null || !hasRecords) {
            attendanceDelta.textContent = hasRecords ? "Sin comparación histórica" : "Sin registros en el periodo";
            attendanceDelta.className = "";
        } else {
            const direction = Number(delta) >= 0 ? "▲" : "▼";
            attendanceDelta.textContent = `${direction} ${Math.abs(Number(delta)).toFixed(1)} puntos vs. periodo anterior`;
            attendanceDelta.className = Number(delta) >= 0 ? "is-positive" : "is-negative";
        }

        absenceDetail.textContent = hasRecords
            ? `${absentCount} ${absentCount === 1 ? "registro ausente" : "registros ausentes"}`
            : "Sin registros en el periodo";

        renderTrend(data.trend);
        setConnectionState(true);
        banner.classList.add("has-live-data");
    }

    banner.addEventListener("pointermove", (event) => {
        const bounds = banner.getBoundingClientRect();
        banner.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
        banner.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
    });

    banner.addEventListener("pointerleave", () => {
        banner.style.removeProperty("--pointer-x");
        banner.style.removeProperty("--pointer-y");
    });

    banner.addEventListener("click", (event) => {
        const button = event.target.closest("[data-banner-target]");
        if (!button) return;
        const target = document.querySelector(button.dataset.bannerTarget);
        target?.scrollIntoView({ behavior: prefersReducedMotion.matches ? "auto" : "smooth", block: "center" });
    });

    window.addEventListener("dashboard:data", (event) => renderBanner(event.detail));
    window.addEventListener("offline", () => setConnectionState(false, "Sin conexión de red"));
    window.addEventListener("online", () => {
        setConnectionState(true, "Conexión recuperada · actualizando…");
        window.setTimeout(() => window.SenaDashboard?.refresh?.(), 150);
    });
    if (navigator.onLine === false) setConnectionState(false, "Sin conexión de red");
})();
