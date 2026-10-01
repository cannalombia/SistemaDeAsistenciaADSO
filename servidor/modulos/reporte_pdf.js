// pdf-lib 1.17.1, distribución UMD local con licencia MIT en ../vendor.
const { PDFDocument, StandardFonts, rgb } = require("../vendor/pdf-lib.min.js");

async function createReportPdf(report) {
    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const ink = rgb(0, .188, .302), green = rgb(.224, .710, .290), muted = rgb(.36, .43, .47);
    const width = 841.89, height = 595.28, margin = 36;
    let page, y;
    // Las fuentes estándar cubren español; reemplazar símbolos no imprimibles.
    function clean(value) {
        return Array.from(String(value ?? "").replace(/[\r\n\t]+/g, " ")).map((char) => {
            try { regular.encodeText(char); return char; } catch (_) { return "?"; }
        }).join("");
    }
    function text(value, x, baseline, size = 10, font = regular, color = ink) {
        page.drawText(clean(value), { x, y: baseline, size, font, color });
    }
    function wrap(value, maxWidth, size = 9, font = regular) {
        const lines = []; let line = "";
        for (const char of clean(value)) {
            if (line && font.widthOfTextAtSize(line + char, size) > maxWidth) { lines.push(line); line = ""; }
            line += char;
        }
        lines.push(line);
        return lines;
    }
    function newPage() {
        page = pdf.addPage([width, height]);
        page.drawRectangle({ x: 0, y: height - 66, width, height: 66, color: ink });
        text("SENA  /  SEGUIMIENTO ACADÉMICO", margin, height - 28, 10, bold, rgb(.6, .88, .69));
        text("Informe de asistencia", margin, height - 50, 19, bold, rgb(1, 1, 1));
        text(`Corte ${report.filters.from} al ${report.filters.to}`, width - 262, height - 42, 10, regular, rgb(1, 1, 1));
        y = height - 91;
    }
    function paragraph(value, size = 10, font = regular) {
        for (const line of wrap(value, width - margin * 2, size, font)) {
            if (y < 55) newPage();
            text(line, margin, y, size, font); y -= size + 5;
        }
    }
    function table(title, headers, widths, rows) {
        if (y < 140) newPage();
        y -= 12; paragraph(title, 13, bold); y -= 6;
        const header = () => {
            page.drawRectangle({ x: margin, y: y - 8, width: width - margin * 2, height: 25, color: green });
            let x = margin;
            headers.forEach((label, i) => { text(label, x + 6, y, 8, bold, ink); x += widths[i]; });
            y -= 25;
        };
        header();
        rows.forEach((row, index) => {
            const cells = row.map((cell, i) => wrap(cell, widths[i] - 12, 8));
            const rowHeight = Math.max(...cells.map((lines) => lines.length)) * 11 + 13;
            if (y - rowHeight < 48) { newPage(); paragraph(`${title} (continuación)`, 13, bold); y -= 6; header(); }
            page.drawRectangle({ x: margin, y: y - rowHeight + 10, width: width - margin * 2, height: rowHeight, color: index % 2 ? rgb(1, 1, 1) : rgb(.94, .97, .96) });
            let x = margin;
            cells.forEach((lines, i) => { lines.forEach((line, j) => text(line, x + 6, y - j * 11, 8)); x += widths[i]; });
            y -= rowHeight;
        });
        y -= 14;
    }
    newPage();
    paragraph(`Ficha: ${report.filters.ficha || "Todas las fichas"}   |   Jornada: ${report.filters.jornada || "Todas"}`, 11, bold);
    paragraph(`Elaborado por: ${report.createdBy}   |   Generado: ${new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date(report.createdAt))}`);
    paragraph(`Referencia: ${report.id}`, 8);
    y -= 8;
    const d = report.distribution;
    paragraph(`${report.students.length} aprendices con registros   /   ${d.total} registros   /   ${d.attendance}% presentes`, 13, bold);
    paragraph(`Presentes: ${d.counts.presente}   |   Tardanzas: ${d.counts.tardanza}   |   Ausentes: ${d.counts.ausente}   |   Justificados: ${d.counts.justificado}`);
    paragraph("Cálculo: presentes / registros guardados x 100. Tardanzas y justificaciones se muestran por separado. Los días sin registro no se cuentan como ausencias.", 9);
    paragraph("Este informe conserva los datos guardados al momento de su generación.", 9);
    table("Resumen por aprendiz", ["Aprendiz", "Documento", "Ficha", "Pres.", "Tard.", "Aus.", "Just.", "Total", "% pres."], [235, 105, 90, 48, 48, 48, 48, 48, 99.89], report.students.map((s) => [s.nombre, s.identificacion, s.ficha, s.counts.presente, s.counts.tardanza, s.counts.ausente, s.counts.justificado, s.total, `${s.attendance}%`]));
    table("Detalle de registros", ["Fecha / jornada", "Aprendiz / documento", "Ficha", "Estado", "Observación"], [125, 230, 85, 80, 249.89], [...report.records].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.nombre.localeCompare(b.nombre, "es")).map((r) => [`${r.fecha} / ${r.jornada}`, `${r.nombre} / ${r.identificacion}`, r.ficha, r.estado, r.observacion || "Sin observación"]));
    const pages = pdf.getPages();
    pages.forEach((p, i) => { page = p; text(`SENA | Informe ${report.id.slice(0, 8)} | Uso académico`, margin, 22, 8, regular, muted); text(`Página ${i + 1} de ${pages.length}`, width - 112, 22, 8, regular, muted); });
    pdf.setTitle(`Informe de asistencia ${report.filters.from} - ${report.filters.to}`);
    pdf.setAuthor(clean(report.createdBy));
    return Buffer.from(await pdf.save());
}

module.exports = { createReportPdf };
