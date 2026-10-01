const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createBackup, validateBackup } = require('../servidor/modulos/respaldo');
const { writeFilesAtomically } = require('../servidor/modulos/transaccion_archivos');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sena-atomic-backup-'));
const first = path.join(directory, 'first.json');
const second = path.join(directory, 'second.json');
fs.writeFileSync(first, 'original-first');
fs.writeFileSync(second, 'original-second');

const originalRename = fs.renameSync;
try {
    fs.renameSync = (source, target) => {
        if (target === second && source.endsWith('.tmp')) throw new Error('fallo simulado durante la confirmación');
        return originalRename(source, target);
    };
    assert.throws(() => writeFilesAtomically([
        { file: first, content: 'new-first' },
        { file: second, content: 'new-second' }
    ]), /fallo simulado/);
} finally {
    fs.renameSync = originalRename;
}

assert.equal(fs.readFileSync(first, 'utf8'), 'original-first');
assert.equal(fs.readFileSync(second, 'utf8'), 'original-second');
assert.deepEqual(fs.readdirSync(directory).sort(), ['first.json', 'second.json']);

const backup = createBackup({
    users: [], apprentices: [], managedUsers: [{ id: '1', name: 'Persona', passwordHash: 'hash', salt: 'salt', token: 'token' }],
    attendance: [], programs: [], reports: [], audit: [], excuses: [], training: { fichas: [], horarios: [], ambientes: [], escala: { apprentices: 240 } },
    apiKey: 'secret-value'
});
assert.equal(backup.version, 3);
assert.equal(backup.data.managedUsers[0].passwordHash, undefined);
assert.equal(backup.data.managedUsers[0].salt, undefined);
assert.equal(backup.data.managedUsers[0].token, undefined);
assert.equal(backup.data.apiKey, undefined);
assert.equal(validateBackup(backup).training.escala.apprentices, 240);

fs.rmSync(directory, { recursive: true, force: true });
console.log('OK: respaldo sin secretos y restauración de archivos con reversión total ante fallos.');
