CREATE TABLE IF NOT EXISTS leads (
    id VARCHAR(32) NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'novo',
    email_delivery VARCHAR(32) NOT NULL DEFAULT 'unknown',
    meta_event_id VARCHAR(128) NULL,
    notes TEXT NULL,
    payload_json LONGTEXT NOT NULL,
    meta_capi_json LONGTEXT NULL,
    PRIMARY KEY (id),
    KEY idx_created_at (created_at),
    KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
