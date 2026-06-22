# Lima Ferreira Direito Bancario Empresarial

Landing page responsiva para a frente de Direito Bancario Empresarial do Lima
Ferreira Advogados.

## Site publicado

- GitHub Pages: `https://pedrolopespro.github.io/limabancario/`
- A publicacao e atualizada automaticamente a cada push na branch `main`.

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
- `api/lead.php`: endpoint em PHP usado no HostGator para enviar leads por e-mail.
- `painel/`: painel interno de configuração e diagnóstico.
- `assets/editorial/images/`: imagens editoriais otimizadas em WebP.
- `logos/`: assinaturas da marca.
- `.github/workflows/pages.yml`: publicacao automatica no GitHub Pages.

## Painel de rastreamento

- Producao: `https://pedrolopespro.github.io/limabancario/painel/`
- Chave inicial: `LF-2026-TRACK`
- O painel nao aparece na navegacao e possui `noindex`.
- A publicacao exige um Fine-grained Personal Access Token do GitHub com
  `Contents: Read and write` somente neste repositorio.
- O token e usado em memoria e nao fica salvo no navegador ou no site.

O formulario envia os dados ao endpoint `api/lead.php`, que dispara um e-mail
para `contato@limaferreiraadvogados.com.br`. A conversao
`generate_lead`/`Lead` somente e disparada depois que o endpoint confirma o
recebimento com status HTTP `2xx`. Se o e-mail falhar, o formulario usa o
WhatsApp configurado como fallback para nao perder o lead.
