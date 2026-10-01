const crypto = require("crypto");

const asObject = (value) => typeof value === "string" ? JSON.parse(value) : value;
const keyOf = (value, index, prefix) => String(value?.id || value?.identificacion || value?.document || value?.correo || value?.email || `${prefix}-${index}`);
const json = (value) => JSON.stringify(value ?? null);

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
    async function loadState() {
        const tables = ["app_users", "app_apprentices", "app_managed_users", "app_attendance", "app_programs", "app_fichas", "app_schedules", "app_environments", "app_reports", "app_audit", "app_excuses"];
        const results = {};
        for (const table of tables) {
            const [rows] = await pool.query(`SELECT payload FROM ${table} ORDER BY row_key` .replace("ORDER BY row_key", ["app_programs", "app_fichas", "app_schedules", "app_environments"].includes(table) ? "ORDER BY id" : "ORDER BY row_key"));
            results[table] = rows.map((row) => asObject(row.payload));
        }
        const [metadata] = await pool.execute("SELECT payload FROM app_state WHERE state_key = 'training_metadata'");
        return {
            users: results.app_users,
            apprentices: results.app_apprentices,
            managedUsers: results.app_managed_users,
            attendance: results.app_attendance,
            programs: results.app_programs,
            training: { ...(metadata[0] ? asObject(metadata[0].payload) : {}), fichas: results.app_fichas, horarios: results.app_schedules, ambientes: results.app_environments },
            reports: results.app_reports,
            audit: results.app_audit
            ,excuses: results.app_excuses
        };
    }

    async function saveSnapshot(state, existingConnection) {
        const connection = existingConnection || await pool.getConnection();
        const ownsTransaction = !existingConnection;
        try {
            if (ownsTransaction) await connection.beginTransaction();
            for (const table of ["app_schedules", "app_attendance", "app_fichas", "app_environments", "app_programs", "app_apprentices", "app_managed_users", "app_users", "app_reports", "app_audit", "app_excuses"]) await connection.query(`DELETE FROM ${table}`);
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
            if (ownsTransaction) await connection.commit();
        } catch (error) {
            if (ownsTransaction) await connection.rollback();
            throw error;
        } finally {
            if (ownsTransaction) connection.release();
        }
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
    return { loadState, saveSnapshot, isActivated, activate, deactivate, pool };
}

module.exports = { createMysqlRepository };
