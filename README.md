# DecorColors — Simulador de Parede

Protótipo: a pessoa envia a foto do ambiente, toca na parede que quer pintar, e a IA (MobileSAM, open source) identifica a área. A cor escolhida no leque (1.001 cores do catálogo tintométrico) é aplicada preservando sombra e luz reais da foto.

## Rodar localmente

```
pip install -r requirements.txt
uvicorn app:app --reload --port 8899
```

Abra `http://127.0.0.1:8899`.

## Deploy no Render

1. Suba este repositório para o GitHub.
2. No Render: **New > Web Service**, conecte o repositório.
3. Environment: **Docker** (usa o `Dockerfile` deste projeto).
4. Escolha um plano com pelo menos ~1 GB de RAM — o modelo de IA (PyTorch + MobileSAM) não roda de forma confiável no plano gratuito de 512 MB.
5. Nenhuma variável de ambiente é obrigatória; o checkpoint do MobileSAM (~40 MB) é baixado automaticamente na primeira inicialização.

## Como funciona

- `POST /api/upload`: recebe a foto, roda o encoder do MobileSAM uma vez (custo maior, ~2-3s em CPU) e guarda o resultado em memória.
- `POST /api/segment`: recebe pontos (clique na parede = positivo, "remover área" = negativo) e devolve a máscara em poucos décimos de segundo, reaproveitando o encode já feito.
- O recolorir em si acontece 100% no navegador (`static/index.html`), usando `globalCompositeOperation = 'color'` do canvas sobre a máscara — por isso trocar de cor depois de segmentar é instantâneo.
