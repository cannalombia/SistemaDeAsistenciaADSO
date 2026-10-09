(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root?.document) api.mount(root);
})(typeof window !== "undefined" ? window : null, function () {
    "use strict";

    const STATUS_ORDER = ["presente", "tardanza", "ausente", "justificado"];
    const STATUS_META = {
        presente: { label: "Presentes", short: "P", color: "#2fbf61" },
        tardanza: { label: "Tardanzas", short: "T", color: "#f3ad24" },
        ausente: { label: "Ausentes", short: "A", color: "#ef5965" },
        justificado: { label: "Justificados", short: "J", color: "#3f7fe5" }
    };

    function numeric(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    function sortComposition(items, sortKey = "attendance-desc", selectedStatus = null) {
        const list = [...(items || [])];
        const compareBase = (left, right) => {
            if (sortKey === "attendance-asc") return numeric(left.attendance) - numeric(right.attendance);
            if (sortKey === "absences") return numeric(right.counts?.ausente) - numeric(left.counts?.ausente);
            if (sortKey === "tardiness") return numeric(right.counts?.tardanza) - numeric(left.counts?.tardanza);
            return numeric(right.attendance) - numeric(left.attendance);
        };
        list.sort((left, right) => {
            if (selectedStatus && STATUS_META[selectedStatus]) {
                const selectedDifference = numeric(right.counts?.[selectedStatus]) - numeric(left.counts?.[selectedStatus]);
                if (selectedDifference) return selectedDifference;
            }
            const base = compareBase(left, right);
            if (base) return base;
            return String(left.ficha || "").localeCompare(String(right.ficha || ""), "es", { numeric: true });
        });
        return list;
    }

    function limitComposition(items, limitValue) {
        if (limitValue === "all") return [...(items || [])];
        const limit = Math.max(1, numeric(limitValue) || 5);
        return [...(items || [])].slice(0, limit);
    }

    function nearestIndex(pointerX, left, usableWidth, itemCount) {
        if (itemCount <= 1) return 0;
        const ratio = Math.min(1, Math.max(0, (pointerX - left) / Math.max(1, usableWidth)));
        return Math.round(ratio * (itemCount - 1));
    }

    function mount(windowObject) {
        const document = windowObject.document;
        const chart = document.getElementById("daily-chart");
        const tooltip = document.getElementById("daily-tooltip");
        const chartDetail = document.getElementById("chart-detail");
        const donut = document.getElementById("statistics-donut");
        const distribution = document.getElementById("statistics-distribution");
        const composition = document.getElementById("dashboard-composition");
        const compositionCount = document.getElementById("composition-count");
        const compositionLimit = document.getElementById("dashboard-composition-limit");
        const compositionSort = document.getElementById("dashboard-composition-sort");
        const selectionBar = document.getElementById("analytics-selection-bar");
        const selectionChips = document.getElementById("analytics-selection-chips");
        const clearSelectionButton = document.getElementById("analytics-clear-selection");
        if (!chart || !donut || !distribution || !composition) return;

        const reducedMotion = windowObject.matchMedia?.("(prefers-reduced-motion: reduce)") || { matches: false };
        const state = {
            data: null,
            selection: { estado: null, ficha: null, dia: null },
            focusIndex: 0,
            hoverIndex: null,
            layout: null,
            resizeFrame: 0
        };

        const svgNs = "http://www.w3.org/2000/svg";
        const createSvg = (name, attributes = {}) => {
            const element = document.createElementNS(svgNs, name);
            Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
            return element;
        };
        const create = (name, className, text) => {
            const element = document.createElement(name);
            if (className) element.className = className;
            if (text !== undefined) element.textContent = text;
            return element;
        };
        const formatDate = (value, options = { day: "numeric", month: "short" }) => new Intl.DateTimeFormat("es-CO", options).format(new Date(`${value}T12:00:00`)).replace(".", "");
        const formatPercent = (value) => {
            const number = numeric(value);
            return `${Number.isInteger(number) ? number : number.toFixed(1)}%`;
        };
        const formatNumber = (value) => new Intl.NumberFormat("es-CO").format(numeric(value));

        function updateChartDetail(day) {
            if (!day) {
                chartDetail.textContent = "Los días sin registro se muestran como un hueco, nunca como 0 %.";
                return;
            }
            if (!day.total) {
                chartDetail.textContent = `${formatDate(day.date, { day: "numeric", month: "long", year: "numeric" })} · Sin registros guardados.`;
                return;
            }
            chartDetail.textContent = `${formatDate(day.date, { day: "numeric", month: "long", year: "numeric" })} · ${day.counts.presente} presentes, ${day.counts.tardanza} tardanzas, ${day.counts.ausente} ausentes y ${day.counts.justificado} justificados · ${formatPercent(day.attendance ?? day.percentage)} de asistencia.`;
        }

        function contiguousSegments(days, pointFor) {
            const segments = [];
            let current = [];
            days.forEach((day, index) => {
                if (!day.total || day.percentage === null) {
                    if (current.length) segments.push(current);
                    current = [];
                    return;
                }
                current.push(pointFor(day, index));
            });
            if (current.length) segments.push(current);
            return segments;
        }

        function renderTimeline(animate = false) {
            const days = state.data?.timeline || [];
            chart.replaceChildren();
            tooltip.hidden = true;
            state.layout = null;
            if (!days.length || !days.some((day) => day.total)) {
                const empty = create("div", "analytics-empty");
                const title = create("strong", "", "Sin registros en el periodo");
                const text = create("span", "", "Cuando exista asistencia guardada, la evolución aparecerá aquí.");
                empty.append(title, text);
                chart.append(empty);
                updateChartDetail(null);
                return;
            }

            const containerWidth = Math.max(620, chart.clientWidth || 760);
            const width = Math.max(containerWidth, Math.min(5200, days.length * 16 + 88));
            const height = 282;
            const margins = { left: 48, right: 24, top: 24, bottom: 42 };
            const usableWidth = width - margins.left - margins.right;
            const usableHeight = height - margins.top - margins.bottom;
            const xFor = (index) => margins.left + (days.length === 1 ? usableWidth / 2 : index / (days.length - 1) * usableWidth);
            const yFor = (percentage) => margins.top + (100 - numeric(percentage)) / 100 * usableHeight;
            const maxTotal = Math.max(1, ...days.map((day) => numeric(day.total)));
            const baseline = margins.top + usableHeight;

            const svg = createSvg("svg", { viewBox: `0 0 ${width} ${height}`, width, height, role: "img", "aria-label": "Evolución diaria de la asistencia" });
            svg.classList.add("analytics-line-chart");

            [0, 25, 50, 75, 100].forEach((value) => {
                const y = yFor(value);
                const line = createSvg("line", { x1: margins.left, x2: width - margins.right, y1: y, y2: y });
                line.classList.add("analytics-grid-line");
                const label = createSvg("text", { x: margins.left - 9, y: y + 4, "text-anchor": "end" });
                label.classList.add("analytics-axis-label");
                label.textContent = `${value}%`;
                svg.append(line, label);
            });

            days.forEach((day, index) => {
                const x = xFor(index);
                const total = numeric(day.total);
                if (total) {
                    const barHeight = Math.max(3, total / maxTotal * 54);
                    const bar = createSvg("rect", { x: x - 4.5, y: baseline - barHeight, width: 9, height: barHeight, rx: 3 });
                    bar.classList.add("analytics-volume-bar");
                    if (state.selection.estado && numeric(day.counts?.[state.selection.estado]) > 0) {
                        bar.classList.add(`state-${state.selection.estado}`, "is-state-match");
                    }
                    svg.append(bar);
                }
                const labelEvery = days.length > 90 ? 30 : days.length > 45 ? 14 : days.length > 20 ? 7 : 1;
                if (index % labelEvery === 0 || index === days.length - 1) {
                    const label = createSvg("text", { x, y: height - 15, "text-anchor": "middle" });
                    label.classList.add("analytics-date-label");
                    label.textContent = formatDate(day.date);
                    svg.append(label);
                }
            });

            const segments = contiguousSegments(days, (day, index) => ({ x: xFor(index), y: yFor(day.percentage), index }));
            segments.forEach((segment) => {
                if (!segment.length) return;
                const linePath = segment.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
                if (segment.length > 1) {
                    const areaPath = `${linePath} L${segment.at(-1).x.toFixed(1)} ${baseline} L${segment[0].x.toFixed(1)} ${baseline} Z`;
                    const area = createSvg("path", { d: areaPath });
                    area.classList.add("analytics-area");
                    svg.append(area);
                }
                const path = createSvg("path", { d: linePath, "pathLength": 1 });
                path.classList.add("analytics-line");
                if (animate && !reducedMotion.matches) path.classList.add("is-entering");
                svg.append(path);
            });

            days.forEach((day, index) => {
                if (!day.total || day.percentage === null) return;
                const point = createSvg("circle", { cx: xFor(index), cy: yFor(day.percentage), r: state.selection.dia === day.date ? 6 : 4 });
                point.classList.add("analytics-point");
                if (state.selection.dia === day.date) point.classList.add("is-selected-day");
                if (state.selection.estado && numeric(day.counts?.[state.selection.estado]) > 0) point.classList.add(`state-${state.selection.estado}`, "is-state-match");
                svg.append(point);
            });

            if (state.selection.dia) {
                const selectedIndex = days.findIndex((day) => day.date === state.selection.dia);
                if (selectedIndex >= 0) {
                    const x = xFor(selectedIndex);
                    const guide = createSvg("line", { x1: x, x2: x, y1: margins.top, y2: baseline });
                    guide.classList.add("analytics-selected-guide");
                    svg.append(guide);
                }
            }

            chart.append(svg);
            state.layout = { svg, width, height, margins, usableWidth, usableHeight, xFor, yFor, baseline, days };
            const selected = state.selection.dia ? days.find((day) => day.date === state.selection.dia) : null;
            updateChartDetail(selected);
        }

        function showTooltip(index, event = null) {
            const layout = state.layout;
            if (!layout || !layout.days.length) return;
            const day = layout.days[Math.max(0, Math.min(layout.days.length - 1, index))];
            state.hoverIndex = index;
            tooltip.replaceChildren();
            const title = create("strong", "", formatDate(day.date, { day: "numeric", month: "long", year: "numeric" }));
            tooltip.append(title);
            if (!day.total) {
                tooltip.append(create("span", "", "Sin registros"));
            } else {
                const rows = [
                    ["Presentes", day.counts.presente], ["Tardanzas", day.counts.tardanza],
                    ["Ausentes", day.counts.ausente], ["Justificados", day.counts.justificado],
                    ["Total", day.total], ["Asistencia", formatPercent(day.attendance ?? day.percentage)]
                ];
                rows.forEach(([label, value]) => {
                    const row = create("span", "analytics-tooltip-row");
                    row.append(create("b", "", label), create("em", "", String(value)));
                    tooltip.append(row);
                });
            }
            tooltip.hidden = false;
            if (event) {
                const chartRect = chart.getBoundingClientRect();
                tooltip.style.left = `${Math.min(chart.clientWidth - 190, Math.max(8, event.clientX - chartRect.left + 12))}px`;
                tooltip.style.top = `${Math.max(8, event.clientY - chartRect.top - 20)}px`;
            } else {
                const x = layout.xFor(index) - chart.scrollLeft;
                const y = day.total && day.percentage !== null ? layout.yFor(day.percentage) : layout.baseline;
                tooltip.style.left = `${Math.min(chart.clientWidth - 190, Math.max(8, x + 10))}px`;
                tooltip.style.top = `${Math.max(8, y - 42)}px`;
            }
            updateChartDetail(day);
        }

        function pointerIndex(event) {
            if (!state.layout) return null;
            const rect = chart.getBoundingClientRect();
            const localX = event.clientX - rect.left + chart.scrollLeft;
            return nearestIndex(localX, state.layout.margins.left, state.layout.usableWidth, state.layout.days.length);
        }

        function renderDistribution(animate = false) {
            const summary = state.data?.distribution;
            donut.replaceChildren();
            distribution.replaceChildren();
            if (!summary?.total) {
                const empty = create("div", "analytics-empty compact");
                empty.append(create("strong", "", "Sin registros"), create("span", "", "No hay estados para distribuir."));
                donut.append(empty);
                return;
            }

            const size = 184;
            const center = 92;
            const radius = 70;
            const circumference = 2 * Math.PI * radius;
            const svg = createSvg("svg", { viewBox: `0 0 ${size} ${size}`, role: "img", "aria-label": `Distribución de ${summary.total} registros` });
            svg.classList.add("analytics-donut-svg");
            const track = createSvg("circle", { cx: center, cy: center, r: radius });
            track.classList.add("analytics-donut-track");
            svg.append(track);
            let offset = 0;
            STATUS_ORDER.forEach((status) => {
                const count = numeric(summary.counts?.[status]);
                if (!count) return;
                const length = count / summary.total * circumference;
                const segment = createSvg("circle", {
                    cx: center, cy: center, r: radius,
                    "stroke-dasharray": `${reducedMotion.matches || !animate ? length : 0} ${circumference}`,
                    "stroke-dashoffset": -offset
                });
                segment.classList.add("analytics-donut-segment", `state-${status}`);
                segment.style.setProperty("--segment-length", String(length));
                segment.style.setProperty("--circumference", String(circumference));
                if (state.selection.estado && state.selection.estado !== status) segment.classList.add("is-dimmed");
                svg.append(segment);
                if (animate && !reducedMotion.matches) {
                    windowObject.requestAnimationFrame(() => windowObject.requestAnimationFrame(() => segment.setAttribute("stroke-dasharray", `${length} ${circumference}`)));
                }
                offset += length;
            });

            const totalText = createSvg("text", { x: center, y: 82, "text-anchor": "middle" });
            totalText.classList.add("donut-total");
            totalText.textContent = formatNumber(summary.total);
            const totalLabel = createSvg("text", { x: center, y: 101, "text-anchor": "middle" });
            totalLabel.classList.add("donut-label");
            totalLabel.textContent = "registros";
            const attendanceText = createSvg("text", { x: center, y: 122, "text-anchor": "middle" });
            attendanceText.classList.add("donut-attendance");
            attendanceText.textContent = `${formatPercent(summary.attendance)} asistencia`;
            svg.append(totalText, totalLabel, attendanceText);
            donut.append(svg);

            const sum = STATUS_ORDER.reduce((total, status) => total + numeric(summary.counts?.[status]), 0);
            if (sum !== numeric(summary.total)) console.warn("[Estadísticas] La suma de estados no coincide con el total del periodo.", { total: summary.total, sum });

            STATUS_ORDER.forEach((status) => {
                const meta = STATUS_META[status];
                const button = create("button", "distribution-option");
                button.type = "button";
                button.dataset.status = status;
                button.setAttribute("aria-pressed", String(state.selection.estado === status));
                button.title = `Filtrar visualmente por ${meta.label.toLocaleLowerCase("es")}`;
                const marker = create("span", `status-marker state-${status}`, meta.short);
                const label = create("span", "distribution-label", meta.label);
                const count = create("strong", "", formatNumber(summary.counts?.[status]));
                const percentage = create("small", "", formatPercent(summary.percentages?.[status]));
                button.append(marker, label, count, percentage);
                distribution.append(button);
            });
        }

        function renderComposition(animate = false) {
            const items = state.data?.composition || [];
            const sorted = sortComposition(items, compositionSort?.value || "attendance-desc", state.selection.estado);
            const visible = limitComposition(sorted, compositionLimit?.value || "5");
            const render = () => {
                composition.replaceChildren();
                if (!visible.length) {
                    const empty = create("div", "analytics-empty");
                    empty.append(create("strong", "", "Sin registros por ficha"), create("span", "", "No hay composición disponible para este periodo."));
                    composition.append(empty);
                } else {
                    visible.forEach((item) => {
                        const row = create("button", "composition-row-pro");
                        row.type = "button";
                        row.dataset.ficha = String(item.ficha || "");
                        row.setAttribute("role", "option");
                        row.setAttribute("aria-selected", String(state.selection.ficha === String(item.ficha || "")));
                        if (state.selection.estado && numeric(item.counts?.[state.selection.estado]) > 0) row.classList.add("is-state-match");

                        const identity = create("span", "composition-identity");
                        identity.append(create("strong", "", String(item.ficha || "Sin ficha")), create("small", "", item.programa || "Programa no disponible"));
                        const bar = create("span", "composition-bar-pro");
                        STATUS_ORDER.forEach((status) => {
                            const percentage = numeric(item.percentages?.[status]);
                            if (!percentage) return;
                            const segment = create("span", `composition-segment-pro state-${status}`);
                            segment.style.width = `${percentage}%`;
                            segment.setAttribute("aria-label", `${STATUS_META[status].label}: ${formatPercent(percentage)}`);
                            if (state.selection.estado && state.selection.estado !== status) segment.classList.add("is-dimmed");
                            if (percentage >= 12) segment.textContent = `${Math.round(percentage)}%`;
                            bar.append(segment);
                        });
                        const rate = create("span", "composition-rate-pro");
                        rate.append(create("strong", "", formatPercent(item.attendance)), create("small", "", `${formatNumber(item.total)} registros`));
                        row.append(identity, bar, rate);
                        composition.append(row);
                    });
                }
                if (compositionCount) compositionCount.textContent = `${items.length} ficha${items.length === 1 ? "" : "s"} con registros · mostrando ${visible.length}`;
            };

            if (animate && !reducedMotion.matches && typeof document.startViewTransition === "function") document.startViewTransition(render);
            else render();
        }

        function renderSelectionBar() {
            if (!selectionBar || !selectionChips) return;
            selectionChips.replaceChildren();
            const selected = [];
            if (state.selection.estado) selected.push({ type: "estado", label: `Estado: ${STATUS_META[state.selection.estado].label}` });
            if (state.selection.ficha) selected.push({ type: "ficha", label: `Ficha: ${state.selection.ficha}` });
            if (state.selection.dia) selected.push({ type: "dia", label: `Día: ${formatDate(state.selection.dia)}` });
            selectionBar.hidden = selected.length === 0;
            selected.forEach((item) => {
                const chip = create("button", "analytics-chip", `${item.label} ×`);
                chip.type = "button";
                chip.dataset.clearSelection = item.type;
                chip.setAttribute("aria-label", `Quitar ${item.label}`);
                selectionChips.append(chip);
            });
        }

        function renderAll(animate = false) {
            if (!state.data) return;
            const days = state.data.timeline || [];
            if (state.selection.dia && !days.some((day) => day.date === state.selection.dia)) state.selection.dia = null;
            state.selection.ficha = state.data.filters?.ficha || null;
            renderTimeline(animate);
            renderDistribution(animate);
            renderComposition(animate);
            renderSelectionBar();
        }

        async function clearSelection(type = "all") {
            const clearFicha = type === "all" || type === "ficha";
            if (type === "all" || type === "estado") state.selection.estado = null;
            if (type === "all" || type === "dia") state.selection.dia = null;
            if (clearFicha && state.selection.ficha) {
                state.selection.ficha = null;
                renderSelectionBar();
                await windowObject.SenaDashboard?.selectFicha?.("");
                return;
            }
            renderAll(true);
        }

        chart.addEventListener("pointermove", (event) => {
            const index = pointerIndex(event);
            if (index === null) return;
            showTooltip(index, event);
        });
        chart.addEventListener("pointerleave", () => { tooltip.hidden = true; state.hoverIndex = null; updateChartDetail(state.selection.dia ? state.data?.timeline?.find((day) => day.date === state.selection.dia) : null); });
        chart.addEventListener("click", (event) => {
            const index = pointerIndex(event);
            if (index === null || !state.data?.timeline?.[index]) return;
            state.selection.dia = state.data.timeline[index].date;
            state.focusIndex = index;
            renderAll(true);
        });
        chart.addEventListener("keydown", (event) => {
            const days = state.data?.timeline || [];
            if (!days.length) return;
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                const direction = event.key === "ArrowLeft" ? -1 : 1;
                state.focusIndex = Math.max(0, Math.min(days.length - 1, state.focusIndex + direction));
                const x = state.layout?.xFor(state.focusIndex) || 0;
                if (x < chart.scrollLeft + 50 || x > chart.scrollLeft + chart.clientWidth - 50) chart.scrollLeft = Math.max(0, x - chart.clientWidth / 2);
                showTooltip(state.focusIndex);
            } else if (event.key === "Enter") {
                event.preventDefault();
                state.selection.dia = days[state.focusIndex]?.date || null;
                renderAll(true);
            } else if (event.key === "Escape") {
                event.preventDefault();
                clearSelection("all");
            }
        });

        distribution.addEventListener("click", (event) => {
            const button = event.target.closest("[data-status]");
            if (!button) return;
            const status = button.dataset.status;
            state.selection.estado = state.selection.estado === status ? null : status;
            renderAll(true);
        });

        composition.addEventListener("click", (event) => {
            const row = event.target.closest("[data-ficha]");
            if (!row) return;
            const ficha = row.dataset.ficha;
            state.selection.ficha = ficha;
            renderSelectionBar();
            windowObject.SenaDashboard?.selectFicha?.(ficha);
        });
        composition.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            const row = event.target.closest("[data-ficha]");
            if (!row) return;
            event.preventDefault();
            row.click();
        });

        compositionSort?.addEventListener("change", () => renderComposition(true));
        compositionLimit?.addEventListener("change", () => renderComposition(true));
        selectionChips?.addEventListener("click", (event) => {
            const chip = event.target.closest("[data-clear-selection]");
            if (chip) clearSelection(chip.dataset.clearSelection);
        });
        clearSelectionButton?.addEventListener("click", () => clearSelection("all"));
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !selectionBar?.hidden) clearSelection("all");
        });

        windowObject.addEventListener("dashboard:data", (event) => {
            state.data = event.detail;
            const firstDataIndex = (state.data.timeline || []).findIndex((day) => day.total);
            state.focusIndex = firstDataIndex >= 0 ? firstDataIndex : 0;
            renderAll(true);
        });
        windowObject.addEventListener("dashboard:loading", (event) => {
            const active = Boolean(event.detail?.active);
            document.querySelectorAll(".analytics-module").forEach((module) => module.classList.toggle("is-loading", active));
        });

        if (typeof ResizeObserver === "function") {
            const observer = new ResizeObserver(() => {
                if (!state.data) return;
                windowObject.cancelAnimationFrame(state.resizeFrame);
                state.resizeFrame = windowObject.requestAnimationFrame(() => renderTimeline(false));
            });
            observer.observe(chart);
            windowObject.addEventListener("pagehide", () => observer.disconnect(), { once: true });
        }
    }

    return { mount, sortComposition, limitComposition, nearestIndex, STATUS_ORDER };
});
