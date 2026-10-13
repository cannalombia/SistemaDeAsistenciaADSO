const crypto = require("crypto");

const asObject = (value) => typeof value === "string" ? JSON.parse(value) : value;
const keyOf = (value, index, prefix) => String(value?.id || value?.identificacion || value?.document || value?.correo || value?.email || `${prefix}-${index}`);
const json = (value) => JSON.stringify(value ?? null);
const sha256 = (value) => crypto.createHash("sha256").update(String(value ?? "")).digest("hex");
const sqlDate = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new Error("Fecha inválida para persistencia MySQL.");
    return date.toISOString().slice(0, 23).replace("T", " ");
};

async function insertRows(connection, table, columns, rows) {
    if (!rows.length) return;
    const placeholders = rows.map(() => `(${columns.map(() => "?").join(",")})`).join(",");
    await connection.query(`INSERT INTO ${table} (${columns.join(",")}) VALUES ${placeholders}`, rows.flat());
}

function attendanceKey(item, index) {
    if (item.id) return String(item.id);
    return crypto.createHash("sha256").update(`${item.identificacion}|${item.ficha}|${item.fecha}|${item.jornada}|${index}`).digest("hex");
}

function createMysqlRepository(pool) {
    async function loadState(existingConnection = pool) {
        const tables = ["app_users", "app_apprentices", "app_managed_users", "app_attendance", "app_programs", "app_fichas", "app_schedules", "app_environments", "app_reports", "app_audit", "app_excuses"];
        const results = {};
        for (const table of tables) {
            const order = ["app_programs", "app_fichas", "app_schedules", "app_environments"].includes(table) ? "id" : "row_key";
            const [rows] = await existingConnection.query(`SELECT payload FROM ${table} ORDER BY ${order}`);
            results[table] = rows.map((row) => asObject(row.payload));
        }
        const [metadata] = await existingConnection.execute("SELECT payload FROM app_state WHERE state_key = 'training_metadata'");
        return {
            users: results.app_users,
            apprentices: results.app_apprentices,
            managedUsers: results.app_managed_users,
            attendance: results.app_attendance,
            programs: results.app_programs,
            training: { ...(metadata[0] ? asObject(metadata[0].payload) : {}), fichas: results.app_fichas, horarios: results.app_schedules, ambientes: results.app_environments },
            reports: results.app_reports,
            audit: results.app_audit,
            excuses: results.app_excuses
        };
    }

    async function getRevision(existingConnection = pool) {
        const [rows] = await existingConnection.execute("SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.value')) AS UNSIGNED) AS value FROM app_state WHERE state_key = 'data_revision'");
        return Number(rows[0]?.value || 0);
    }

    async function bumpRevision(connection) {
        await connection.execute(`INSERT INTO app_state (state_key, payload)
            VALUES ('data_revision', JSON_OBJECT('value', 1))
            ON DUPLICATE KEY UPDATE payload = JSON_OBJECT('value', CAST(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.value')) AS UNSIGNED) + 1)`);
        return getRevision(connection);
    }

    async function saveSnapshot(state, existingConnection, options = {}) {
        const connection = existingConnection || await pool.getConnection();
        const ownsConnection = !existingConnection;
        try {
            await connection.beginTransaction();
            for (const table of ["app_schedules", "app_attendance", "app_fichas", "app_environments", "app_programs", "app_apprentices", "app_managed_users", "app_users", "app_reports", "app_audit", "app_excuses"]) {
                await connection.query(`DELETE FROM ${table}`);
            }
            await insertRows(connection, "app_programs", ["id", "nombre", "payload"], (state.programs || []).map((item) => [String(item.id), String(item.nombre || item.name || ""), json(item)]));
            await insertRows(connection, "app_environments", ["id", "codigo", "payload"], (state.training?.ambientes || []).map((item) => [String(item.id), String(item.codigo || item.code || item.id), json(item)]));
            await insertRows(connection, "app_fichas", ["id", "numero", "jornada", "programa_id", "instructor_key", "payload"], (state.training?.fichas || []).map((item) => [String(item.id), String(item.numero), String(item.jornada || ""), String(item.programaId), item.instructorId == null ? null : String(item.instructorId), json(item)]));
            await insertRows(connection, "app_schedules", ["id", "ficha_id", "ambiente_id", "instructor_key", "dia", "payload"], (state.training?.horarios || []).map((item) => [String(item.id), String(item.fichaId), String(item.ambienteId), item.instructorId == null ? null : String(item.instructorId), String(item.dia || ""), json(item)]));
            await insertRows(connection, "app_users", ["row_key", "documento", "correo", "ficha", "rol", "payload"], (state.users || []).map((item, index) => [keyOf(item, index, "user"), String(item.identificacion || item.document), String(item.correo || item.email).toLowerCase(), item.ficha ? String(item.ficha) : null, String(item.rol || item.role || ""), json(item)]));
            await insertRows(connection, "app_managed_users", ["row_key", "documento", "correo", "rol", "payload"], (state.managedUsers || []).map((item, index) => [keyOf(item, index, "managed"), item.document ? String(item.document) : null, item.email ? String(item.email).toLowerCase() : null, item.role ? String(item.role) : null, json(item)]));
            await insertRows(connection, "app_apprentices", ["row_key", "documento", "correo", "ficha", "payload"], (state.apprentices || []).map((item, index) => [keyOf(item, index, "apprentice"), String(item.document), String(item.email).toLowerCase(), item.program?.ficha ? String(item.program.ficha) : null, json(item)]));
            await insertRows(connection, "app_attendance", ["row_key", "documento", "ficha", "fecha", "jornada", "payload"], (state.attendance || []).map((item, index) => [attendanceKey(item, index), String(item.identificacion), String(item.ficha), String(item.fecha), String(item.jornada || ""), json(item)]));
            await insertRows(connection, "app_reports", ["row_key", "created_at", "payload"], (state.reports || []).map((item, index) => [keyOf(item, index, "report"), item.createdAt ? String(item.createdAt).replace("T", " ").replace("Z", "") : null, json(item)]));
            await insertRows(connection, "app_audit", ["row_key", "event_at", "entity", "actor_key", "payload"], (state.audit || []).map((item, index) => [keyOf(item, index, "audit"), String(item.timestamp || new Date(0).toISOString()).replace("T", " ").replace("Z", ""), String(item.entity || ""), item.actor?.id || item.actor?.email || null, json(item)]));
            await insertRows(connection, "app_excuses", ["row_key", "documento", "ficha", "absence_date", "status", "submitted_at", "payload"], (state.excuses || []).map((item, index) => [keyOf(item, index, "excuse"), String(item.document), String(item.ficha), String(item.date), String(item.status), String(item.submittedAt).replace("T", " ").replace("Z", ""), json(item)]));
            const { fichas: _f, horarios: _h, ambientes: _a, ...metadata } = state.training || {};
            await connection.execute("INSERT INTO app_state (state_key, payload) VALUES ('training_metadata', ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload)", [json(metadata)]);
            const revision = await bumpRevision(connection);
            if (options.idempotency) {
                const item = options.idempotency;
                await saveIdempotency(item.key, item.method, item.requestPath, item.response, { ttlMs: item.ttlMs || 10 * 60 * 1000 }, connection);
            }
            await connection.commit();
            return revision;
        } catch (error) {
            try { await connection.rollback(); } catch (_) { /* best effort */ }
            throw error;
        } finally {
            if (ownsConnection) connection.release();
        }
    }

    async function withMutationLock(task, { timeoutSeconds = 12, lockName = "blue_magic:mutation" } = {}) {
        const connection = await pool.getConnection();
        let acquired = false;
        try {
            const [rows] = await connection.execute("SELECT GET_LOCK(?, ?) AS acquired", [lockName, Math.max(1, Math.min(30, Number(timeoutSeconds) || 12))]);
            acquired = Number(rows[0]?.acquired) === 1;
            if (!acquired) {
                const error = new Error("Otra instancia está confirmando una operación. Intenta nuevamente en unos segundos.");
                error.status = 503;
                error.code = "MUTATION_LOCK_TIMEOUT";
                throw error;
            }
            return await task(connection);
        } finally {
            if (acquired) {
                try { await connection.execute("SELECT RELEASE_LOCK(?)", [lockName]); } catch (_) { /* lock is released on connection close too */ }
            }
            connection.release();
        }
    }

    async function getRuntimeState(stateKey, existingConnection = pool) {
        const [rows] = await existingConnection.execute("SELECT payload, expires_at FROM app_runtime_state WHERE state_key = ?", [String(stateKey)]);
        if (!rows.length) return null;
        if (rows[0].expires_at && new Date(`${String(rows[0].expires_at).replace(" ", "T")}Z`).getTime() <= Date.now()) {
            await existingConnection.execute("DELETE FROM app_runtime_state WHERE state_key = ?", [String(stateKey)]);
            return null;
        }
        return asObject(rows[0].payload);
    }

    async function setRuntimeState(stateKey, payload, { expiresAt = null } = {}, existingConnection = pool) {
        await existingConnection.execute(`INSERT INTO app_runtime_state (state_key, payload, expires_at)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE payload = VALUES(payload), expires_at = VALUES(expires_at)`, [String(stateKey), json(payload), expiresAt ? sqlDate(expiresAt) : null]);
    }

    async function deleteRuntimeState(stateKey, existingConnection = pool) {
        await existingConnection.execute("DELETE FROM app_runtime_state WHERE state_key = ?", [String(stateKey)]);
    }

    async function saveSession(token, session, existingConnection = pool) {
        const tokenHash = sha256(token);
        const user = session?.user || {};
        const userKey = String(user.id || user.document || user.email || "unknown");
        await existingConnection.execute(`INSERT INTO app_sessions (token_hash, user_key, documento, correo, expires_at, last_seen_at, payload)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE user_key = VALUES(user_key), documento = VALUES(documento), correo = VALUES(correo), expires_at = VALUES(expires_at), last_seen_at = VALUES(last_seen_at), payload = VALUES(payload)`, [
            tokenHash, userKey, user.document ? String(user.document) : null, user.email ? String(user.email).toLowerCase() : null,
            sqlDate(session.expiresAt), sqlDate(Date.now()), json(session)
        ]);
        return tokenHash;
    }

    async function getSession(token, existingConnection = pool) {
        const tokenHash = sha256(token);
        const [rows] = await existingConnection.execute("SELECT payload, expires_at FROM app_sessions WHERE token_hash = ?", [tokenHash]);
        if (!rows.length) return null;
        const expiry = new Date(`${String(rows[0].expires_at).replace(" ", "T")}Z`).getTime();
        if (!Number.isFinite(expiry) || expiry <= Date.now()) {
            await existingConnection.execute("DELETE FROM app_sessions WHERE token_hash = ?", [tokenHash]);
            return null;
        }
        const payload = asObject(rows[0].payload);
        await existingConnection.execute("UPDATE app_sessions SET last_seen_at = ? WHERE token_hash = ?", [sqlDate(Date.now()), tokenHash]);
        return payload;
    }

    async function deleteSession(token, existingConnection = pool) {
        await existingConnection.execute("DELETE FROM app_sessions WHERE token_hash = ?", [sha256(token)]);
    }

    async function deleteSessionsForUser(user = {}, existingConnection = pool) {
        const clauses = [];
        const values = [];
        if (user.id) { clauses.push("user_key = ?"); values.push(String(user.id)); }
        if (user.document) { clauses.push("documento = ?"); values.push(String(user.document)); }
        if (user.email) { clauses.push("correo = ?"); values.push(String(user.email).toLowerCase()); }
        if (!clauses.length) return 0;
        const [result] = await existingConnection.execute(`DELETE FROM app_sessions WHERE ${clauses.join(" OR ")}`, values);
        return Number(result.affectedRows || 0);
    }

    async function saveQrToken(token, entry, ownerSessionToken = "", existingConnection = pool) {
        const tokenHash = sha256(token);
        const ownerHash = ownerSessionToken ? sha256(ownerSessionToken) : null;
        if (ownerHash) await existingConnection.execute("DELETE FROM app_qr_tokens WHERE owner_session_hash = ?", [ownerHash]);
        const { owner: _ownerToken, ...safeEntry } = entry || {};
        await existingConnection.execute(`INSERT INTO app_qr_tokens (token_hash, owner_session_hash, ficha, jornada, fecha, expires_at, payload)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE owner_session_hash=VALUES(owner_session_hash), ficha=VALUES(ficha), jornada=VALUES(jornada), fecha=VALUES(fecha), expires_at=VALUES(expires_at), payload=VALUES(payload)`, [
            tokenHash, ownerHash, String(entry.ficha), String(entry.jornada), String(entry.fecha), sqlDate(entry.expiresAt), json(safeEntry)
        ]);
        return tokenHash;
    }

    async function getQrToken(token, existingConnection = pool) {
        const tokenHash = sha256(token);
        const [rows] = await existingConnection.execute("SELECT payload, expires_at FROM app_qr_tokens WHERE token_hash = ?", [tokenHash]);
        if (!rows.length) return null;
        const expiry = new Date(`${String(rows[0].expires_at).replace(" ", "T")}Z`).getTime();
        if (!Number.isFinite(expiry) || expiry <= Date.now()) {
            await existingConnection.execute("DELETE FROM app_qr_tokens WHERE token_hash = ?", [tokenHash]);
            return null;
        }
        return asObject(rows[0].payload);
    }

    async function deleteQrToken(token, existingConnection = pool) {
        await existingConnection.execute("DELETE FROM app_qr_tokens WHERE token_hash = ?", [sha256(token)]);
    }

    function idempotencyHash(key, method, requestPath) {
        return sha256(`${String(method).toUpperCase()}\n${String(requestPath)}\n${String(key)}`);
    }

    async function getIdempotency(key, method, requestPath, existingConnection = pool) {
        const keyHash = idempotencyHash(key, method, requestPath);
        const [rows] = await existingConnection.execute("SELECT status_code, response_headers, response_body, expires_at FROM app_idempotency WHERE key_hash = ?", [keyHash]);
        if (!rows.length) return null;
        const expiry = new Date(`${String(rows[0].expires_at).replace(" ", "T")}Z`).getTime();
        if (!Number.isFinite(expiry) || expiry <= Date.now()) {
            await existingConnection.execute("DELETE FROM app_idempotency WHERE key_hash = ?", [keyHash]);
            return null;
        }
        return {
            statusCode: Number(rows[0].status_code),
            headers: asObject(rows[0].response_headers) || {},
            body: String(rows[0].response_body || "")
        };
    }

    async function saveIdempotency(key, method, requestPath, response, { ttlMs = 10 * 60 * 1000 } = {}, existingConnection = pool) {
        const keyHash = idempotencyHash(key, method, requestPath);
        await existingConnection.execute(`INSERT INTO app_idempotency (key_hash, method, request_path, status_code, response_headers, response_body, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE status_code=VALUES(status_code), response_headers=VALUES(response_headers), response_body=VALUES(response_body), expires_at=VALUES(expires_at)`, [
            keyHash, String(method).toUpperCase(), String(requestPath), Number(response.statusCode || 200), json(response.headers || {}), String(response.body || ""), sqlDate(Date.now() + ttlMs)
        ]);
    }

    async function enqueueEmailOutbox(item, existingConnection = pool) {
        const expiresAt = item.expiresAt || Date.now() + 10 * 60 * 1000;
        await existingConnection.execute(`INSERT INTO app_email_outbox (request_id, provider, recipient, payload, status, attempts, available_at, expires_at)
            VALUES (?, ?, ?, ?, 'pending', 0, ?, ?)
            ON DUPLICATE KEY UPDATE payload=VALUES(payload), expires_at=VALUES(expires_at), status=IF(status='sent','sent','pending')`, [
            String(item.requestId), String(item.provider || "unknown"), String(item.recipient || ""), json(item.payload || {}), sqlDate(Date.now()), sqlDate(expiresAt)
        ]);
    }

    async function markEmailOutbox(requestId, status, details = {}, existingConnection = pool) {
        const normalized = ["pending", "sent", "failed", "expired"].includes(status) ? status : "failed";
        await existingConnection.execute(`UPDATE app_email_outbox
            SET status = ?, attempts = attempts + ?, sent_at = ?, last_error = ?, available_at = ?
            WHERE request_id = ?`, [
            normalized,
            Number(details.incrementAttempts || 0),
            normalized === "sent" ? sqlDate(Date.now()) : null,
            details.error ? String(details.error).slice(0, 500) : null,
            sqlDate(details.availableAt || Date.now()),
            String(requestId)
        ]);
    }

    async function listPendingEmailOutbox(limit = 20, existingConnection = pool) {
        const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
        const [rows] = await existingConnection.query(`SELECT request_id, provider, recipient, payload, attempts, expires_at
            FROM app_email_outbox
            WHERE status='pending' AND available_at <= UTC_TIMESTAMP(3)
            ORDER BY created_at ASC LIMIT ${safeLimit}`);
        return rows.map((row) => ({
            requestId: row.request_id,
            provider: row.provider,
            recipient: row.recipient,
            payload: asObject(row.payload),
            attempts: Number(row.attempts || 0),
            expiresAt: new Date(`${String(row.expires_at).replace(" ", "T")}Z`).getTime()
        }));
    }

    async function heartbeatInstance(instance, existingConnection = pool) {
        await existingConnection.execute(`INSERT INTO app_instance_heartbeats (instance_id, build_id, pid, host_name, started_at, last_seen_at, ready, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE build_id=VALUES(build_id), pid=VALUES(pid), host_name=VALUES(host_name), last_seen_at=VALUES(last_seen_at), ready=VALUES(ready), metadata=VALUES(metadata)`, [
            String(instance.instanceId), String(instance.buildId), Number(instance.pid), String(instance.hostName), sqlDate(instance.startedAt), sqlDate(Date.now()), instance.ready ? 1 : 0, json(instance.metadata || {})
        ]);
    }

    async function activeInstances({ maxAgeMs = 30000 } = {}, existingConnection = pool) {
        const cutoff = sqlDate(Date.now() - Math.max(5000, Number(maxAgeMs) || 30000));
        const [rows] = await existingConnection.execute("SELECT instance_id, build_id, pid, host_name, started_at, last_seen_at, ready, metadata FROM app_instance_heartbeats WHERE last_seen_at >= ? ORDER BY instance_id", [cutoff]);
        return rows.map((row) => ({
            instanceId: row.instance_id,
            buildId: row.build_id,
            pid: Number(row.pid),
            hostName: row.host_name,
            startedAt: row.started_at,
            lastSeenAt: row.last_seen_at,
            ready: Boolean(row.ready),
            metadata: asObject(row.metadata) || {}
        }));
    }

    async function cleanupRuntime(existingConnection = pool) {
        const statements = [
            "DELETE FROM app_sessions WHERE expires_at <= UTC_TIMESTAMP(3)",
            "DELETE FROM app_qr_tokens WHERE expires_at <= UTC_TIMESTAMP(3)",
            "DELETE FROM app_runtime_state WHERE expires_at IS NOT NULL AND expires_at <= UTC_TIMESTAMP(3)",
            "DELETE FROM app_idempotency WHERE expires_at <= UTC_TIMESTAMP(3)",
            "UPDATE app_email_outbox SET status='expired', last_error='Caducó antes de enviarse' WHERE status='pending' AND expires_at <= UTC_TIMESTAMP(3)",
            "DELETE FROM app_instance_heartbeats WHERE last_seen_at < (UTC_TIMESTAMP(3) - INTERVAL 1 DAY)"
        ];
        for (const statement of statements) await existingConnection.query(statement);
    }

    async function isActivated() {
        const [rows] = await pool.execute("SELECT JSON_UNQUOTE(setting_value) AS value FROM app_settings WHERE setting_key = 'source_definitive'");
        return rows[0]?.value === "mysql";
    }
    async function activate(connection = pool) {
        await connection.execute("INSERT INTO app_settings (setting_key, setting_value) VALUES ('source_definitive', JSON_QUOTE('mysql')) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
    }
    async function deactivate(connection = pool) {
        await connection.execute("DELETE FROM app_settings WHERE setting_key = 'source_definitive'");
    }

    return {
        loadState,
        saveSnapshot,
        getRevision,
        withMutationLock,
        getRuntimeState,
        setRuntimeState,
        deleteRuntimeState,
        saveSession,
        getSession,
        deleteSession,
        deleteSessionsForUser,
        saveQrToken,
        getQrToken,
        deleteQrToken,
        getIdempotency,
        saveIdempotency,
        enqueueEmailOutbox,
        markEmailOutbox,
        listPendingEmailOutbox,
        heartbeatInstance,
        activeInstances,
        cleanupRuntime,
        isActivated,
        activate,
        deactivate,
        pool
    };
}

module.exports = { createMysqlRepository, sha256 };
