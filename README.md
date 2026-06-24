# TWIN Platform

Gêmeo digital de comunicação — API Laravel, motor IA (FastAPI) e dashboard Next.js.

## Estrutura

| App | Caminho | Porta local |
|-----|---------|-------------|
| API | `apps/api` | 8080 |
| AI Engine | `apps/ai-engine` | 8000 |
| Web | `apps/web` | 3000 |
| Mobile | `apps/mobile` | — |
| Extensão Copilot | `apps/browser-extension` | — (Chrome/Edge) |

## Início rápido (Windows)

```powershell
cd d:\twin
.\scripts\local\setup.ps1
.\scripts\local\start.ps1
```

Guia completo: [docs/deployment/local-windows.md](docs/deployment/local-windows.md)

**MySQL no servidor:** [docs/deployment/mysql-server.md](docs/deployment/mysql-server.md) — scripts em `scripts/mysql/`

## Comandos após pull

```powershell
# API
cd d:\twin\apps\api
composer install
php artisan migrate --path=database/migrations/landlord --force
php artisan db:seed --force
php artisan tenants:provision --seed
# Obrigatório após seed: cria banco MySQL/SQLite de cada org (twin_tenant_*)

# Web
cd d:\twin\apps\web
npm install
npm run build

# AI Engine
cd d:\twin\apps\ai-engine
pip install -r requirements.txt

# Testes API (smoke)
cd d:\twin\apps\api
vendor\bin\phpunit
```

Com fila em background (Redis):

```powershell
# .env: QUEUE_CONNECTION=redis
php artisan queue:work
# AI Engine: CELERY_INGEST=true + worker celery
```

## Variáveis de ambiente

Copie `.env.example` para `.env` na raiz (ou `apps/api/.env`).

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `APP_KEY` | Sim | `php artisan key:generate` |
| `DB_*` | Sim | MySQL ou SQLite landlord |
| `AI_ENGINE_SECRET` | Sim | Igual em API e ai-engine |
| `AI_ENGINE_URL` | Sim | URL do motor (API → AI) |
| `OPENAI_API_KEY` | Não | LLM/embeddings reais |
| `PINECONE_API_KEY` | Não | RAG vetorial |
| `STRIPE_*` | Não | Billing test mode |
| `TWIN_REGISTRATION_ENABLED` | Não | `true` para cadastro público |
| `NEXT_PUBLIC_API_URL` | Web | Default `http://127.0.0.1:8080/api/v1` |

## Segredo interno (Laravel ↔ AI Engine)

`AI_ENGINE_SECRET` deve ser **idêntico** em `apps/api/.env` e `apps/ai-engine/.env`.

## Login demo

- E-mail: `admin@twin.local`
- Senha: `password`

Headers nas rotas autenticadas:

- `Authorization: Bearer {token}`
- `X-Tenant: {organization_id}`

## Cadastro de usuários

Por padrão `TWIN_REGISTRATION_ENABLED=false` — apenas admin/seed cria contas. Ative para `/signup` na web.

## Mobile

```bash
flutter run --dart-define=TWIN_API_URL=http://10.0.2.2:8080/api/v1 \
  --dart-define=TWIN_TOKEN=... \
  --dart-define=TWIN_TENANT_ID=...
```

No emulador Android use `10.0.2.2` em vez de `localhost`.

## Documentação API

- JSON: `GET http://127.0.0.1:8080/api/v1/docs`
- OpenAPI: `GET http://127.0.0.1:8080/api/v1/docs/openapi.yaml`
- UI web: `http://127.0.0.1:3000/docs`

## Canais live (WhatsApp, Telegram, Slack, Discord)

Guia de produto e setup em produção: [docs/product/channels.md](docs/product/channels.md) — configure em `/settings/channels`, aprove respostas em `/inbox`.

**WhatsApp Web (copiloto no navegador):** extensão em `apps/browser-extension/` — guia em [docs/product/whatsapp-copilot.md](docs/product/whatsapp-copilot.md).

## Checklist produção

- [ ] `APP_ENV=production`, `APP_DEBUG=false`
- [ ] MySQL: `twin_landlord` + `php artisan tenants:provision` (ver [mysql-server.md](docs/deployment/mysql-server.md))
- [ ] `QUEUE_CONNECTION=redis` + `queue:work redis --queue=default,channel` / Horizon
- [ ] `AI_ENGINE_SECRET` forte e rotacionado
- [ ] Stripe live keys + webhook endpoint público
- [ ] S3/MinIO para imports
- [ ] Pinecone + OpenAI
- [ ] CORS e `FRONTEND_URL` corretos
- [ ] Backups landlord e tenants

## Pinecone (opcional)

Sem `PINECONE_API_KEY`, o motor persiste mensagens no banco do tenant e extrai DNA localmente; RAG fica reduzido.
