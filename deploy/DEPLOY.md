# Deploy — nova versão do Simulador (client-side, sem MobileSAM)

> ## ⚠️ LEIA ANTES DE PUBLICAR QUALQUER COISA DAQUI (19/09/2026)
>
> **A fonte de verdade é o SERVIDOR, não este repositório.**
>
> O `deploy/index.html` que estava aqui até 19/09 foi preparado em **10/09** e
> o site seguiu por outro caminho em **15/09**: a varinha foi refeita (cromância
> normalizada pelo brilho — passou de 29% pra 80% de acerto na sombra), ganhou
> arrasto ao vivo e "seguir sombras", e o **Toque inteligente (MediaPipe) foi
> REMOVIDO de propósito**. Publicar o arquivo antigo por cima teria devolvido o
> Toque e apagado a varinha nova.
>
> Em 19/09 o `deploy/index.html` foi **substituído pelo que está no ar**, com a
> correção da seleção >92% já aplicada (md5 `81d11837…`). As instruções abaixo
> valem; a seção "O que muda" descreve a virada de 11/09 e ficou como histórico.
>
> **Antes de publicar, sempre confira o que está no ar:**
> ```
> curl -s https://simulador.decorcolorssjc.com.br/ | md5sum
> ssh -i ~/.ssh/decor_vps root@2.24.210.90 "md5sum /opt/decorcolors-simulador/static/index.html"
> ```
> Se der diferente do `deploy/index.html` daqui, **o servidor é quem está certo** —
> baixe, aplique sua mudança em cima dele, e só então publique.
>
> Há teste: `node deploy/teste-varinha.mjs <arquivo.html>`. Ele lê a função do
> próprio HTML, então roda contra o que você vai publicar E contra a página
> baixada do ar.

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
