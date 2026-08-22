function localDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function addDays(date, amount) {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
}

function rateFor(records) {
    if (!records.length) return 0;
    const present = records.filter((item) => item.estado === "presente").length;
    return Math.round(present / records.length * 1000) / 10;
}

function statusSummary(records) {
    const counts = { presente: 0, tardanza: 0, ausente: 0, justificado: 0 };
    records.forEach((item) => {
        if (counts[item.estado] !== undefined) counts[item.estado] += 1;
    });
    const total = records.length;
    return {
        total,
        counts,
        percentages: Object.fromEntries(Object.entries(counts).map(([status, count]) => [status, total ? Math.round(count / total * 1000) / 10 : 0])),
        attendance: rateFor(records)
    };
}

function availablePeriods(attendanceRecords, reference = new Date()) {
    const years = new Set([reference.getFullYear()]);
    attendanceRecords.forEach((item) => {
        const match = String(item.fecha || "").match(/^(\d{4})-/);
        if (match) years.add(Number(match[1]));
    });
    return [...years].sort((left, right) => right - left).flatMap((year) => [1, 2, 3, 4].map((quarter) => ({
        value: `${year}-Q${quarter}`,
        label: `Periodo ${quarter} - ${year}`,
        from: `${year}-${String((quarter - 1) * 3 + 1).padStart(2, "0")}-01`,
        to: dateKey(new Date(year, quarter * 3, 0, 12))
    })));
}

function resolveDashboardRange(requestUrl, attendanceRecords, reference = new Date()) {
    const periods = availablePeriods(attendanceRecords, reference);
    const period = String(requestUrl.searchParams.get("period") || "custom");
    const selectedPeriod = periods.find((item) => item.value === period);
    const defaultTo = dateKey(reference);
    const defaultFrom = dateKey(addDays(reference, -6));
    const fromText = selectedPeriod?.from || String(requestUrl.searchParams.get("from") || defaultFrom);
    const selectedPeriodTo = selectedPeriod && localDate(selectedPeriod.to) > reference ? defaultTo : selectedPeriod?.to;
    const toText = selectedPeriodTo || String(requestUrl.searchParams.get("to") || defaultTo);
    const from = localDate(fromText);
    const to = localDate(toText);
    if (!from || !to || from > to || (to - from) / 86400000 > 366) {
        throw Object.assign(new Error("El rango de fechas no es válido."), { status: 400 });
    }
    return { from, to, fromText, toText, period: selectedPeriod?.value || "custom", periods };
}

module.exports = {
    localDate,
    dateKey,
    addDays,
    rateFor,
    statusSummary,
    availablePeriods,
    resolveDashboardRange
};
