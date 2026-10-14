const Busboy = require('busboy');
const crypto = require('crypto');

const LIMIT = 10 * 1024 * 1024;
const FORMAT = 'sena-sql-backup';
const VERSION = '2';
const USER_COLUMNS = ['identificacion', 'tipo_documento', 'nombre', 'correo', 'rol', 'estado', 'ficha'];
const JSON_TABLES = [
    'ambientes', 'fichas', 'horarios', 'programas', 'aprendices', 'asistencia',
    'reportes', 'cuentas', 'auditoria', 'excusas', 'formacion_configuracion'
];
const TABLE_COLUMNS = Object.freeze({
    sena_respaldo: ['formato', 'version', 'checksum'],
    usuarios: USER_COLUMNS,
    ...Object.fromEntries(JSON_TABLES.map(name => [name, ['datos_json']]))
});
const MIME = new Set(['application/sql', 'application/x-sql', 'text/sql', 'text/x-sql', 'text/plain', 'application/octet-stream']);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

function readSqlFile(request) {
    return new Promise((resolve, reject) => {
        let parser;
        try { parser = Busboy({ headers: request.headers, limits: { fileSize: LIMIT + 1, files: 1, fields: 0, parts: 2 } }); }
        catch (_) { reject(fail('Envía un archivo .sql mediante multipart/form-data en SQLFILE.')); return; }
        let error, result, bytes = 0, settled = false;
        const rejectOnce = cause => { if (!settled) { settled = true; reject(cause); } };
        const bad = message => { error ||= fail(message); };
        request.on('data', chunk => {
            bytes += chunk.length;
            if (bytes > LIMIT + 16384 && !settled) {
                request.unpipe(parser);
                request.resume();
                rejectOnce(fail(`La solicitud supera el límite de ${LIMIT} bytes.`, 413));
                parser.destroy();
            }
        });
        parser.on('file', (field, stream, info) => {
            if (!['SQLFILE', 'file'].includes(field) || !/^[^/\\\x00-\x1f]+\.sql$/i.test(info.filename)) bad('Selecciona un archivo con extensión .sql en el campo SQLFILE.');
            if (info.mimeType && !MIME.has(info.mimeType)) bad('MIME no permitido. Usa un archivo SQL o de texto UTF-8.');
            const chunks = [];
            stream.on('limit', () => { error = fail(`El archivo SQL supera el máximo de ${LIMIT} bytes.`, 413); });
            stream.on('data', chunk => chunks.push(chunk));
            stream.on('error', rejectOnce);
            stream.on('end', () => { result = Buffer.concat(chunks); });
        });
        for (const event of ['filesLimit', 'fieldsLimit', 'partsLimit']) parser.on(event, () => bad('Envía únicamente un archivo SQLFILE.'));
        parser.on('error', () => rejectOnce(fail('La subida SQL está incompleta o mal formada.')));
        request.on('aborted', () => rejectOnce(fail('Se interrumpió la subida.')));
        parser.on('close', () => {
            if (settled) return;
            if (error) return rejectOnce(error);
            if (!result?.length) return rejectOnce(fail('El archivo SQL está vacío.'));
            if (result.length > LIMIT) return rejectOnce(fail(`El archivo SQL supera el máximo de ${LIMIT} bytes.`, 413));
            try {
                const source = new TextDecoder('utf-8', { fatal: true }).decode(result).replace(/^\uFEFF/, '');
                settled = true;
                resolve(source);
            } catch (_) { rejectOnce(fail('El archivo SQL debe estar codificado en UTF-8.')); }
        });
        request.pipe(parser);
    });
}

// El contenido nunca se ejecuta en MySQL: solo se aceptan CREATE TABLE e
// INSERT INTO con valores de texto literales dentro de una gramática cerrada.
function tokenize(source) {
    const tokens = [];
    let index = 0;
    let line = 1;
    const push = (type, value, tokenLine = line) => tokens.push({ type, value, line: tokenLine });
    while (index < source.length) {
        const character = source[index];
        if (/\s/.test(character)) {
            if (character === '\n') line += 1;
            index += 1;
            continue;
        }
        if (character === '-' && source[index + 1] === '-') {
            while (index < source.length && source[index] !== '\n') index += 1;
            continue;
        }
        if ('(),;'.includes(character)) {
            push('symbol', character);
            index += 1;
            continue;
        }
        if (character === '`') {
            const tokenLine = line;
            const end = source.indexOf('`', index + 1);
            if (end < 0) throw fail(`Línea ${tokenLine}: identificador SQL sin cerrar.`);
            const value = source.slice(index + 1, end);
            if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(value)) throw fail(`Línea ${tokenLine}: identificador SQL no válido.`);
            push('identifier', value.toLowerCase(), tokenLine);
            index = end + 1;
            continue;
        }
        if (character === "'") {
            const tokenLine = line;
            let value = '';
            index += 1;
            let closed = false;
            while (index < source.length) {
                const current = source[index];
                if (current === "'" && source[index + 1] === "'") {
                    value += "'";
                    index += 2;
                } else if (current === "'") {
                    index += 1;
                    closed = true;
                    break;
                } else {
                    if (current === '\0') throw fail(`Línea ${line}: el archivo contiene un byte nulo.`);
                    if (current === '\n') line += 1;
                    value += current;
                    index += 1;
                }
            }
            if (!closed) throw fail(`Línea ${tokenLine}: literal de texto sin cerrar.`);
            push('string', value, tokenLine);
            continue;
        }
        if (/[A-Za-z_]/.test(character)) {
            const tokenLine = line;
            let end = index + 1;
            while (end < source.length && /[A-Za-z_0-9]/.test(source[end])) end += 1;
            push('word', source.slice(index, end), tokenLine);
            index = end;
            continue;
        }
        throw fail(`Línea ${line}: contenido SQL no permitido cerca de "${source.slice(index, index + 20).replace(/\s+/g, ' ')}".`);
    }
    return tokens;
}

function checksumPayload(users, tables) {
    const orderedTables = Object.fromEntries(JSON_TABLES.filter(name => Object.hasOwn(tables, name)).map(name => [name, tables[name]]));
    return crypto.createHash('sha256').update(JSON.stringify({ usuarios: users, tablas: orderedTables })).digest('hex');
}

function parseDatabaseSql(source) {
    const tokens = tokenize(String(source || '').replace(/^\uFEFF/, ''));
    let index = 0;
    const created = new Set();
    const rawRows = Object.fromEntries(Object.keys(TABLE_COLUMNS).map(name => [name, []]));
    const current = () => tokens[index];
    const take = () => tokens[index++];
    const syntax = (message, token = current()) => fail(`Línea ${token?.line || 'final'}: ${message}`);
    const expectValue = value => {
        const token = take();
        if (!token || token.value.toUpperCase() !== value.toUpperCase()) throw syntax(`se esperaba ${value}.`, token);
        return token;
    };
    const takeIdentifier = () => {
        const token = take();
        if (!token || !['identifier', 'word'].includes(token.type)) throw syntax('se esperaba un nombre de tabla o columna.', token);
        return token.value.toLowerCase();
    };
    const parseColumns = () => {
        expectValue('(');
        const columns = [];
        do {
            columns.push(takeIdentifier());
            if (current()?.value !== ',') break;
            take();
        } while (true);
        expectValue(')');
        return columns;
    };
    const ensureColumns = (table, columns, token) => {
        const expected = TABLE_COLUMNS[table];
        if (!expected) throw syntax(`la tabla ${table} no forma parte del formato SENA.`, token);
        if (columns.length !== expected.length || columns.some((column, position) => column !== expected[position])) {
            throw syntax(`la tabla ${table} debe usar las columnas, en este orden: ${expected.join(', ')}.`, token);
        }
    };

    while (index < tokens.length) {
        const command = take();
        if (command.value.toUpperCase() === 'CREATE') {
            expectValue('TABLE');
            const tableToken = current();
            const table = takeIdentifier();
            if (created.has(table)) throw syntax(`la tabla ${table} está declarada más de una vez.`, tableToken);
            const columns = [];
            expectValue('(');
            do {
                columns.push(takeIdentifier());
                expectValue('TEXT');
                if (current()?.value !== ',') break;
                take();
            } while (true);
            expectValue(')');
            expectValue(';');
            ensureColumns(table, columns, tableToken);
            created.add(table);
        } else if (command.value.toUpperCase() === 'INSERT') {
            expectValue('INTO');
            const tableToken = current();
            const table = takeIdentifier();
            // Compatibilidad con plantillas antiguas de solo usuarios, donde
            // CREATE TABLE era opcional. Las tablas integrales sí se declaran.
            if (!created.has(table) && table === 'usuarios') created.add(table);
            if (!created.has(table)) throw syntax(`declara CREATE TABLE ${table} antes de insertar filas.`, tableToken);
            const columns = current()?.value === '(' ? parseColumns() : TABLE_COLUMNS[table];
            ensureColumns(table, columns, tableToken);
            expectValue('VALUES');
            do {
                expectValue('(');
                const values = columns.map((_, position) => {
                    if (position) expectValue(',');
                    const token = take();
                    if (!token || token.type !== 'string') throw syntax('solo se admiten valores de texto entre comillas simples.', token);
                    return token.value;
                });
                expectValue(')');
                rawRows[table].push(Object.fromEntries(columns.map((column, position) => [column, values[position]])));
                if (rawRows[table].length > 100000) throw syntax(`la tabla ${table} supera 100000 filas.`, tableToken);
                if (current()?.value !== ',') break;
                take();
            } while (true);
            expectValue(';');
        } else {
            throw syntax('comando no permitido; usa únicamente CREATE TABLE e INSERT INTO.', command);
        }
    }

    const users = rawRows.usuarios;
    if (!created.has('usuarios') || !users.length) throw fail('El archivo SQL debe declarar la tabla usuarios y contener al menos una fila.');
    const tables = {};
    for (const name of JSON_TABLES) {
        if (!created.has(name)) continue;
        tables[name] = rawRows[name].map((row, position) => {
            try {
                const value = JSON.parse(row.datos_json);
                if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('no es un objeto');
                return value;
            } catch (_) {
                throw fail(`La fila ${position + 1} de ${name} no contiene un objeto JSON válido.`);
            }
        });
    }
    const metadataRows = rawRows.sena_respaldo;
    let metadata = null;
    if (created.has('sena_respaldo')) {
        if (metadataRows.length !== 1) throw fail('La tabla sena_respaldo debe contener exactamente una fila de control.');
        metadata = metadataRows[0];
        if (metadata.formato !== FORMAT || metadata.version !== VERSION || !/^[a-f0-9]{64}$/.test(metadata.checksum)) {
            throw fail('El archivo no corresponde al formato SQL SENA versión 2.');
        }
        const calculated = checksumPayload(users, tables);
        if (calculated !== metadata.checksum) throw fail('El archivo SQL está incompleto o fue modificado: la firma de integridad no coincide.');
    }
    return { users, tables, metadata, integral: Boolean(metadata && JSON_TABLES.some(name => created.has(name))) };
}

function parseUsersSql(source) {
    return parseDatabaseSql(source).users;
}

const quote = value => "'" + String(value ?? '').replaceAll('\0', '').replaceAll("'", "''") + "'";

function createDump(users, tables = {}) {
    const normalizedUsers = users.map(user => Object.fromEntries(USER_COLUMNS.map(column => [column, String(user?.[column] ?? '')])));
    const normalizedTables = {};
    for (const name of JSON_TABLES) {
        if (!Object.hasOwn(tables, name)) continue;
        if (!Array.isArray(tables[name])) throw new Error(`La tabla ${name} debe ser una colección de filas.`);
        normalizedTables[name] = tables[name].map(record => JSON.parse(JSON.stringify(record)));
    }
    const unknown = Object.keys(tables).filter(name => !JSON_TABLES.includes(name));
    if (unknown.length) throw new Error(`Tablas SQL no válidas: ${unknown.join(', ')}.`);
    const checksum = checksumPayload(normalizedUsers, normalizedTables);
    let sql = '-- Sistema de Asistencia SENA\n';
    sql += '-- Formato definido: una fila INSERT por registro; columnas en el orden declarado.\n';
    sql += '-- Codificación: UTF-8. No edites el checksum; exporta nuevamente desde la aplicación.\n\n';
    sql += 'CREATE TABLE `sena_respaldo` (`formato` TEXT, `version` TEXT, `checksum` TEXT);\n';
    sql += `INSERT INTO \`sena_respaldo\` VALUES (${quote(FORMAT)}, ${quote(VERSION)}, ${quote(checksum)});\n\n`;
    sql += 'CREATE TABLE `usuarios` (' + USER_COLUMNS.map(column => '`' + column + '` TEXT').join(', ') + ');\n';
    for (const user of normalizedUsers) sql += 'INSERT INTO `usuarios` (' + USER_COLUMNS.map(column => '`' + column + '`').join(', ') + ') VALUES (' + USER_COLUMNS.map(column => quote(user[column])).join(', ') + ');\n';
    for (const name of JSON_TABLES) {
        if (!Object.hasOwn(normalizedTables, name)) continue;
        sql += `\nCREATE TABLE \`${name}\` (\`datos_json\` TEXT);\n`;
        for (const record of normalizedTables[name]) sql += `INSERT INTO \`${name}\` (\`datos_json\`) VALUES (${quote(JSON.stringify(record))});\n`;
    }
    return sql;
}

module.exports = {
    readSqlFile, parseUsersSql, parseDatabaseSql, createDump, checksumPayload,
    LIMIT, FORMAT, VERSION, USER_COLUMNS, JSON_TABLES
};
