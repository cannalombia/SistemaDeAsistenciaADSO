SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) NOT NULL PRIMARY KEY,
    checksum CHAR(64) NOT NULL,
    applied_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
    setting_value JSON NOT NULL,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_users (
    row_key VARCHAR(191) NOT NULL PRIMARY KEY,
    documento VARCHAR(30) NOT NULL,
    correo VARCHAR(191) NOT NULL,
    ficha VARCHAR(30) NULL,
    rol VARCHAR(30) NOT NULL,
    payload JSON NOT NULL,
    UNIQUE KEY uq_app_users_documento (documento),
    UNIQUE KEY uq_app_users_correo (correo),
    KEY idx_app_users_ficha (ficha),
    KEY idx_app_users_rol (rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_managed_users (
    row_key VARCHAR(191) NOT NULL PRIMARY KEY,
    documento VARCHAR(30) NULL,
    correo VARCHAR(191) NULL,
    rol VARCHAR(30) NULL,
    payload JSON NOT NULL,
    UNIQUE KEY uq_managed_documento (documento),
    UNIQUE KEY uq_managed_correo (correo),
    KEY idx_managed_rol (rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_apprentices (
    row_key VARCHAR(191) NOT NULL PRIMARY KEY,
    documento VARCHAR(30) NOT NULL,
    correo VARCHAR(191) NOT NULL,
    ficha VARCHAR(30) NULL,
    payload JSON NOT NULL,
    UNIQUE KEY uq_apprentices_documento (documento),
    UNIQUE KEY uq_apprentices_correo (correo),
    KEY idx_apprentices_ficha (ficha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_programs (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    nombre VARCHAR(191) NOT NULL,
    payload JSON NOT NULL,
    KEY idx_programs_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_environments (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    codigo VARCHAR(64) NOT NULL,
    payload JSON NOT NULL,
    UNIQUE KEY uq_environments_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_fichas (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    numero VARCHAR(30) NOT NULL,
    jornada VARCHAR(40) NOT NULL,
    programa_id VARCHAR(64) NOT NULL,
    instructor_key VARCHAR(191) NULL,
    payload JSON NOT NULL,
    UNIQUE KEY uq_fichas_numero (numero),
    KEY idx_fichas_jornada (jornada),
    KEY idx_fichas_instructor (instructor_key),
    KEY idx_fichas_programa (programa_id),
    CONSTRAINT fk_fichas_programa FOREIGN KEY (programa_id) REFERENCES app_programs (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_schedules (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    ficha_id VARCHAR(64) NOT NULL,
    ambiente_id VARCHAR(64) NOT NULL,
    instructor_key VARCHAR(191) NULL,
    dia VARCHAR(20) NOT NULL,
    payload JSON NOT NULL,
    KEY idx_schedules_ficha (ficha_id),
    KEY idx_schedules_ambiente (ambiente_id),
    KEY idx_schedules_instructor (instructor_key),
    KEY idx_schedules_dia (dia),
    CONSTRAINT fk_schedules_ficha FOREIGN KEY (ficha_id) REFERENCES app_fichas (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_schedules_ambiente FOREIGN KEY (ambiente_id) REFERENCES app_environments (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_attendance (
    row_key VARCHAR(191) NOT NULL PRIMARY KEY,
    documento VARCHAR(30) NOT NULL,
    ficha VARCHAR(30) NOT NULL,
    fecha DATE NOT NULL,
    jornada VARCHAR(40) NOT NULL,
    payload JSON NOT NULL,
    KEY idx_attendance_documento (documento),
    KEY idx_attendance_ficha (ficha),
    KEY idx_attendance_fecha (fecha),
    KEY idx_attendance_jornada (jornada),
    KEY idx_attendance_lookup (ficha, fecha, jornada, documento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_reports (
    row_key VARCHAR(191) NOT NULL PRIMARY KEY,
    created_at DATETIME(3) NULL,
    payload JSON NOT NULL,
    KEY idx_reports_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_audit (
    row_key VARCHAR(191) NOT NULL PRIMARY KEY,
    event_at DATETIME(3) NOT NULL,
    entity VARCHAR(80) NOT NULL,
    actor_key VARCHAR(191) NULL,
    payload JSON NOT NULL,
    KEY idx_audit_event_at (event_at),
    KEY idx_audit_entity (entity),
    KEY idx_audit_actor (actor_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_state (
    state_key VARCHAR(100) NOT NULL PRIMARY KEY,
    payload JSON NOT NULL,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
