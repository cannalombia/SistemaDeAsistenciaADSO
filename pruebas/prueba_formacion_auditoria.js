const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createProjectServer } = require('../servidor/servidor');
const { serializeCsvUsers } = require('../servidor/modulos/persistencia');

async function main() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sena-training-'));
    const usersFile = path.join(directory, 'usuarios.csv');
    const trainingFile = path.join(directory, 'formacion.json');
    const auditFile = path.join(directory, 'auditoria.json');
    const adminCredentialsFile = path.join(directory, 'admin.json');
    const reportsFile = path.join(directory, 'reports.json');
    fs.writeFileSync(usersFile, serializeCsvUsers([
        { identificacion: '900000001', tipo_documento: 'Cédula de Ciudadanía', nombre: 'Instructor Uno', correo: 'instructor@example.com', rol: 'instructor', estado: 'activo', ficha: '' },
        { identificacion: '900000002', tipo_documento: 'Cédula de Ciudadanía', nombre: 'Coordinador Uno', correo: 'coordinator@example.com', rol: 'coordinador', estado: 'activo', ficha: '' }
    ]));
    const options = {
        usersCsvFile: usersFile, trainingFile, auditFile, adminCredentialsFile, reportsFile, apprentices: [], managedUsers: [], attendanceRecords: [],
        adminPassword: 'training-test-password', exposeTestCode: true, emailSender: async () => ({ id: 'test' }), publicUrl: '', allowedDomain: '', allowedEmails: '', backupDirectory: path.join(directory, 'respaldos'),
        sqlData: { ambientes: [], horarios: [], fichas: [], programas: [{ id: 1, nombre: 'Análisis y desarrollo', nivel: 'Tecnólogo', duracion: '24 meses', estado: 'Activo' }] }
    };
    let server, base, cookie;
    const request = async (route, method = 'GET', body, auth = cookie) => {
        const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Cookie: auth } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
        return { status: response.status, data: await response.json() };
    };
    const start = async () => {
        server = createProjectServer(options);
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        base = `http://127.0.0.1:${server.address().port}`;
        const login = await fetch(base + '/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: 'admin', password: 'training-test-password' }) });
        cookie = login.headers.get('set-cookie').split(';')[0];
    };
    try {
        await start();
        assert.equal((await request('/api/training', 'GET', undefined, '')).status, 403);
        const coordinatorCode = await fetch(base + '/api/auth/email/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document: '900000002' }) });
        const coordinatorCodeData = await coordinatorCode.json();
        const coordinatorLogin = await fetch(base + '/api/auth/email/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document: '900000002', code: coordinatorCodeData.testCode }) });
        const coordinatorCookie = coordinatorLogin.headers.get('set-cookie').split(';')[0];
        assert.equal((await fetch(base + '/api/backup', { headers: { Cookie: coordinatorCookie } })).status, 403);
        assert.equal((await fetch(base + '/api/restore', { method: 'POST', headers: { Cookie: coordinatorCookie } })).status, 403);
        let result = await request('/api/environments', 'POST', { code: 'A101', name: 'Ambiente principal', capacity: 30, type: 'Aula', status: 'Disponible', zone: 'Zona 1' });
        assert.equal(result.status, 201, JSON.stringify(result.data));
        const environmentId = result.data.environments[0].id;
        result = await request('/api/fichas', 'POST', { code: '4455667', programId: '1', schedule: 'Mañana', mode: 'Presencial', status: 'Activa', instructorId: '900000001' });
        assert.equal(result.status, 201, JSON.stringify(result.data));
        const fichaId = result.data.fichas[0].id;
        result = await request('/api/schedules', 'POST', { fichaId, environmentId, instructorId: '900000001', day: 'Lunes', start: '06:00', end: '10:00' });
        assert.equal(result.status, 201, JSON.stringify(result.data));
        assert.equal((await request('/api/schedules', 'POST', { fichaId, environmentId, instructorId: '900000001', day: 'Lunes', start: '09:00', end: '11:00' })).status, 409);
        result = await request(`/api/environments/${environmentId}`, 'PATCH', { status: 'Mantenimiento' });
        assert.equal(result.status, 200);
        result = await request('/api/users', 'POST', { identificacion: '1000000099', tipo_documento: 'Cédula de Ciudadanía', nombre: 'Aprendiz Auditoría', correo: 'aprendiz.audit@example.com', rol: 'Aprendiz', estado: 'Activo', ficha: '4455667' });
        assert.equal(result.status, 201, JSON.stringify(result.data));
        const apprenticeId = result.data.user.id;
        result = await request('/api/attendance', 'POST', { ficha: '4455667', fecha: '2026-09-29', jornada: 'Mañana', aprendices: [{ identificacion: '1000000099', estado: 'presente', observacion: 'Registro inicial' }] });
        assert.equal(result.status, 200, JSON.stringify(result.data));
        result = await request(`/api/users/${encodeURIComponent(apprenticeId)}`, 'PATCH', { estado: 'Inactivo' });
        assert.equal(result.status, 200);
        assert.equal((await request('/api/programs/1', 'DELETE')).status, 409);
        assert.equal((await request(`/api/fichas/${fichaId}`, 'DELETE')).status, 409);
        assert.equal((await request(`/api/environments/${environmentId}`, 'DELETE')).status, 409);
        const scheduleId = result.data.schedules?.[0]?.id || (await request('/api/training')).data.schedules[0].id;
        assert.equal((await request(`/api/schedules/${scheduleId}`, 'DELETE')).status, 409);
        result = await request(`/api/schedules/${scheduleId}`, 'PATCH', { status: 'Inactivo' });
        assert.equal(result.status, 200);
        assert.equal(result.data.schedules[0].status, 'Inactivo');
        result = await request(`/api/environments/${environmentId}`, 'PATCH', { status: 'Inactivo' });
        assert.equal(result.status, 200);
        assert.equal(result.data.environments[0].status, 'Inactivo');
        result = await request('/api/environments', 'POST', { code: 'A102', name: 'Ambiente eliminable', capacity: 20, type: 'Aula', status: 'Disponible', zone: 'Zona 2' });
        const disposableEnvironment = result.data.environments.find(item => item.code === 'A102');
        assert.equal((await request(`/api/environments/${disposableEnvironment.id}`, 'DELETE')).status, 200);
        result = await request('/api/programs', 'POST', { code: '2', name: 'Programa eliminable', level: 'Técnico', duration: '12 meses', status: 'Activo' });
        assert.equal(result.status, 201);
        assert.equal((await request('/api/programs/2', 'DELETE')).status, 200);
        result = await request('/api/fichas', 'POST', { code: '4455668', programId: '1', schedule: 'Tarde', mode: 'Virtual', status: 'Activa', instructorId: '900000001' });
        const disposableFicha = result.data.fichas.find(item => item.code === '4455668');
        assert.equal((await request(`/api/fichas/${disposableFicha.id}`, 'DELETE')).status, 200);
        let audit = await request('/api/audit?limit=20');
        assert.equal(audit.status, 200);
        assert.ok(audit.data.entries.some(item => item.entity === 'ambiente' && item.action === 'update' && item.before.status === 'Disponible' && item.after.status === 'Mantenimiento'));
        assert.ok(audit.data.entries.some(item => item.entity === 'usuario' && item.action === 'create'));
        assert.ok(audit.data.entries.some(item => item.entity === 'usuario' && item.action === 'deactivate'));
        assert.ok(audit.data.entries.some(item => item.entity === 'asistencia_jornada' && item.action === 'create' && item.after[0].estado === 'presente'));
        assert.ok(audit.data.entries.some(item => item.entity === 'ambiente' && item.action === 'delete'));
        assert.ok(audit.data.entries.some(item => item.entity === 'programa' && item.action === 'delete'));
        assert.equal((await request('/api/backup', 'GET', undefined, '')).status, 403);
        let backupResponse = await fetch(base + '/api/backup', { headers: { Cookie: cookie } });
        assert.equal(backupResponse.status, 200);
        assert.match(backupResponse.headers.get('content-disposition'), /^attachment; filename="Respaldo_integral_SENA_\d{4}-\d{2}-\d{2}\.json"$/);
        const backupText = await backupResponse.text();
        const backupObject = JSON.parse(backupText);
        assert.equal(backupObject.format, 'sena-integral-backup');
        assert.equal(backupObject.version, 3);
        assert.ok(Array.isArray(backupObject.data.excuses));
        assert.equal(backupObject.data.adminCredentials, undefined);
        assert.ok(!/passwordHash|apiKey|secret|accessToken|refreshToken/i.test(backupText));
        result = await request('/api/environments', 'POST', { code: 'A103', name: 'Temporal después del respaldo', capacity: 15, type: 'Aula', status: 'Disponible', zone: 'Zona 3' });
        assert.ok(result.data.environments.some(item => item.code === 'A103'));
        const restore = async (text, name = 'respaldo.json', type = 'application/json') => {
            const form = new FormData(); form.append('BACKUPFILE', new Blob([text], { type }), name);
            return fetch(base + '/api/restore', { method: 'POST', headers: { Cookie: cookie }, body: form });
        };
        let restoreResponse = await restore(backupText);
        const restoreBody = await restoreResponse.text();
        assert.equal(restoreResponse.status, 200, restoreBody);
        const restoreResult = JSON.parse(restoreBody);
        assert.match(restoreResult.automaticBackup, /^Pre_restauracion_.+\.json$/);
        assert.equal(fs.readdirSync(path.join(directory, 'respaldos')).length, 1);
        result = await request('/api/training');
        assert.ok(!result.data.environments.some(item => item.code === 'A103'));
        const tampered = JSON.stringify({ ...backupObject, data: { ...backupObject.data, users: [] } });
        restoreResponse = await restore(tampered);
        assert.equal(restoreResponse.status, 400);
        assert.equal((await request('/api/training')).data.environments.length, result.data.environments.length);
        audit = await request('/api/audit?limit=20');
        assert.ok(audit.data.entries.some(item => item.entity === 'respaldo' && item.action === 'restore'));
        assert.ok(audit.data.entries.some(item => item.entity === 'respaldo_automatico' && item.action === 'create'));
        const notifications = await request('/api/notifications');
        assert.equal(notifications.status, 200);
        assert.ok(Array.isArray(notifications.data.notifications));
        await new Promise(resolve => server.close(resolve));
        await start();
        result = await request('/api/training');
        assert.equal(result.data.fichas[0].code, '4455667');
        assert.equal(result.data.environments[0].status, 'Inactivo');
        assert.equal(result.data.schedules[0].status, 'Inactivo');
        assert.equal(result.data.schedules[0].start, '06:00');
        audit = await request('/api/audit?limit=20');
        assert.ok(audit.data.entries.length >= 4);
        console.log('OK: formación central, CRUD protegido, persistencia, auditoría, notificaciones y respaldo integral.');
    } finally {
        if (server?.listening) await new Promise(resolve => server.close(resolve));
        fs.rmSync(directory, { recursive: true, force: true });
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
