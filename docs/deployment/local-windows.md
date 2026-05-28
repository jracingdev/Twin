# TWIN — rodar no servidor local (Windows)

Guia para desenvolvimento na sua máquina **sem Docker**.

## Pré-requisitos

| Ferramenta | Versão | Download |
|------------|--------|----------|
| PHP | 8.2+ | [windows.php.net](https://windows.php.net/download/) ou `winget install PHP.PHP.8.2` |
| MySQL | 8.0+ | [Laragon](https://laragon.org) (recomendado) ou XAMPP |
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Python | 3.12+ | [python.org](https://www.python.org/downloads/) |

Opcional: Redis (filas). No local, `QUEUE_CONNECTION=sync` no `.env` dispensa Redis.

## 1. Configuração rápida

```powershell
cd d:\twin
.\scripts\local\setup.ps1
```

Edite `apps\api\.env` se o MySQL tiver senha:

```
DB_USERNAME=root
DB_PASSWORD=sua_senha
```

## 2. Banco de dados

No MySQL (Laragon: Menu → MySQL → HeidiSQL ou terminal):

```sql
CREATE DATABASE twin_landlord CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Migrations:

```powershell
cd d:\twin\apps\api
php artisan migrate --path=database/migrations/landlord
php artisan db:seed
php artisan tenants:provision --seed
```

O comando `tenants:provision` cria o banco SQLite/MySQL de cada organização (tenant), aplica as migrations tenant e, com `--seed`, popula um twin demo. Execute sempre após `db:seed` quando houver novas organizações ou migrations tenant.

## 3. Motor de IA

```powershell
cd d:\twin\apps\ai-engine
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -e ..\..\packages\import-parsers
```

Teste: `curl http://127.0.0.1:8000/health`

### Treino DNA (`dna_extract`) e Redis

Jobs de treino usam **Celery + Redis**. Sem Redis, o motor IA antigo ficava ~65s tentando conectar e a API Laravel estourava timeout (15s).

**Opção A — com Redis (recomendado para importação assíncrona):**

```powershell
# Ex.: Docker
docker run -d --name twin-redis -p 6379:6379 redis:7-alpine

cd d:\twin\apps\ai-engine
.\.venv\Scripts\Activate.ps1
$env:REDIS_URL="redis://127.0.0.1:6379/0"
$env:LARAVEL_API_URL="http://127.0.0.1:8080"
celery -A app.celery_app worker -l info -P solo
```

**Opção B — dev sem Redis:** o `start.ps1` define `CELERY_TASK_ALWAYS_EAGER=true` e o treino roda inline (~1s).

Reinicie o uvicorn do AI engine após alterar variáveis de ambiente.

## 4. Dashboard web

```powershell
cd d:\twin\apps\web
npm install
npm run dev
```

Abra http://127.0.0.1:3000

## 5. Iniciar tudo de uma vez

```powershell
cd d:\twin
.\scripts\local\start.ps1
```

Abre 3 janelas: API (8080), AI (8000), Web (3000).

## URLs locais

| Serviço | URL |
|---------|-----|
| API | http://127.0.0.1:8080 |
| Health API | http://127.0.0.1:8080/up |
| AI Engine | http://127.0.0.1:8000/health |
| Dashboard | http://127.0.0.1:3000 |

## Segredo Laravel ↔ AI Engine

`AI_ENGINE_SECRET` deve ser o **mesmo valor** em `apps/api/.env` e `apps/ai-engine/.env` (e `LARAVEL_API_URL=http://127.0.0.1:8080` no motor IA para callbacks).

## App mobile

Use o IP da máquina na LAN, não `localhost` — veja [README.md](../../README.md#app-mobile--url-base-da-api).

## Pinecone / OpenAI (opcional)

Sem chaves, o motor IA usa **respostas fallback** e ignora vetores; DNA e import usam mensagens no banco do tenant. Para RAG completo, adicione em `.env`:

```
PINECONE_API_KEY=sua-chave
OPENAI_API_KEY=sua-chave
```

## Login demo (após seed)

- E-mail: `admin@twin.local`
- Senha: `password`

## Problemas comuns

**`SQLSTATE[HY000] [1045] Access denied`** — Ajuste `DB_USERNAME` / `DB_PASSWORD` no `.env`.

**`could not find driver`** — Habilite `extension=pdo_mysql` no `php.ini`.

**Python não encontrado** — Use `py -3.12` ou instale Python marcando "Add to PATH".

**Horizon no Windows** — Não usamos Horizon; filas rodam com `QUEUE_CONNECTION=sync` localmente.

## Próximo passo: VPS

Quando quiser subir em produção, use [vps-quickstart.md](./vps-quickstart.md) com Docker.
