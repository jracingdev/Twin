# Conectar WhatsApp e Telegram ao vendedor clonado

Guia operacional para o piloto: **qualquer owner/admin da organização** conecta a conta Business/Bot ao twin do melhor vendedor, de forma controlada.

## Modelo honesto

| Caminho | O que faz | Auto-envio? |
|---------|-----------|-------------|
| **WhatsApp Business API (Meta Cloud)** | Webhook → Twin → resposta no número Business | Sim, no modo **Agente** |
| **WhatsApp pessoal / WhatsApp Web** | Extensão Copilot sugere; humano envia | **Não** (nunca Baileys/Evolution) |
| **Telegram Bot API** | BotFather → token + secret no Twin | Sim, no modo **Agente** |

## Controlo (RBAC + modos)

1. Só papéis **owner** e **admin** criam/alteram/removem credenciais de canal (`role:owner,admin` na API).
2. O canal aponta para **um twin** (o do melhor vendedor da org).
3. Modos:
   - **Assistente** — sugestão interna, sem envio.
   - **Copiloto** — Inbox; humano aprova e envia.
   - **Agente** — envia sozinho se confiança ≥ limiar; senão cai na Inbox (`auto_fallback`).

UI: [Configurações → Canais](/settings/channels).

---

## Pré-requisitos do twin (clone)

1. Export oficial das conversas do melhor vendedor (WhatsApp `.txt` / Telegram `result.json`).
2. Em [/import](/import): twin de destino + **nome do vendedor** como no export + arquivo.
3. No twin: **Modo vendedor** ligado + intensidade (2–4).
4. DNA ativo (job automático pós-import).
5. Worker com fila `channel` (ver abaixo).

Playbook completo do clone: [seller-clone-agent.md](./seller-clone-agent.md).

---

## WhatsApp Business API (passo a passo)

### 1. Meta for Developers

1. [developers.facebook.com](https://developers.facebook.com/) → app tipo **Business**.
2. Produto **WhatsApp** → API Setup.
3. Anote **Phone Number ID**, gere **Access Token** permanente (`whatsapp_business_messaging`).
4. App settings → **App Secret**.

### 2. No Twin

1. Login como **owner** ou **admin**.
2. [/settings/channels](/settings/channels).
3. Selecione o **twin do melhor vendedor**.
4. Canal **WhatsApp Business API**, modo **Agente** (ou Copiloto no início).
5. Preencha Phone Number ID, Access Token, Verify Token (botão Gerar), App Secret.
6. **Conectar canal** → copie a **URL do webhook** completa.

### 3. Webhook na Meta

1. WhatsApp → Configuration → Webhook.
2. Callback URL = URL do Twin.
3. Verify token = o mesmo do Twin.
4. Assine **messages** → Verify and save.

### 4. Teste

Envie texto ao número Business. Com modo Agente + score ≥ limiar → resposta automática. Senão → [/inbox](/inbox).

---

## Telegram Bot (passo a passo)

### 1. BotFather

1. [@BotFather](https://t.me/BotFather) → `/newbot`.
2. Copie o **Bot Token**.

### 2. No Twin

1. [/settings/channels](/settings/channels) → canal **Telegram**.
2. Twin do melhor vendedor + modo Agente/Copiloto.
3. Bot Token + **Secret Token** (botão Gerar — obrigatório em produção).
4. Conectar → copie a **webhook URL**.

### 3. Registrar webhook

```bash
curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook" \
  -d "url={WEBHOOK_URL}" \
  -d "secret_token={SECRET_TOKEN}"
```

O header `X-Telegram-Bot-Api-Secret-Token` deve bater com o `secret_token` salvo no Twin.

- **Produção:** sem `secret_token` o Twin **rejeita** o webhook (fail-closed).
- **Local/dev:** aceita sem secret com warning nos logs — ainda assim configure o secret.

### 4. Teste

Envie texto ao bot. Só mensagens de **texto** entram no pipeline.

---

## Worker e segredos (obrigatório para “funcionar”)

```bash
# API — filas default (import/DNA) + channel (live)
php artisan queue:work redis --queue=default,channel --sleep=3 --tries=3
```

| Item | Valor |
|------|--------|
| `QUEUE_CONNECTION` | `redis` (não `sync` em piloto com webhooks) |
| `AI_ENGINE_SECRET` | **Idêntico** em `apps/api/.env` e `apps/ai-engine/.env` |
| AI Engine | rodando (porta 8000) |
| Supervisor (VPS) | `infra/aapanel/supervisor-twin.conf.example` com `--queue=default,channel` |

Sem a fila `channel`: webhook retorna 200 e **nada responde**.

---

## Copiloto WhatsApp Web (conta pessoal)

1. Carregue a extensão em `apps/browser-extension`.
2. Autentique no Twin.
3. Abra o chat no WhatsApp Web — o Twin sugere; você envia.

Detalhes: [whatsapp-copilot.md](./whatsapp-copilot.md).

---

## Limitações honestas

- Só **texto** (mídia/áudio/sticker ignorados).
- WhatsApp auto = **Business API** apenas.
- Score de confiança é similaridade de estilo (heurística + embeddings opcionais) — ajuste o limiar no piloto.
- Templates Meta / janela 24h: fora do escopo deste guia; use conversas iniciadas pelo cliente.
- Pinecone/OpenAI opcionais: sem eles o RAG fica reduzido (DNA heurístico ainda funciona).

## Links

| Recurso | Doc / URL |
|---------|-----------|
| Canais live (arquitetura) | [channels.md](./channels.md) |
| Clone do vendedor E2E | [seller-clone-agent.md](./seller-clone-agent.md) |
| Primeiros passos piloto | [piloto-primeiros-passos.md](./piloto-primeiros-passos.md) |
| Inbox | `/inbox` |
| Canais | `/settings/channels` |
