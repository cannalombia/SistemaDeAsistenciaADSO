SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_runtime_state (
    state_key VARCHAR(100) NOT NULL PRIMARY KEY,
    payload JSON NOT NULL,
    expires_at DATETIME(3) NULL,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    KEY idx_runtime_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_sessions (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    user_key VARCHAR(191) NOT NULL,
    documento VARCHAR(30) NULL,
    correo VARCHAR(191) NULL,
    expires_at DATETIME(3) NOT NULL,
    last_seen_at DATETIME(3) NOT NULL,
    payload JSON NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    KEY idx_sessions_user (user_key),
    KEY idx_sessions_documento (documento),
    KEY idx_sessions_correo (correo),
    KEY idx_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_qr_tokens (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    owner_session_hash CHAR(64) NULL,
    ficha VARCHAR(30) NOT NULL,
    jornada VARCHAR(40) NOT NULL,
    fecha DATE NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    payload JSON NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_qr_owner (owner_session_hash),
    KEY idx_qr_lookup (ficha, fecha, jornada),
    KEY idx_qr_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_idempotency (
    key_hash CHAR(64) NOT NULL PRIMARY KEY,
    method VARCHAR(10) NOT NULL,
    request_path VARCHAR(255) NOT NULL,
    status_code SMALLINT UNSIGNED NOT NULL,
    response_headers JSON NOT NULL,
    response_body MEDIUMTEXT NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_idempotency_expires (expires_at),
    KEY idx_idempotency_route (method, request_path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_email_outbox (
    request_id VARCHAR(64) NOT NULL PRIMARY KEY,
    provider VARCHAR(30) NOT NULL,
    recipient VARCHAR(191) NOT NULL,
    payload JSON NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    available_at DATETIME(3) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    sent_at DATETIME(3) NULL,
    last_error VARCHAR(500) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    KEY idx_outbox_pending (status, available_at),
    KEY idx_outbox_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_instance_heartbeats (
    instance_id VARCHAR(191) NOT NULL PRIMARY KEY,
    build_id VARCHAR(191) NOT NULL,
    pid INT UNSIGNED NOT NULL,
    host_name VARCHAR(191) NOT NULL,
    started_at DATETIME(3) NOT NULL,
    last_seen_at DATETIME(3) NOT NULL,
    ready TINYINT(1) NOT NULL DEFAULT 1,
    metadata JSON NOT NULL,
    KEY idx_heartbeats_seen (last_seen_at),
    KEY idx_heartbeats_ready (ready, last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE app_attendance
    ADD UNIQUE KEY uq_attendance_effective (documento, ficha, fecha, jornada);

INSERT INTO app_state (state_key, payload)
VALUES ('data_revision', JSON_OBJECT('value', 0))
ON DUPLICATE KEY UPDATE payload = payload;
