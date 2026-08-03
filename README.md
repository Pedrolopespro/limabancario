# Lima Ferreira Direito Bancario Empresarial

Landing page responsiva para a frente de Direito Bancario Empresarial do Lima
Ferreira Advogados.

## Site publicado

- Producao: `https://limaferreiraadvogados.com.br/empresarial/`, servida pela
  HostGator.
- GitHub Pages: `https://pedrolopespro.github.io/limabancario/` (espelho
  tecnico).
- A publicacao na HostGator atualiza a landing page e os arquivos PHP do
  CRM/API a cada push na `main`.

## Executar localmente

```bash
python3 -m http.server 4173
```

Acesse `http://127.0.0.1:4173`.

## Estrutura

- `index.html`: landing page principal.
- `design-system.html`: catalogo visual.
- `styles/`: tokens e estilos.
- `scripts/`: interacoes e formulario conversacional.
- `scripts/tracking-config.js`: IDs públicos e endpoint usados pela mensuração.
- `scripts/tracking.js`: GTM, GA4, Meta Pixel, Google Ads, consentimento e eventos.
- `api/lead.php`: endpoint em PHP usado no HostGator para enviar leads por e-mail e registrar no CRM.
- `api/lead-storage.php`: camada de armazenamento do CRM, com MySQL e fallback em arquivo.
- `CRM/`: mini CRM interno em PHP para acompanhar leads recebidos.
- `storage/`: armazenamento local do CRM protegido por `.htaccess`.
- `painel/`: painel interno de configuração e diagnóstico.
- `assets/editorial/images/`: imagens editoriais otimizadas em WebP.
- `logos/`: assinaturas da marca.
- `.github/workflows/pages.yml`: publicacao automatica no GitHub Pages.

## Painel de rastreamento

- Producao: `https://limaferreiraadvogados.com.br/empresarial/painel/`
- A senha do painel nao deve ser registrada no repositorio. Guarde-a no
  gerenciador de senhas da operacao; o codigo mantem apenas o hash de
  verificacao.
- O painel nao aparece na navegacao e possui `noindex`.
- A publicacao exige um Fine-grained Personal Access Token do GitHub com
  `Contents: Read and write` somente neste repositorio.
- O token e usado em memoria e nao fica salvo no navegador ou no site.

O formulario envia os dados ao endpoint `api/lead.php`, que dispara um e-mail
para `leads@limaferreiraadvogados.com.br` e registra o lead no MySQL do CRM.
Se o MySQL nao estiver configurado ou ficar indisponivel, o endpoint usa o
arquivo `storage/leads.jsonl` como fallback. A conversao `generate_lead`/`Lead`
somente e disparada depois que o endpoint confirma o recebimento com status HTTP
`2xx`. Se o e-mail falhar, o formulario usa o WhatsApp configurado como fallback
para nao perder o lead.

### Meta Conversions API

O endpoint `api/lead.php` tambem esta preparado para enviar o evento `Lead` pela
Conversions API da Meta. As credenciais devem ficar apenas no servidor, nunca no
GitHub nem no painel publico. Na HostGator, crie uma copia de
`api/meta-capi.config.example.php` chamada `api/meta-capi.config.php` e preencha:

- `pixel_id`: ID do Pixel/Dataset correto da campanha.
- `access_token`: token da Conversions API.
- `test_event_code`: opcional, usado para testar no Events Manager.

## CRM interno

- URL em producao: `https://limaferreiraadvogados.com.br/empresarial/CRM/`
- Acesso protegido por senha e com `noindex`.
- Permite visualizar leads, alterar status e salvar observacoes internas.
- A base principal fica em MySQL quando `api/database.config.php` existe no
  servidor.
- O arquivo bruto `storage/leads.jsonl` fica como fallback e nao deve ser
  versionado nem sobrescrito em deploy.

### MySQL do CRM

As credenciais do banco devem ficar apenas no servidor, nunca no GitHub. Na
HostGator, crie uma copia de `api/database.config.example.php` chamada
`api/database.config.php` e preencha:

- `host`: normalmente `localhost`.
- `database`: nome completo do banco criado no cPanel.
- `user`: usuario MySQL autorizado no banco.
- `password`: senha do usuario MySQL.
