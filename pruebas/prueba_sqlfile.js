const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createProjectServer } = require('../servidor/servidor');
const { createDump, parseUsersSql, LIMIT } = require('../servidor/modulos/sqlfile');
const { serializeCsvUsers, loadCsvUsers } = require('../servidor/modulos/persistencia');

async function main() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sena-sql-'));
    const file = path.join(directory, 'usuarios.csv');
    const user = { identificacion: '800000901', tipo_documento: 'Cédula de Ciudadanía', nombre: "María O'Brien; DROP TABLE usuarios; --",
        correo: 'sql@example.com', rol: 'instructor', estado: 'activo', ficha: '' };
    fs.writeFileSync(file, serializeCsvUsers([]));
    const sql = createDump([user]);
    assert.deepEqual(parseUsersSql(sql), [user]);
    for (const invalid of [sql + 'DROP TABLE usuarios;', sql + 'SELECT 1;', sql + '/* ! DROP */', sql.replace("'800000901'", 'SLEEP(5)'), sql.replace('`usuarios` VALUES', '`cuentas` VALUES'), sql + "INSERT INTO usuarios VALUES ('incompleto');"]) {
        assert.throws(() => parseUsersSql(invalid));
    }
    const server = createProjectServer({ usersCsvFile: file, apprentices: [], managedUsers: [], attendanceRecords: [],
        sqlData: { ambientes: [], horarios: [], programas: [], fichas: [] }, adminPassword: 'sql-test-password',
        emailSender: async () => ({ id: 'test' }), publicUrl: '', allowedDomain: '', allowedEmails: '' });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    let cookie;
    const upload = (text, name = 'usuarios.sql', type = 'application/sql', field = 'SQLFILE', auth = cookie) => {
        const form = new FormData();
        form.append(field, new Blob([text], { type }), name);
        return fetch(base + '/api/users/import-sql', { method: 'POST', headers: auth ? { Cookie: auth } : {}, body: form });
    };
    try {
        assert.equal((await upload(sql)).status, 403);
        assert.equal((await fetch(base + '/api/users/export-sql')).status, 403);
        const login = await fetch(base + '/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: 'admin', password: 'sql-test-password' }) });
        assert.equal(login.status, 200);
        cookie = login.headers.get('set-cookie').split(';')[0];
        for (const args of [[sql, 'usuarios.csv'], [sql, 'usuarios.sql', 'image/png'], [sql, 'usuarios.sql', 'application/octet-stream'], [sql, 'usuarios.sql', 'application/sql', 'bad'], [''], [sql + 'DROP TABLE usuarios;']]) {
            const result = await upload(...args);
            assert.equal(result.status, 400, await result.text());
            assert.equal(loadCsvUsers(file).length, 0);
        }
        let response = await upload(sql + ' '.repeat(LIMIT - Buffer.byteLength(sql)));
        assert.equal(response.status, 201, await response.text());
        assert.equal(loadCsvUsers(file)[0].nombre, user.nombre);
        response = await upload(sql + ' '.repeat(LIMIT - Buffer.byteLength(sql) + 1));
        assert.equal(response.status, 413, await response.text());
        response = await upload(sql, 'USUARIOS.SQL', 'text/plain');
        assert.equal(response.status, 201, await response.text());
        response = await fetch(base + '/api/users/export-sql', { headers: { Cookie: cookie } });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('content-disposition'), 'attachment; filename="Base_datos_SENA.sql"');
        const dump = await response.text();
        assert.ok(dump.includes("María O''Brien"));
        assert.ok(dump.includes('CREATE TABLE `asistencia`'));
        assert.ok(!dump.includes('passwordHash'));
        const updated = { ...user, nombre: 'Edición externa' };
        fs.writeFileSync(file, serializeCsvUsers([updated]));
        assert.ok(server.exportDatabaseSql().includes('Edición externa'));
        console.log('OK: SQLFILE, permisos, MIME, extensión, límite exacto, SQL malicioso, actualización, exportación y CSV vigente.');
    } finally {
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(directory, { recursive: true, force: true });
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
