const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function writeFilesAtomically(entries) {
    const files = entries.filter(item => item?.file).map(item => ({ file: path.resolve(item.file), content: String(item.content) }));
    const names = new Set();
    for (const item of files) {
        if (names.has(item.file)) throw new Error(`Archivo repetido en la transacción: ${path.basename(item.file)}.`);
        names.add(item.file);
    }
    const operation = crypto.randomUUID();
    const prepared = files.map(item => ({ ...item, temporary: `${item.file}.${operation}.tmp`, rollback: `${item.file}.${operation}.rollback`, existed: fs.existsSync(item.file), originalMoved: false, installed: false }));
    let committed = false;
    try {
        for (const item of prepared) {
            fs.mkdirSync(path.dirname(item.file), { recursive: true });
            fs.writeFileSync(item.temporary, item.content, 'utf8');
        }
        for (const item of prepared) {
            if (item.existed) {
                fs.renameSync(item.file, item.rollback);
                item.originalMoved = true;
            }
            fs.renameSync(item.temporary, item.file);
            item.installed = true;
        }
        committed = true;
    } catch (error) {
        const rollbackErrors = [];
        for (const item of [...prepared].reverse()) {
            try {
                if (item.installed && fs.existsSync(item.file)) fs.rmSync(item.file, { force: true });
                if (item.originalMoved && fs.existsSync(item.rollback)) fs.renameSync(item.rollback, item.file);
            } catch (rollbackError) { rollbackErrors.push(`${path.basename(item.file)}: ${rollbackError.message}`); }
        }
        if (rollbackErrors.length) error.message += ` No se pudo revertir: ${rollbackErrors.join('; ')}`;
        throw error;
    } finally {
        for (const item of prepared) {
            try { if (fs.existsSync(item.temporary)) fs.rmSync(item.temporary, { force: true }); } catch (_) { /* Limpieza posterior. */ }
            try { if (committed && fs.existsSync(item.rollback)) fs.rmSync(item.rollback, { force: true }); } catch (_) { /* La transacción ya quedó confirmada. */ }
        }
    }
}

module.exports = { writeFilesAtomically };
