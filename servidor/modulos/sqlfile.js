const Busboy = require('busboy');
const LIMIT = 1024 * 1024;
const COLUMNS = ['identificacion', 'tipo_documento', 'nombre', 'correo', 'rol', 'estado', 'ficha'];
const MIME = new Set(['application/sql', 'application/x-sql', 'text/sql', 'text/x-sql', 'text/plain']);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

function readSqlFile(request) {
    return new Promise((resolve, reject) => {
        let parser;
        try { parser = Busboy({ headers: request.headers, limits: { fileSize: LIMIT + 1, files: 1, fields: 0, parts: 2 } }); }
        catch (_) { reject(fail('Envía un archivo .sql mediante multipart/form-data en SQLFILE.')); return; }
        let error, result, bytes = 0;
        const bad = message => { error ||= fail(message); };
        request.on('data', chunk => {
            bytes += chunk.length;
            if (bytes > LIMIT + 8192) {
                request.unpipe(parser);
                request.resume();
                reject(fail('La solicitud supera el límite de subida.', 413));
                parser.destroy();
            }
        });
        parser.on('file', (field, stream, info) => {
            if (!['SQLFILE', 'file'].includes(field) || !/^[^/\\\x00-\x1f]+\.sql$/i.test(info.filename)) bad('Selecciona un archivo con extensión .sql en el campo SQLFILE.');
            if (!MIME.has(info.mimeType)) bad('MIME no permitido. Usa application/sql o un tipo de texto SQL admitido.');
            const chunks = [];
            stream.on('limit', () => { error = fail('El archivo SQL supera el máximo de 1 MB (1048576 bytes).', 413); });
            stream.on('data', chunk => chunks.push(chunk));
            stream.on('error', reject);
            stream.on('end', () => { result = Buffer.concat(chunks); });
        });
        for (const event of ['filesLimit', 'fieldsLimit', 'partsLimit']) parser.on(event, () => bad('Envía únicamente un archivo SQLFILE.'));
        parser.on('error', () => reject(fail('La subida SQL está incompleta o mal formada.')));
        request.on('aborted', () => reject(fail('Se interrumpió la subida.')));
        parser.on('close', () => {
            if (error) return reject(error);
            if (!result?.length) return reject(fail('El archivo SQL está vacío.'));
            if (result.length > LIMIT) return reject(fail('El archivo SQL supera el máximo de 1 MB (1048576 bytes).', 413));
            try { resolve(new TextDecoder('utf-8', { fatal: true }).decode(result)); }
            catch (_) { reject(fail('El archivo SQL debe estar codificado en UTF-8.')); }
        });
        request.pipe(parser);
    });
}

// Gramática cerrada: nunca se ejecuta SQL arbitrario ni se eliminan comandos
// peligrosos para intentar convertirlos en consultas válidas.
function parseUsersSql(source) {
    const tokens = [];
    const pattern = /\s+|--[^\r\n]*(?:\r?\n|$)|'(?:''|[^'\x00-\x1f\\])*'|`[A-Za-z_][A-Za-z_0-9]*`|[A-Za-z_][A-Za-z_0-9]*|[(),;]/gy;
    let pos = 0;
    while (pos < source.length) {
        pattern.lastIndex = pos;
        const match = pattern.exec(source);
        if (!match) throw fail('SQL no permitido: usa CREATE TABLE e INSERT INTO usuarios con valores literales entre comillas.');
        pos = pattern.lastIndex;
        if (!/^\s|^--/.test(match[0])) tokens.push(match[0]);
    }
    let i = 0;
    const take = () => tokens[i++];
    const expect = value => { if ((take() || '').toUpperCase() !== value.toUpperCase()) throw fail('Estructura SQL no permitida o incompleta.'); };
    const identifier = () => (take() || '').replace(/^`|`$/g, '').toLowerCase();
    const rows = [];
    while (i < tokens.length) {
        const command = take().toUpperCase();
        if (command === 'CREATE') {
            expect('TABLE');
            if (identifier() !== 'usuarios') throw fail('Solo se admite la tabla usuarios en la importación.');
            expect('(');
            COLUMNS.forEach((column, index) => { if (index) expect(','); if (identifier() !== column) throw fail('Columnas SQL no válidas.'); expect('TEXT'); });
            expect(')'); expect(';');
        } else if (command === 'INSERT') {
            expect('INTO');
            if (identifier() !== 'usuarios') throw fail('Solo se admite la tabla usuarios en la importación.');
            let columns = COLUMNS;
            if (tokens[i] === '(') {
                take(); columns = [];
                do { columns.push(identifier()); if (tokens[i] !== ',') break; take(); } while (true);
                expect(')');
                if (columns.length !== COLUMNS.length || new Set(columns).size !== COLUMNS.length || columns.some(c => !COLUMNS.includes(c))) throw fail('Columnas SQL no válidas.');
            }
            expect('VALUES');
            do {
                expect('(');
                const values = columns.map((_, index) => {
                    if (index) expect(',');
                    const token = take() || '';
                    if (!token.startsWith("'")) throw fail('Solo se admiten valores de texto literales, sin funciones ni expresiones.');
                    return token.slice(1, -1).replaceAll("''", "'");
                });
                expect(')');
                rows.push(Object.fromEntries(columns.map((c, n) => [c, values[n]])));
                if (tokens[i] !== ',') break;
                take();
            } while (true);
            expect(';');
        } else throw fail('Comando SQL no permitido. Solo CREATE TABLE e INSERT INTO usuarios.');
    }
    if (!rows.length) throw fail('El archivo SQL no contiene usuarios para importar.');
    return rows;
}

// Literales SQL estándar (compatibles con SQLite): apóstrofos duplicados.
const quote = value => "'" + String(value ?? '').replaceAll("'", "''").replaceAll('\0', '') + "'";
function createDump(users, tables = {}) {
    let sql = '-- Base actual SENA. Usuarios por roles incluidos.\n';
    sql += 'CREATE TABLE `usuarios` (' + COLUMNS.map(c => '`' + c + '` TEXT').join(', ') + ');\n';
    for (const user of users) sql += 'INSERT INTO `usuarios` VALUES (' + COLUMNS.map(c => quote(user[c])).join(', ') + ');\n';
    for (const [name, records] of Object.entries(tables)) {
        if (!/^[a-z_]+$/.test(name)) throw new Error('Nombre de tabla no válido.');
        sql += `CREATE TABLE \`${name}\` (\`datos_json\` TEXT);\n`;
        for (const record of records) sql += `INSERT INTO \`${name}\` VALUES (${quote(JSON.stringify(record))});\n`;
    }
    return sql;
}
module.exports = { readSqlFile, parseUsersSql, createDump, LIMIT };
