# Deploy — nova versão do Simulador (client-side, sem MobileSAM)

**Site alvo:** https://simulador.decorcolorssjc.com.br/ (VPS próprio, nginx + uvicorn)
**Quando:** a partir de 11/09/2026 — substitui a versão atual.
**Preparado em:** 10/09/2026, a partir do HTML que estava no ar (`_backup_prod_20260910.html`).

---

## O que muda

- Segmentação (achar a parede) agora roda **no navegador** (MediaPipe/Google + `magic_touch.tflite`).
  Não usa mais `/api/upload` nem `/api/segment` — **torch/MobileSAM/uvicorn deixam de ser necessários**.
- Novo: varinha mágica, pincel, **várias paredes/cores na mesma foto**, botão **"Baixar imagem"**,
  seção **"Projeto do ambiente → vídeo tour"**.
- **Mantido igual ao que está no ar:** SEO/OG, favicons, Meta Pixel `1033624198703952`,
  Google Ads `AW-17763891670` + GA4 `G-CFT6K8BW11`, evento `Lead`/`conversion` no clique do WhatsApp
  (testado: dispara `fbq('track','Lead')` + `gtag('event','conversion', AW-17763891670/xJGVCLySjsYcENbzvZZC`),
  topbar com logo + "Voltar ao site" + WhatsApp, faixa CTA, rodapé com endereço/telefone.
- `palette.json` **não muda** (conferido: idêntico ao que já está em `/static/palette.json`).

---

## Arquivos para subir (2)

| Arquivo local | Vai para (no servidor) |
|---|---|
| `deploy/index.html` | o documento servido em `/` — hoje é `…/static/index.html` (`/static/index.html` responde 200 e o app faz `FileResponse(STATIC_DIR/"index.html")`) |
| `deploy/static/models/magic_touch.tflite` (6,2 MB) | `…/static/models/magic_touch.tflite` (criar a pasta `models/`) |

Depois de subir, confira:
- `https://simulador.decorcolorssjc.com.br/static/models/magic_touch.tflite` → **200** (antes: 404)
- abrir o site, subir uma foto, tocar na parede → seleção aparece em ~1 s (1º acesso baixa ~4 MB de
  runtime do jsDelivr e fica em cache)

---

## Servidor

**Opção A — sem tocar em nada (recomendada pro 1º dia):**
deixa o uvicorn/app.py rodando como está. Ele continua servindo `/` e `/static/*`.
Os endpoints `/api/*` ficam parados, sem uso. Zero risco, reversível trocando 1 arquivo.

**Opção B — depois que estabilizar:**
- Apontar o nginx pra servir `…/static/index.html` direto (sem proxy pro uvicorn no `location /`).
- Parar o serviço do uvicorn e liberar o torch/venv (~1,5 GB) do servidor.
- Manter só o nginx servindo estático: `index.html`, `/static/palette.json`,
  `/static/models/magic_touch.tflite`, `/static/brand/*`.

---

## Rollback

Guardar o `index.html` atual do servidor antes de trocar (cópia local:
`deploy/_backup_prod_20260910.html`). Pra voltar: restaura esse arquivo em `…/static/index.html`.
Se tiver usado a Opção B, religar o uvicorn e o proxy do nginx.

---

## CSP / headers

O `index.html` novo carrega de `https://cdn.jsdelivr.net` (runtime do MediaPipe: `vision_bundle.mjs` + `/wasm`).
Se o nginx tiver `Content-Security-Policy`, incluir `https://cdn.jsdelivr.net` em `script-src` e `connect-src`
(o `.tflite` é same-origin, `/static/`). A versão atual no ar não tem CSP restritiva — provavelmente nada a fazer.
