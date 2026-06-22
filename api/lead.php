<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://limaferreiraadvogados.com.br');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

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

$to = 'contato@limaferreiraadvogados.com.br';
$subject = 'Novo lead - Raio-X da Dívida Empresarial';
$message = implode("\n", $lines);
$replyTo = filter_var($value('email'), FILTER_VALIDATE_EMAIL) ? $value('email') : $to;
$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'From: Lima Ferreira Advogados <contato@limaferreiraadvogados.com.br>',
    'Reply-To: ' . str_replace(["\r", "\n"], '', $replyTo),
    'X-Mailer: PHP/' . phpversion(),
];

$sent = mail($to, $subject, $message, implode("\r\n", $headers));

$leadRecord = [
    'id' => bin2hex(random_bytes(8)),
    'created_at' => gmdate('c'),
    'status' => 'novo',
    'email_delivery' => $sent ? 'sent' : 'failed',
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

$storageDir = dirname(__DIR__) . '/storage';
$leadsFile = $storageDir . '/leads.jsonl';

if (!is_dir($storageDir)) {
    mkdir($storageDir, 0755, true);
}

file_put_contents(
    $leadsFile,
    json_encode($leadRecord, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL,
    FILE_APPEND | LOCK_EX
);

if (!$sent) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'Não foi possível enviar o e-mail.']);
    exit;
}

echo json_encode(['ok' => true, 'channel' => 'email']);
