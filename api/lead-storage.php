<?php
declare(strict_types=1);

function lf_storage_dir(): string
{
    return dirname(__DIR__) . '/storage';
}

function lf_leads_file(): string
{
    return lf_storage_dir() . '/leads.jsonl';
}

function lf_mysql_migration_marker(): string
{
    return lf_storage_dir() . '/.mysql_migrated';
}

function lf_ensure_file_storage(): void
{
    $storageDir = lf_storage_dir();
    $leadsFile = lf_leads_file();

    if (!is_dir($storageDir)) {
        mkdir($storageDir, 0755, true);
    }

    if (!file_exists($leadsFile)) {
        file_put_contents($leadsFile, '');
    }
}

function lf_load_database_config(): array
{
    $config = [
        'host' => getenv('LF_DB_HOST') ?: '',
        'database' => getenv('LF_DB_NAME') ?: '',
        'user' => getenv('LF_DB_USER') ?: '',
        'password' => getenv('LF_DB_PASSWORD') ?: '',
        'charset' => getenv('LF_DB_CHARSET') ?: 'utf8mb4',
    ];

    $configFile = __DIR__ . '/database.config.php';
    if (is_readable($configFile)) {
        $fileConfig = require $configFile;
        if (is_array($fileConfig)) {
            foreach (['host', 'database', 'user', 'password', 'charset'] as $key) {
                if (isset($fileConfig[$key]) && is_string($fileConfig[$key])) {
                    $config[$key] = trim($fileConfig[$key]);
                }
            }
        }
    }

    return $config;
}

function lf_database_pdo(): ?PDO
{
    static $pdo = false;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    if ($pdo === null) {
        return null;
    }

    $config = lf_load_database_config();
    if (
        ($config['host'] ?? '') === ''
        || ($config['database'] ?? '') === ''
        || ($config['user'] ?? '') === ''
    ) {
        $pdo = null;
        return null;
    }

    if (!extension_loaded('pdo_mysql')) {
        $pdo = null;
        return null;
    }

    $charset = preg_match('/^[a-z0-9_]+$/i', (string) ($config['charset'] ?? ''))
        ? (string) $config['charset']
        : 'utf8mb4';
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', $config['host'], $config['database'], $charset);

    try {
        $pdo = new PDO($dsn, $config['user'], $config['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        lf_ensure_database_schema($pdo);
        lf_migrate_file_leads_to_database($pdo);

        return $pdo;
    } catch (Throwable) {
        $pdo = null;
        return null;
    }
}

function lf_ensure_database_schema(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS leads (
            id VARCHAR(32) NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NULL,
            status VARCHAR(32) NOT NULL DEFAULT \'novo\',
            email_delivery VARCHAR(32) NOT NULL DEFAULT \'unknown\',
            meta_event_id VARCHAR(128) NULL,
            notes TEXT NULL,
            payload_json LONGTEXT NOT NULL,
            meta_capi_json LONGTEXT NULL,
            PRIMARY KEY (id),
            KEY idx_created_at (created_at),
            KEY idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

function lf_normalize_datetime(?string $date): string
{
    if (!$date) {
        return gmdate('Y-m-d H:i:s');
    }

    try {
        return (new DateTimeImmutable($date))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    } catch (Throwable) {
        return gmdate('Y-m-d H:i:s');
    }
}

function lf_datetime_to_iso(?string $date): ?string
{
    if (!$date) {
        return null;
    }

    try {
        return (new DateTimeImmutable($date, new DateTimeZone('UTC')))->format('c');
    } catch (Throwable) {
        return $date;
    }
}

function lf_encode_json(array $data): string
{
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return $json === false ? '{}' : $json;
}

function lf_normalize_lead(array $lead): array
{
    $lead['id'] = (string) ($lead['id'] ?? bin2hex(random_bytes(8)));
    $lead['created_at'] = (string) ($lead['created_at'] ?? gmdate('c'));
    $lead['status'] = (string) ($lead['status'] ?? 'novo');
    $lead['email_delivery'] = (string) ($lead['email_delivery'] ?? 'unknown');
    $lead['meta_event_id'] = (string) ($lead['meta_event_id'] ?? '');
    $lead['notes'] = (string) ($lead['notes'] ?? '');
    $lead['payload'] = is_array($lead['payload'] ?? null) ? $lead['payload'] : [];
    if (isset($lead['meta_capi_delivery']) && !is_array($lead['meta_capi_delivery'])) {
        unset($lead['meta_capi_delivery']);
    }

    return $lead;
}

function lf_upsert_database_lead(PDO $pdo, array $lead): void
{
    $lead = lf_normalize_lead($lead);
    $statement = $pdo->prepare(
        'INSERT INTO leads (
            id, created_at, updated_at, status, email_delivery, meta_event_id, notes, payload_json, meta_capi_json
        ) VALUES (
            :id, :created_at, :updated_at, :status, :email_delivery, :meta_event_id, :notes, :payload_json, :meta_capi_json
        ) ON DUPLICATE KEY UPDATE
            updated_at = VALUES(updated_at),
            status = VALUES(status),
            email_delivery = VALUES(email_delivery),
            meta_event_id = VALUES(meta_event_id),
            notes = VALUES(notes),
            payload_json = VALUES(payload_json),
            meta_capi_json = VALUES(meta_capi_json)'
    );

    $statement->execute([
        ':id' => $lead['id'],
        ':created_at' => lf_normalize_datetime($lead['created_at']),
        ':updated_at' => isset($lead['updated_at']) ? lf_normalize_datetime((string) $lead['updated_at']) : null,
        ':status' => $lead['status'],
        ':email_delivery' => $lead['email_delivery'],
        ':meta_event_id' => $lead['meta_event_id'] !== '' ? $lead['meta_event_id'] : null,
        ':notes' => $lead['notes'],
        ':payload_json' => lf_encode_json($lead['payload']),
        ':meta_capi_json' => isset($lead['meta_capi_delivery']) && is_array($lead['meta_capi_delivery'])
            ? lf_encode_json($lead['meta_capi_delivery'])
            : null,
    ]);
}

function lf_append_file_lead(array $lead): void
{
    lf_ensure_file_storage();
    file_put_contents(
        lf_leads_file(),
        json_encode(lf_normalize_lead($lead), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL,
        FILE_APPEND | LOCK_EX
    );
}

function lf_store_lead(array $lead): void
{
    $pdo = lf_database_pdo();

    if ($pdo instanceof PDO) {
        lf_upsert_database_lead($pdo, $lead);
        return;
    }

    lf_append_file_lead($lead);
}

function lf_load_file_leads(): array
{
    lf_ensure_file_storage();
    $lines = file(lf_leads_file(), FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
    $leads = [];

    foreach ($lines as $line) {
        $lead = json_decode($line, true);
        if (!is_array($lead) || empty($lead['id'])) {
            continue;
        }
        $leads[] = lf_normalize_lead($lead);
    }

    usort($leads, static function (array $a, array $b): int {
        return strcmp((string) ($b['created_at'] ?? ''), (string) ($a['created_at'] ?? ''));
    });

    return $leads;
}

function lf_migrate_file_leads_to_database(PDO $pdo): void
{
    lf_ensure_file_storage();
    $marker = lf_mysql_migration_marker();

    if (file_exists($marker)) {
        return;
    }

    foreach (lf_load_file_leads() as $lead) {
        lf_upsert_database_lead($pdo, $lead);
    }

    file_put_contents($marker, gmdate('c'));
}

function lf_database_row_to_lead(array $row): array
{
    $payload = json_decode((string) ($row['payload_json'] ?? '{}'), true);
    $meta = json_decode((string) ($row['meta_capi_json'] ?? '{}'), true);
    $lead = [
        'id' => (string) ($row['id'] ?? ''),
        'created_at' => lf_datetime_to_iso((string) ($row['created_at'] ?? '')) ?? gmdate('c'),
        'status' => (string) ($row['status'] ?? 'novo'),
        'email_delivery' => (string) ($row['email_delivery'] ?? 'unknown'),
        'meta_event_id' => (string) ($row['meta_event_id'] ?? ''),
        'notes' => (string) ($row['notes'] ?? ''),
        'payload' => is_array($payload) ? $payload : [],
    ];

    if (isset($row['updated_at']) && $row['updated_at'] !== null) {
        $lead['updated_at'] = lf_datetime_to_iso((string) $row['updated_at']);
    }
    if (is_array($meta) && $meta !== []) {
        $lead['meta_capi_delivery'] = $meta;
    }

    return $lead;
}

function lf_load_leads(): array
{
    $pdo = lf_database_pdo();
    if (!$pdo instanceof PDO) {
        return lf_load_file_leads();
    }

    $statement = $pdo->query('SELECT * FROM leads ORDER BY created_at DESC, id DESC');
    $rows = $statement ? $statement->fetchAll() : [];

    return array_map('lf_database_row_to_lead', $rows);
}

function lf_update_lead(string $id, string $status, string $notes, array $allowedStatuses): void
{
    if (!array_key_exists($status, $allowedStatuses)) {
        $status = 'novo';
    }

    $pdo = lf_database_pdo();
    if ($pdo instanceof PDO) {
        $statement = $pdo->prepare(
            'UPDATE leads SET status = :status, notes = :notes, updated_at = :updated_at WHERE id = :id'
        );
        $statement->execute([
            ':id' => $id,
            ':status' => $status,
            ':notes' => $notes,
            ':updated_at' => gmdate('Y-m-d H:i:s'),
        ]);
        return;
    }

    $leads = lf_load_file_leads();
    foreach ($leads as &$lead) {
        if (($lead['id'] ?? '') !== $id) {
            continue;
        }
        $lead['status'] = $status;
        $lead['notes'] = $notes;
        $lead['updated_at'] = gmdate('c');
        break;
    }
    unset($lead);

    lf_ensure_file_storage();
    $content = '';
    foreach ($leads as $lead) {
        $content .= json_encode($lead, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    }
    file_put_contents(lf_leads_file(), $content, LOCK_EX);
}
