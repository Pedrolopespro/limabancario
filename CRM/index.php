<?php
declare(strict_types=1);

session_start();

header('X-Robots-Tag: noindex, nofollow', true);

const CRM_PASSWORD_HASH = '$2y$12$i0FSyEh2VpnLZmuFttZHc.8ikabEdoWk6kk5sOPwWrM1YroiTmEaq';

$storageDir = dirname(__DIR__) . '/storage';
$leadsFile = $storageDir . '/leads.jsonl';
$statuses = [
    'novo' => 'Novo',
    'em_contato' => 'Em contato',
    'qualificado' => 'Qualificado',
    'reuniao_marcada' => 'Reunião marcada',
    'sem_resposta' => 'Sem resposta',
    'fechado' => 'Fechado',
    'descartado' => 'Descartado',
];

function h(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function ensureStorage(string $storageDir, string $leadsFile): void
{
    if (!is_dir($storageDir)) {
        mkdir($storageDir, 0755, true);
    }

    if (!file_exists($leadsFile)) {
        file_put_contents($leadsFile, '');
    }
}

function loadLeads(string $leadsFile): array
{
    if (!file_exists($leadsFile)) {
        return [];
    }

    $lines = file($leadsFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
    $leads = [];

    foreach ($lines as $line) {
        $lead = json_decode($line, true);
        if (!is_array($lead) || empty($lead['id'])) {
            continue;
        }

        $lead['payload'] = is_array($lead['payload'] ?? null) ? $lead['payload'] : [];
        $lead['status'] = (string) ($lead['status'] ?? 'novo');
        $lead['notes'] = (string) ($lead['notes'] ?? '');
        $leads[] = $lead;
    }

    usort($leads, static function (array $a, array $b): int {
        return strcmp((string) ($b['created_at'] ?? ''), (string) ($a['created_at'] ?? ''));
    });

    return $leads;
}

function saveLeads(string $storageDir, string $leadsFile, array $leads): void
{
    ensureStorage($storageDir, $leadsFile);

    $content = '';
    foreach ($leads as $lead) {
        $content .= json_encode($lead, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    }

    file_put_contents($leadsFile, $content, LOCK_EX);
}

function formatDate(?string $date): string
{
    if (!$date) {
        return '-';
    }

    try {
        $timezone = new DateTimeZone('America/Sao_Paulo');
        $datetime = new DateTimeImmutable($date);
        return $datetime->setTimezone($timezone)->format('d/m/Y H:i');
    } catch (Throwable) {
        return $date;
    }
}

$isLoggedIn = !empty($_SESSION['crm_logged_in']);
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'login') {
    if (password_verify((string) ($_POST['password'] ?? ''), CRM_PASSWORD_HASH)) {
        $_SESSION['crm_logged_in'] = true;
        header('Location: ./');
        exit;
    }

    $error = 'Senha inválida.';
}

if (($_GET['logout'] ?? '') === '1') {
    session_destroy();
    header('Location: ./');
    exit;
}

ensureStorage($storageDir, $leadsFile);

if ($isLoggedIn && $_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'update') {
    $id = (string) ($_POST['id'] ?? '');
    $status = (string) ($_POST['status'] ?? 'novo');
    $notes = trim((string) ($_POST['notes'] ?? ''));
    $leads = loadLeads($leadsFile);

    foreach ($leads as &$lead) {
        if (($lead['id'] ?? '') !== $id) {
            continue;
        }

        if (array_key_exists($status, $statuses)) {
            $lead['status'] = $status;
        }
        $lead['notes'] = $notes;
        $lead['updated_at'] = gmdate('c');
        break;
    }
    unset($lead);

    saveLeads($storageDir, $leadsFile, $leads);
    header('Location: ./?lead=' . urlencode($id));
    exit;
}

$leads = $isLoggedIn ? loadLeads($leadsFile) : [];
$selectedId = (string) ($_GET['lead'] ?? ($leads[0]['id'] ?? ''));
$selectedLead = null;
$statusFilter = (string) ($_GET['status'] ?? '');

foreach ($leads as $lead) {
    if (($lead['id'] ?? '') === $selectedId) {
        $selectedLead = $lead;
        break;
    }
}

$filteredLeads = array_values(array_filter($leads, static function (array $lead) use ($statusFilter): bool {
    return $statusFilter === '' || ($lead['status'] ?? 'novo') === $statusFilter;
}));

$newCount = count(array_filter($leads, static fn (array $lead): bool => ($lead['status'] ?? 'novo') === 'novo'));
$qualifiedCount = count(array_filter($leads, static fn (array $lead): bool => in_array($lead['status'] ?? '', ['qualificado', 'reuniao_marcada', 'fechado'], true)));
?>
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>CRM | Lima Ferreira Advogados</title>
    <style>
      :root {
        color-scheme: light;
        --navy: #071827;
        --navy-soft: #12314a;
        --ivory: #f5f1e4;
        --line: rgba(7, 24, 39, 0.12);
        --muted: #65727d;
        --white: #ffffff;
        --gold: #b59a68;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: Inter, "Helvetica Neue", Arial, sans-serif;
        background: #f7f5ee;
        color: var(--navy);
      }

      a {
        color: inherit;
        text-decoration: none;
      }

      .login-page,
      .app {
        min-height: 100vh;
      }

      .login-page {
        display: grid;
        place-items: center;
        padding: 1.5rem;
        background:
          radial-gradient(circle at top right, rgba(181, 154, 104, 0.18), transparent 34rem),
          var(--navy);
      }

      .login-card {
        width: min(100%, 28rem);
        border-radius: 1.75rem;
        padding: 2rem;
        background: var(--ivory);
        box-shadow: 0 2rem 5rem rgba(0, 0, 0, 0.24);
      }

      .login-card p,
      .muted {
        color: var(--muted);
        line-height: 1.55;
      }

      label {
        display: grid;
        gap: 0.5rem;
        font-weight: 700;
      }

      input,
      select,
      textarea,
      button {
        font: inherit;
      }

      input,
      select,
      textarea {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 1rem;
        padding: 0.95rem 1rem;
        background: var(--white);
        color: var(--navy);
      }

      textarea {
        min-height: 9rem;
        resize: vertical;
      }

      button,
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 3rem;
        border: 0;
        border-radius: 999px;
        padding: 0.8rem 1.25rem;
        background: var(--navy);
        color: var(--ivory);
        font-weight: 800;
        cursor: pointer;
      }

      .error {
        color: #a83232;
        font-weight: 700;
      }

      .topbar {
        position: sticky;
        top: 0;
        z-index: 3;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 1rem clamp(1rem, 4vw, 3rem);
        border-bottom: 1px solid rgba(245, 241, 228, 0.12);
        background: var(--navy);
        color: var(--ivory);
      }

      .topbar strong {
        display: block;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .topbar span {
        color: rgba(245, 241, 228, 0.62);
        font-size: 0.9rem;
      }

      .layout {
        display: grid;
        grid-template-columns: minmax(18rem, 25rem) minmax(0, 1fr);
        min-height: calc(100vh - 5rem);
      }

      .sidebar {
        border-right: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.58);
      }

      .metrics {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
        padding: 1rem;
      }

      .metric {
        border: 1px solid var(--line);
        border-radius: 1rem;
        padding: 0.85rem;
        background: var(--white);
      }

      .metric span {
        color: var(--muted);
        font-size: 0.78rem;
      }

      .metric strong {
        display: block;
        margin-top: 0.35rem;
        font-size: 1.4rem;
      }

      .filters {
        padding: 0 1rem 1rem;
      }

      .lead-list {
        display: grid;
        gap: 0.65rem;
        max-height: calc(100vh - 15rem);
        overflow: auto;
        padding: 0 1rem 1rem;
      }

      .lead-item {
        display: grid;
        gap: 0.35rem;
        border: 1px solid var(--line);
        border-radius: 1.1rem;
        padding: 1rem;
        background: var(--white);
      }

      .lead-item.is-active {
        border-color: var(--gold);
        box-shadow: 0 1rem 2.5rem rgba(7, 24, 39, 0.08);
      }

      .lead-item small,
      .status {
        color: var(--muted);
      }

      .status {
        width: fit-content;
        border-radius: 999px;
        padding: 0.25rem 0.55rem;
        background: rgba(7, 24, 39, 0.07);
        font-size: 0.75rem;
        font-weight: 800;
      }

      .content {
        padding: clamp(1rem, 4vw, 3rem);
      }

      .detail-card {
        display: grid;
        gap: 1.5rem;
        max-width: 64rem;
        border: 1px solid var(--line);
        border-radius: 1.75rem;
        padding: clamp(1.25rem, 3vw, 2rem);
        background: var(--white);
        box-shadow: 0 1.5rem 4rem rgba(7, 24, 39, 0.08);
      }

      .detail-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
      }

      .detail-header h1 {
        margin: 0;
        font-size: clamp(2rem, 5vw, 4rem);
        letter-spacing: -0.06em;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
      }

      .field {
        border: 1px solid var(--line);
        border-radius: 1rem;
        padding: 0.9rem;
        background: #faf9f4;
      }

      .field span {
        display: block;
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .field strong {
        display: block;
        margin-top: 0.35rem;
        line-height: 1.45;
      }

      .actions {
        display: grid;
        gap: 1rem;
      }

      .empty {
        display: grid;
        place-items: center;
        min-height: 24rem;
        color: var(--muted);
        text-align: center;
      }

      @media (max-width: 52rem) {
        .topbar {
          align-items: flex-start;
          flex-direction: column;
        }

        .layout {
          grid-template-columns: 1fr;
        }

        .lead-list {
          max-height: none;
        }

        .grid,
        .metrics {
          grid-template-columns: 1fr;
        }

        .detail-header {
          flex-direction: column;
        }
      }
    </style>
  </head>
  <body>
    <?php if (!$isLoggedIn): ?>
      <main class="login-page">
        <form class="login-card" method="post">
          <input type="hidden" name="action" value="login" />
          <p class="muted">Lima Ferreira Advogados</p>
          <h1>CRM de leads</h1>
          <p>Área interna para acompanhar solicitações do Raio-X da Dívida Empresarial.</p>
          <?php if ($error): ?><p class="error"><?= h($error) ?></p><?php endif; ?>
          <label>
            Senha
            <input name="password" type="password" autocomplete="current-password" required autofocus />
          </label>
          <p>
            <button type="submit">Entrar</button>
          </p>
        </form>
      </main>
    <?php else: ?>
      <main class="app">
        <header class="topbar">
          <div>
            <strong>CRM Lima Ferreira</strong>
            <span>Leads do Raio-X da Dívida Empresarial</span>
          </div>
          <a class="button" href="?logout=1">Sair</a>
        </header>

        <div class="layout">
          <aside class="sidebar">
            <div class="metrics">
              <div class="metric"><span>Total</span><strong><?= count($leads) ?></strong></div>
              <div class="metric"><span>Novos</span><strong><?= $newCount ?></strong></div>
              <div class="metric"><span>Quentes</span><strong><?= $qualifiedCount ?></strong></div>
            </div>

            <form class="filters" method="get">
              <label>
                Filtrar por status
                <select name="status" onchange="this.form.submit()">
                  <option value="">Todos</option>
                  <?php foreach ($statuses as $key => $label): ?>
                    <option value="<?= h($key) ?>" <?= $statusFilter === $key ? 'selected' : '' ?>>
                      <?= h($label) ?>
                    </option>
                  <?php endforeach; ?>
                </select>
              </label>
            </form>

            <div class="lead-list">
              <?php foreach ($filteredLeads as $lead): ?>
                <?php $payload = $lead['payload'] ?? []; ?>
                <a
                  class="lead-item <?= (($lead['id'] ?? '') === ($selectedLead['id'] ?? '')) ? 'is-active' : '' ?>"
                  href="?lead=<?= urlencode((string) ($lead['id'] ?? '')) ?><?= $statusFilter ? '&status=' . urlencode($statusFilter) : '' ?>"
                >
                  <small><?= h(formatDate($lead['created_at'] ?? null)) ?></small>
                  <strong><?= h($payload['name'] ?? 'Lead sem nome') ?></strong>
                  <span><?= h($payload['company'] ?? 'Empresa não informada') ?></span>
                  <span class="status"><?= h($statuses[$lead['status']] ?? $lead['status']) ?></span>
                </a>
              <?php endforeach; ?>
            </div>
          </aside>

          <section class="content">
            <?php if (!$selectedLead): ?>
              <div class="empty">
                <div>
                  <h1>Nenhum lead ainda.</h1>
                  <p>Quando o formulário receber solicitações, elas aparecerão aqui.</p>
                </div>
              </div>
            <?php else: ?>
              <?php $payload = $selectedLead['payload'] ?? []; ?>
              <article class="detail-card">
                <div class="detail-header">
                  <div>
                    <p class="muted"><?= h(formatDate($selectedLead['created_at'] ?? null)) ?></p>
                    <h1><?= h($payload['name'] ?? 'Lead') ?></h1>
                    <p class="muted"><?= h($payload['company'] ?? '') ?></p>
                  </div>
                  <span class="status"><?= h($statuses[$selectedLead['status']] ?? $selectedLead['status']) ?></span>
                </div>

                <div class="grid">
                  <?php
                    $displayFields = [
                        'phone' => 'WhatsApp',
                        'email' => 'E-mail',
                        'debt_amount' => 'Valor das dívidas',
                        'debt_type' => 'Dívida principal',
                        'lawsuit' => 'Processo judicial',
                        'asset_block' => 'Bloqueio ou penhora',
                        'location' => 'Localização',
                        'case_note' => 'Preocupação principal',
                        'page_url' => 'Página de origem',
                        'utm_source' => 'UTM Source',
                        'utm_campaign' => 'UTM Campaign',
                    ];
                  ?>
                  <?php foreach ($displayFields as $field => $label): ?>
                    <?php if (empty($payload[$field])) continue; ?>
                    <div class="field">
                      <span><?= h($label) ?></span>
                      <strong><?= nl2br(h((string) $payload[$field])) ?></strong>
                    </div>
                  <?php endforeach; ?>
                  <div class="field">
                    <span>Entrega do e-mail</span>
                    <strong><?= h($selectedLead['email_delivery'] === 'sent' ? 'Enviado' : 'Falhou') ?></strong>
                  </div>
                </div>

                <form class="actions" method="post">
                  <input type="hidden" name="action" value="update" />
                  <input type="hidden" name="id" value="<?= h($selectedLead['id'] ?? '') ?>" />
                  <label>
                    Status
                    <select name="status">
                      <?php foreach ($statuses as $key => $label): ?>
                        <option value="<?= h($key) ?>" <?= ($selectedLead['status'] ?? 'novo') === $key ? 'selected' : '' ?>>
                          <?= h($label) ?>
                        </option>
                      <?php endforeach; ?>
                    </select>
                  </label>
                  <label>
                    Observações internas
                    <textarea name="notes" placeholder="Ex.: falou no WhatsApp, reunião marcada, lead sem retorno..."><?= h($selectedLead['notes'] ?? '') ?></textarea>
                  </label>
                  <button type="submit">Salvar acompanhamento</button>
                </form>
              </article>
            <?php endif; ?>
          </section>
        </div>
      </main>
    <?php endif; ?>
  </body>
</html>
