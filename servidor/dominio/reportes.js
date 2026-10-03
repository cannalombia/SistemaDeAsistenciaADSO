"use strict";

function reportStatus(report) {
    return report.status === "archived" ? "archived" : "active";
}

function reportMetadata(report) {
    const { id, createdAt, createdBy, filters, distribution, students, archivedAt, archivedBy } = report;
    return {
        id,
        createdAt,
        createdBy,
        filters: { from: filters.from, to: filters.to, ficha: filters.ficha, jornada: filters.jornada },
        total: distribution.total,
        attendance: distribution.attendance,
        students: students.length,
        status: reportStatus(report),
        archivedAt: archivedAt || null,
        archivedBy: archivedBy || null
    };
}

function validateReportTransition(report, action) {
    if (!["archive", "restore"].includes(action)) return { ok: false, reason: "invalid_action" };
    const expectedStatus = action === "archive" ? "active" : "archived";
    if (reportStatus(report) !== expectedStatus) {
        return { ok: false, reason: action === "archive" ? "already_archived" : "not_archived" };
    }
    return { ok: true };
}

function archiveReport(report, { archivedAt, archivedBy }) {
    report.status = "archived";
    report.archivedAt = archivedAt;
    report.archivedBy = archivedBy;
}

function restoreReport(report) {
    report.status = "active";
    delete report.archivedAt;
    delete report.archivedBy;
}

function removeReport(reports, report) {
    const index = reports.indexOf(report);
    if (index === -1) return null;
    const before = reportMetadata(report);
    reports.splice(index, 1);
    return { before, removed: report };
}

function pruneOldestArchivedReports(reports, limit) {
    const required = Math.max(0, reports.length - limit + 1);
    const candidates = reports
        .filter(report => reportStatus(report) === "archived")
        .sort((left, right) => String(left.archivedAt || left.createdAt).localeCompare(String(right.archivedAt || right.createdAt)))
        .slice(0, required);

    if (candidates.length < required) return null;

    const removals = [];
    for (const candidate of candidates) removals.push(removeReport(reports, candidate));
    return removals;
}

module.exports = { reportStatus, reportMetadata, validateReportTransition, archiveReport, restoreReport, removeReport, pruneOldestArchivedReports };
