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

module.exports = { reportStatus, reportMetadata, validateReportTransition };
