<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://limaferreiraadvogados.com.br');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/lead-storage.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Método não permitido.']);
    exit;
}

$rawBody = file_get_contents('php://input') ?: '';
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
$payload = [];

if (stripos($contentType, 'application/json') !== false) {
    $decoded = json_decode($rawBody, true);
    if (is_array($decoded)) {
        $payload = $decoded;
    }
} else {
    $payload = $_POST;
}

if (!$payload) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Dados não recebidos.']);
    exit;
}

$value = static function (string $key) use ($payload): string {
    $raw = $payload[$key] ?? '';
    if (is_array($raw)) {
        $raw = implode(', ', $raw);
    }

    return trim((string) $raw);
};

$sanitize = static function (string $text): string {
    $text = strip_tags($text);
    $text = preg_replace('/[\r\n]+/', "\n", $text) ?? $text;

    return trim($text);
};

function lf_load_meta_capi_config(): array
{
    $config = [
        'pixel_id' => getenv('META_PIXEL_ID') ?: '',
        'access_token' => getenv('META_ACCESS_TOKEN') ?: '',
        'test_event_code' => getenv('META_TEST_EVENT_CODE') ?: '',
    ];

    $configFile = __DIR__ . '/meta-capi.config.php';
    if (is_readable($configFile)) {
        $fileConfig = require $configFile;
        if (is_array($fileConfig)) {
            foreach (['pixel_id', 'access_token', 'test_event_code'] as $key) {
                if (!empty($fileConfig[$key]) && is_string($fileConfig[$key])) {
                    $config[$key] = trim($fileConfig[$key]);
                }
            }
        }
    }

    return $config;
}

function lf_hash_meta_value(string $value): string
{
    return hash('sha256', strtolower(trim($value)));
}

function lf_meta_post_json(string $url, array $payload): array
{
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($body === false) {
        return ['ok' => false, 'status_code' => 0, 'error' => 'json_encode_failed'];
    }

    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 5,
        ]);

        $responseBody = curl_exec($curl);
        $statusCode = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_error($curl);
        curl_close($curl);

        if ($responseBody === false) {
            return ['ok' => false, 'status_code' => $statusCode, 'error' => $error ?: 'curl_failed'];
        }

        $decoded = json_decode((string) $responseBody, true);

        return [
            'ok' => $statusCode >= 200 && $statusCode < 300,
            'status_code' => $statusCode,
            'response' => is_array($decoded) ? $decoded : [],
        ];
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => $body,
            'timeout' => 5,
            'ignore_errors' => true,
        ],
    ]);

    $responseBody = file_get_contents($url, false, $context);
    $statusCode = 0;
    foreach ($http_response_header ?? [] as $header) {
        if (preg_match('/^HTTP\/\S+\s+(\d{3})/', $header, $match)) {
            $statusCode = (int) $match[1];
            break;
        }
    }

    if ($responseBody === false) {
        return ['ok' => false, 'status_code' => $statusCode, 'error' => 'http_request_failed'];
    }

    $decoded = json_decode((string) $responseBody, true);

    return [
        'ok' => $statusCode >= 200 && $statusCode < 300,
        'status_code' => $statusCode,
        'response' => is_array($decoded) ? $decoded : [],
    ];
}

function lf_send_meta_capi_lead(array $config, array $leadPayload, string $eventId): array
{
    $pixelId = trim((string) ($config['pixel_id'] ?? ''));
    $accessToken = trim((string) ($config['access_token'] ?? ''));

    if (!preg_match('/^\d{5,25}$/', $pixelId) || $accessToken === '') {
        return ['status' => 'skipped', 'reason' => 'missing_meta_config', 'event_id' => $eventId];
    }

    $userData = [];
    $email = trim((string) ($leadPayload['email'] ?? ''));
    if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $userData['em'] = [lf_hash_meta_value($email)];
    }

    $phoneDigits = preg_replace('/\D+/', '', (string) ($leadPayload['phone'] ?? '')) ?? '';
    if ($phoneDigits !== '') {
        $userData['ph'] = [lf_hash_meta_value($phoneDigits)];
    }

    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if ($ip !== '') {
        $userData['client_ip_address'] = $ip;
    }

    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
    if ($userAgent !== '') {
        $userData['client_user_agent'] = $userAgent;
    }

    $fbp = trim((string) ($_COOKIE['_fbp'] ?? $leadPayload['fbp'] ?? ''));
    if ($fbp !== '') {
        $userData['fbp'] = $fbp;
    }

    $fbc = trim((string) ($_COOKIE['_fbc'] ?? $leadPayload['fbc'] ?? ''));
    $fbclid = trim((string) ($leadPayload['fbclid'] ?? ''));
    if ($fbc === '' && $fbclid !== '') {
        $fbc = 'fb.1.' . (string) round(microtime(true) * 1000) . '.' . $fbclid;
    }
    if ($fbc !== '') {
        $userData['fbc'] = $fbc;
    }

    $pageUrl = filter_var($leadPayload['page_url'] ?? '', FILTER_VALIDATE_URL)
        ? (string) $leadPayload['page_url']
        : 'https://limaferreiraadvogados.com.br/empresarial/';

    $event = [
        'event_name' => 'Lead',
        'event_time' => time(),
        'event_id' => $eventId,
        'action_source' => 'website',
        'event_source_url' => $pageUrl,
        'user_data' => $userData,
        'custom_data' => [
            'currency' => 'BRL',
            'value' => 1,
            'lead_type' => 'raio_x_divida_empresarial',
            'content_name' => 'Raio-X da Dívida Empresarial',
        ],
    ];

    $body = ['data' => [$event]];
    $testEventCode = trim((string) ($config['test_event_code'] ?? ''));
    if ($testEventCode !== '') {
        $body['test_event_code'] = $testEventCode;
    }

    $url = sprintf(
        'https://graph.facebook.com/v19.0/%s/events?access_token=%s',
        rawurlencode($pixelId),
        rawurlencode($accessToken)
    );
    $result = lf_meta_post_json($url, $body);
    $response = is_array($result['response'] ?? null) ? $result['response'] : [];
    $error = $response['error']['message'] ?? ($result['error'] ?? null);

    return [
        'status' => ($result['ok'] ?? false) ? 'sent' : 'failed',
        'status_code' => $result['status_code'] ?? 0,
        'event_id' => $eventId,
        'events_received' => $response['events_received'] ?? null,
        'error' => is_string($error) ? $error : null,
    ];
}

$requiredFields = ['name', 'phone', 'email', 'company'];
$missingFields = [];

foreach ($requiredFields as $field) {
    if ($value($field) === '') {
        $missingFields[] = $field;
    }
}

if ($missingFields) {
    http_response_code(422);
    echo json_encode([
        'ok' => false,
        'error' => 'Campos obrigatórios ausentes.',
        'fields' => $missingFields,
    ]);
    exit;
}

$labels = [
    'debt_amount' => 'Valor aproximado das dívidas',
    'debt_type' => 'Dívida que mais preocupa',
    'lawsuit' => 'Existe processo judicial',
    'asset_block' => 'Bloqueio, penhora ou risco',
    'company' => 'Empresa',
    'cnpj' => 'CNPJ',
    'location' => 'Cidade/Estado',
    'case_note' => 'Principal preocupação',
    'name' => 'Nome',
    'phone' => 'WhatsApp',
    'email' => 'E-mail',
    'consent' => 'Autorização de contato',
    'utm_source' => 'UTM Source',
    'utm_medium' => 'UTM Medium',
    'utm_campaign' => 'UTM Campaign',
    'utm_content' => 'UTM Content',
    'utm_term' => 'UTM Term',
    'page_url' => 'Página de origem',
    'referrer' => 'Referenciador',
    'submitted_at' => 'Enviado em',
];

$lines = [
    'Novo lead recebido pelo Raio-X da Dívida Empresarial.',
    '',
    'Resumo do formulário:',
];

foreach ($labels as $field => $label) {
    $fieldValue = $sanitize($value($field));
    if ($fieldValue === '') {
        continue;
    }

    if ($fieldValue === 'on') {
        $fieldValue = 'Sim';
    }

    $lines[] = "{$label}: {$fieldValue}";
}

$to = 'leads@limaferreiraadvogados.com.br';
$subject = 'Novo lead - Raio-X da Dívida Empresarial';
$message = implode("\n", $lines);
$replyTo = filter_var($value('email'), FILTER_VALIDATE_EMAIL) ? $value('email') : $to;
$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'From: Lima Ferreira Advogados <leads@limaferreiraadvogados.com.br>',
    'Cc: contaslopeshpl@gmail.com',
    'Reply-To: ' . str_replace(["\r", "\n"], '', $replyTo),
    'X-Mailer: PHP/' . phpversion(),
];

$leadId = bin2hex(random_bytes(8));
$providedEventId = $value('meta_event_id') !== '' ? $value('meta_event_id') : $value('event_id');
$eventId = preg_match('/^[a-z0-9_.:-]{8,128}$/i', $providedEventId) ? $providedEventId : $leadId;
$sent = mail($to, $subject, $message, implode("\r\n", $headers));

$leadRecord = [
    'id' => $leadId,
    'created_at' => gmdate('c'),
    'status' => 'novo',
    'email_delivery' => $sent ? 'sent' : 'failed',
    'meta_event_id' => $eventId,
    'notes' => '',
    'payload' => [],
];

foreach ($labels as $field => $label) {
    $fieldValue = $sanitize($value($field));
    if ($fieldValue === '') {
        continue;
    }

    $leadRecord['payload'][$field] = $fieldValue === 'on' ? 'Sim' : $fieldValue;
}

$metaPayload = $leadRecord['payload'];
foreach (['fbclid', 'fbc', 'fbp', 'meta_event_id'] as $trackingField) {
    $trackingValue = $sanitize($value($trackingField));
    if ($trackingValue !== '') {
        $metaPayload[$trackingField] = $trackingValue;
    }
}

$leadRecord['meta_capi_delivery'] = $sent
    ? lf_send_meta_capi_lead(lf_load_meta_capi_config(), $metaPayload, $eventId)
    : ['status' => 'skipped', 'reason' => 'email_delivery_failed', 'event_id' => $eventId];

lf_store_lead($leadRecord);

if (!$sent) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'Não foi possível enviar o e-mail.']);
    exit;
}

echo json_encode(['ok' => true, 'channel' => 'email', 'event_id' => $eventId]);
