const Busboy = require('busboy');
const crypto = require('crypto');

const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const digest = data => crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
const SENSITIVE_KEYS = /^(?:password|passwordHash|salt|secret|apiKey|token|accessToken|refreshToken)$/i;

function withoutSecrets(value) {
    if (Array.isArray(value)) return value.map(withoutSecrets);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value)
        .filter(([key]) => !SENSITIVE_KEYS.test(key))
        .map(([key, item]) => [key, withoutSecrets(item)]));
}

function createBackup(data) {
    const safeData = withoutSecrets(JSON.parse(JSON.stringify(data)));
    return {
        format: 'sena-integral-backup',
        version: 3,
        createdAt: new Date().toISOString(),
        checksum: digest(safeData),
        data: safeData
    };
}

function validateBackup(value) {
    if (!value || value.format !== 'sena-integral-backup' || ![1, 2, 3].includes(value.version) || !value.data || typeof value.data !== 'object') {
        throw fail('El archivo no es un respaldo integral SENA compatible.');
    }
    if (!/^[a-f0-9]{64}$/.test(String(value.checksum || '')) || digest(value.data) !== value.checksum) {
        throw fail('El respaldo está incompleto o fue modificado: la firma de integridad no coincide.');
    }
    const arrays = ['users', 'apprentices', 'managedUsers', 'attendance', 'programs', 'reports', 'audit'];
    for (const key of arrays) if (!Array.isArray(value.data[key])) throw fail(`El respaldo no contiene una colección válida de ${key}.`);
    const training = value.data.training;
    if (!training || !Array.isArray(training.fichas) || !Array.isArray(training.horarios) || !Array.isArray(training.ambientes)) throw fail('El respaldo no contiene formación válida.');
    const total = arrays.reduce((sum, key) => sum + value.data[key].length, 0) + training.fichas.length + training.horarios.length + training.ambientes.length;
    if (total > 100000) throw fail('El respaldo contiene demasiados registros.');
    if (value.version >= 3 && !Array.isArray(value.data.excuses)) throw fail('El respaldo no contiene una colección válida de excuses.');
    return { ...value.data, excuses: Array.isArray(value.data.excuses) ? value.data.excuses : [] };
}

function readBackupFile(request) {
    return new Promise((resolve, reject) => {
        let parser;
        try { parser = Busboy({ headers: request.headers, limits: { fileSize: MAX_BACKUP_BYTES + 1, files: 1, fields: 0, parts: 2 } }); }
        catch (_) { reject(fail('Envía el respaldo mediante multipart/form-data en BACKUPFILE.')); return; }
        let result, error;
        const bad = message => { error ||= fail(message); };
        parser.on('file', (field, stream, info) => {
            if (field !== 'BACKUPFILE' || !/^[^/\\\x00-\x1f]+\.json$/i.test(info.filename)) bad('Selecciona un archivo de respaldo .json en BACKUPFILE.');
            if (!['application/json', 'text/json', 'text/plain'].includes(info.mimeType)) bad('El tipo MIME del respaldo debe ser JSON.');
            const chunks = [];
            stream.on('limit', () => { error = fail('El respaldo supera el máximo de 25 MB.', 413); });
            stream.on('data', chunk => chunks.push(chunk));
            stream.on('error', reject);
            stream.on('end', () => { result = Buffer.concat(chunks); });
        });
        for (const event of ['filesLimit', 'fieldsLimit', 'partsLimit']) parser.on(event, () => bad('Envía únicamente un archivo BACKUPFILE.'));
        parser.on('error', () => reject(fail('La subida del respaldo está incompleta o mal formada.')));
        parser.on('close', () => {
            if (error) return reject(error);
            if (!result?.length) return reject(fail('El respaldo está vacío.'));
            try { resolve(validateBackup(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(result)))); }
            catch (cause) { reject(cause.status ? cause : fail('El respaldo no contiene JSON UTF-8 válido.')); }
        });
        request.pipe(parser);
    });
}

module.exports = { createBackup, readBackupFile, validateBackup, withoutSecrets, MAX_BACKUP_BYTES };
