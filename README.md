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
- `assets/editorial/images/`: imagens editoriais otimizadas em WebP.
- `logos/`: assinaturas da marca.
- `.github/workflows/pages.yml`: publicacao automatica no GitHub Pages.

O formulario esta implementado no frontend e ainda precisa ser conectado ao
CRM, e-mail ou endpoint escolhido para producao.
