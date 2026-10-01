CREATE TABLE IF NOT EXISTS app_excuses (
    row_key VARCHAR(191) NOT NULL PRIMARY KEY,
    documento VARCHAR(30) NOT NULL,
    ficha VARCHAR(30) NOT NULL,
    absence_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    submitted_at DATETIME(3) NOT NULL,
    payload JSON NOT NULL,
    KEY idx_excuses_documento (documento),
    KEY idx_excuses_ficha (ficha),
    KEY idx_excuses_date (absence_date),
    KEY idx_excuses_status (status),
    KEY idx_excuses_review (status, submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
