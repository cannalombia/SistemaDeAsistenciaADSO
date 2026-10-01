const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createProjectServer } = require('../servidor/servidor');
const { createDump } = require('../servidor/modulos/sqlfile');
const { serializeCsvUsers, loadCsvUsers } = require('../servidor/modulos/persistencia');
const { fichaPlan, weeklyPlan } = require('../servidor/configuracion/escala_formacion');

async function main() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-scale-'));
    const file = path.join(directory, 'users.csv');
    fs.writeFileSync(file, serializeCsvUsers([]));
    const fichas = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, numero: 3349882 + i, jornada: fichaPlan(3349882 + i).schedule, estado: 'Activa', programaId: 1 }));
    const users = Array.from({ length: 300 }, (_, i) => ({ identificacion: String(800000000 + i), tipo_documento: 'Cédula de Ciudadanía', nombre: `Usuario Prueba ${i}`, correo: `scale${i}@example.com`, rol: i < 240 ? 'aprendiz' : i < 251 ? 'instructor' : 'coordinador', estado: 'activo', ficha: i < 240 ? String(3349882 + Math.floor(i / 30)) : '' }));
    const server = createProjectServer({ usersCsvFile: file, apprentices: [], managedUsers: [], attendanceRecords: [], adminPassword: 'scale-test-password', publicUrl: '', allowedDomain: '', allowedEmails: '', emailSender: async () => ({}), sqlData: { fichas, horarios: [], ambientes: [{ id: 1, capacidad: 30 }, { id: 2, capacidad: 30 }], programas: [{ id: 1, nombre: 'ADSO' }] } });
    try {
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const base = `http://127.0.0.1:${server.address().port}`;
        const login = await fetch(base + '/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: 'admin', password: 'scale-test-password' }) });
        assert.equal(login.status, 200);
        const cookie = login.headers.get('set-cookie').split(';')[0];
        const request = async (route, body) => {
            const response = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
            return { status: response.status, data: await response.json() };
        };
        const sql = createDump(users);
        assert.ok(Buffer.byteLength(sql) > 14336);
        const form = new FormData(); form.append('SQLFILE', new Blob([sql], { type: 'application/sql' }), 'usuarios.sql');
        const imported = await fetch(base + '/api/users/import-sql', { method: 'POST', headers: { Cookie: cookie }, body: form });
        assert.equal(imported.status, 201, await imported.text());
        assert.equal(loadCsvUsers(file).length, 300);
        const directoryData = (await request('/api/users')).data;
        assert.equal(directoryData.summary.students, 240);
        assert.equal(directoryData.users.filter(user => user.role === 'Instructor' && user.document).length, 11);
        const training = (await request('/api/training')).data;
        assert.equal(training.weeklyPlan.length, 40);
        assert.equal(training.instructors.filter(user => user.document).length, 11);
        for (const ficha of training.fichas) assert.equal(ficha.dependencies.aprendices, 30);
        for (const day of fichaPlan(3349882).days) {
            const slots = weeklyPlan(fichas).filter(item => item.day === day);
            assert.equal(slots.filter(item => item.schedule === 'Mañana' && item.start === '07:00' && item.end === '13:00').length, 4);
            assert.equal(slots.filter(item => item.schedule === 'Tarde' && item.start === '13:00' && item.end === '19:00').length, 4);
        }
        const lesson = { fichaId: '1', environmentId: '1', instructorId: users[240].identificacion, day: 'Lunes', start: '07:00', end: '10:00' };
        assert.equal((await request('/api/schedules', lesson)).status, 201);
        assert.equal((await request('/api/schedules', { ...lesson, fichaId: '2', start: '10:00', end: '13:00' })).status, 201);
        assert.equal((await request('/api/schedules', { ...lesson, fichaId: '2', environmentId: '2' })).status, 409);
        assert.equal((await request('/api/schedules', { ...lesson, day: 'Martes', instructorId: users[241].identificacion })).status, 201);
        assert.equal((await request('/api/schedules', { ...lesson, day: 'Sábado' })).status, 400);
        assert.equal((await request('/api/schedules', { ...lesson, day: 'Jueves', end: '14:00' })).status, 400);
        assert.equal((await request('/api/schedules', { ...lesson, fichaId: '5', start: '13:00', end: '19:00' })).status, 201);
        console.log('OK: 300 usuarios importados, 240 aprendices en 8 fichas, 11 instructores, 40 franjas y rotación sin cruces.');
    } finally {
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(directory, { recursive: true, force: true });
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
