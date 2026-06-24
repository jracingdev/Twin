# Deploy TWIN em VPS com aaPanel

Guia completo para produção no **Ubuntu 26.04** (ou 22.04/24.04) com [aaPanel](https://www.aapanel.com/), domínio **twin.app.br**, código em `/www/wwwroot/twin.app.br`.

> **Reinício do sistema:** após instalar extensões PHP, Redis, Node ou atualizar o kernel, **reinicie o VPS** antes de validar filas e serviços. Um `reboot` garante que php-fpm, MySQL, Redis e Supervisor sobem com as versões corretas.

---

## Visão geral

| Componente | URL / porta | Função |
|------------|-------------|--------|
| Web (Next.js) | `https://twin.app.br` | Dashboard |
| API (Laravel) | `https://api.twin.app.br` | REST, auth, tenants |
| AI Engine | `127.0.0.1:8100` | FastAPI — **somente interno** |
| MySQL 8 | `127.0.0.1:3306` | `twin_landlord` + `twin_tenant_*` |
| Redis | `127.0.0.1:6379` | Filas Laravel + Celery |

Scripts e snippets: `infra/aapanel/` (`clone.sh`, `setup.sh`).

---

## Layout de diretórios no servidor

O repositório Git fica **na raiz do site**, não apenas o `public` do Laravel:

```
/www/wwwroot/twin.app.br/          ← raiz do clone Git
├── apps/
│   ├── api/                       ← Laravel (document root → public/)
│   ├── web/                       ← Next.js (PM2 porta 3000)
│   └── ai-engine/                 ← FastAPI (uvicorn 8100)
├── packages/import-parsers/
├── scripts/mysql/
├── infra/aapanel/
├── docs/
└── .env                           ← opcional; apps/api/.env é o principal
```

No aaPanel:

| Site | Domínio | Tipo | Raiz / proxy |
|------|---------|------|----------------|
| Web | `twin.app.br` | Node ou site estático + proxy | Proxy → `127.0.0.1:3000` |
| API | `api.twin.app.br` | PHP 8.2+ | `/www/wwwroot/twin.app.br/apps/api/public` |

O motor IA **não** recebe site público — apenas Supervisor escutando em `127.0.0.1:8100`.

---

## Pré-requisitos no aaPanel

Em **App Store**, instale:

- **Nginx**
- **MySQL 8.0**
- **Redis**
- **PHP 8.2** (ou 8.3/8.4) com extensões: `pdo_mysql`, `redis`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`, `bcmath`, `fileinfo`, `zip`
- **Node.js** (LTS) + **PM2**
- **Supervisor** (plugin ou `apt install supervisor`)
- **Composer** (global ou via aaPanel)

Firewall (aaPanel → Security):

| Porta | Uso |
|-------|-----|
| 22 | SSH |
| 80, 443 | HTTP/HTTPS |
| 8888 | aaPanel (restrinja por IP se possível) |

**Não** exponha: `3306` (MySQL), `6379` (Redis), `8100` (AI Engine).

---

## 1. Clone e branch

Se o aaPanel criou o site **sem** Git, veja primeiro [Site criado no aaPanel sem Git](#site-criado-no-aapanel-sem-git).

```bash
cd /www/wwwroot/twin.app.br
git clone https://github.com/jracingdev/Twin.git .
git checkout main
```

Ou use o script: `chmod +x infra/aapanel/clone.sh && ./infra/aapanel/clone.sh`

**Branch recomendada:** `main` em produção. Use tags ou branch `release/*` se sua equipe adotar releases nomeadas.

---

## 2. MySQL — landlord e tenants

### 2.1 Via aaPanel

1. **Database** → Add database  
   - Nome: `twin_landlord`  
   - Usuário: `twin`  
   - Senha forte (anote para `.env`)

2. O painel pode não conceder `CREATE DATABASE` para tenants — execute o SQL completo abaixo como `root`.

### 2.2 SQL completo (recomendado)

Edite a senha em `scripts/mysql/01-create-landlord.sql` e execute no **phpMyAdmin** ou terminal:

```bash
mysql -u root -p < /www/wwwroot/twin.app.br/scripts/mysql/01-create-landlord.sql
```

Referência:

```sql
CREATE DATABASE IF NOT EXISTS twin_landlord CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'twin'@'localhost' IDENTIFIED BY 'SUA_SENHA';
GRANT ALL PRIVILEGES ON twin_landlord.* TO 'twin'@'localhost';
GRANT ALL PRIVILEGES ON `twin_tenant\_%`.* TO 'twin'@'localhost';
GRANT CREATE, DROP ON *.* TO 'twin'@'localhost';
FLUSH PRIVILEGES;
```

No mesmo servidor, prefira `'twin'@'localhost'` em vez de `'%'`.

Guia detalhado: [mysql-server.md](./mysql-server.md).

---

## 3. Variáveis de ambiente

Copie o template: `infra/aapanel/env.production.snippet`.

### 3.1 `apps/api/.env`

```bash
cp infra/aapanel/env.production.snippet /tmp/twin-env-ref
nano apps/api/.env
```

Valores críticos:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.twin.app.br
FRONTEND_URL=https://twin.app.br

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_DATABASE=twin_landlord
DB_USERNAME=twin
DB_PASSWORD=SUA_SENHA

QUEUE_CONNECTION=redis
REDIS_HOST=127.0.0.1

AI_ENGINE_URL=http://127.0.0.1:8100
AI_ENGINE_SECRET=segredo-longo-aleatorio
```

Gere a chave:

```bash
cd /www/wwwroot/twin.app.br/apps/api
/www/server/php/82/bin/php artisan key:generate
```

### 3.2 `apps/ai-engine/.env`

```env
REDIS_URL=redis://127.0.0.1:6379/0
AI_ENGINE_SECRET=mesmo-valor-da-api
LARAVEL_API_URL=https://api.twin.app.br
CELERY_INGEST=true
OPENAI_API_KEY=
PINECONE_API_KEY=
PINECONE_INDEX=twin-integrated
```

### 3.3 `apps/web/.env.production.local` (build)

```env
NEXT_PUBLIC_API_URL=https://api.twin.app.br/api/v1
NEXT_PUBLIC_AI_ENGINE_URL=https://twin.app.br/ai-engine
```

O path `/ai-engine/` é proxy nginx → `127.0.0.1:8100` (health check no browser durante import).

---

## Site criado no aaPanel sem Git

Se o aaPanel já criou o site `twin.app.br` mas você vê:

```text
fatal: not a git repository (or any of the parent directories): .git
```

o diretório `/www/wwwroot/twin.app.br` existe, mas **nunca foi clonado** do GitHub. Escolha uma opção:

### Opção A (recomendada) — backup e clone limpo

Use quando a pasta está vazia ou só tem o `index.html` padrão do painel.

```bash
sudo mkdir -p /www/backup
sudo mv /www/wwwroot/twin.app.br /www/backup/twin.app.br.empty.$(date +%Y%m%d%H%M)
sudo git clone https://github.com/jracingdev/Twin.git /www/wwwroot/twin.app.br
cd /www/wwwroot/twin.app.br
git checkout main
sudo chown -R www:www /www/wwwroot/twin.app.br
```

Depois continue com o [bootstrap](#4-bootstrap-automatizado) (`setup.sh`).

### Opção B — Git na pasta existente

Use quando já há arquivos no site e você **não** quer apagar a pasta (ex.: `.env` ou uploads locais).

```bash
cd /www/wwwroot/twin.app.br
git init
git remote add origin https://github.com/jracingdev/Twin.git
git fetch origin
git checkout -b main origin/main
```

Se o `git checkout` reclamar de arquivos locais conflitantes, faça backup do que precisa manter e remova só os arquivos padrão do painel antes de repetir o checkout:

```bash
cd /www/wwwroot/twin.app.br
rm -f index.html index.php 404.html .htaccess
git checkout -f main
```

### Script auxiliar

Após o clone, o repositório inclui `infra/aapanel/clone.sh`, que detecta pasta vazia e clona automaticamente; se houver arquivos, imprime as instruções da Opção B.

```bash
# No servidor, após baixar o script (ou após clone manual):
chmod +x /www/wwwroot/twin.app.br/infra/aapanel/clone.sh
/www/wwwroot/twin.app.br/infra/aapanel/clone.sh
```

Variáveis opcionais: `TARGET_DIR`, `REPO_URL`, `BRANCH` (padrão `main`).

---

## 4. Bootstrap automatizado

```bash
cd /www/wwwroot/twin.app.br
chmod +x infra/aapanel/setup.sh

# Primeira vez (sem migrations):
./infra/aapanel/setup.sh

# Após MySQL e .env configurados:
RUN_MIGRATE=1 RUN_SEED=1 ./infra/aapanel/setup.sh
```

O script é **idempotente**: pode rodar de novo após `git pull` para rebuild e cache.

Equivalente manual:

```bash
cd apps/api
composer install --no-dev --optimize-autoloader
php artisan config:cache && php artisan route:cache

cd ../web
npm ci && npm run build

cd ../ai-engine
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -e ../../packages/import-parsers
deactivate
```

---

## 5. Migrations e tenants

```bash
cd /www/wwwroot/twin.app.br/apps/api
/www/server/php/82/bin/php artisan twin:db-check
/www/server/php/82/bin/php artisan migrate --path=database/migrations/landlord --force
/www/server/php/82/bin/php artisan db:seed --force          # primeira vez
/www/server/php/82/bin/php artisan tenants:provision --seed   # cria twin_tenant_*
```

Ou use `scripts/mysql/bootstrap.sh` a partir da raiz do repo.

---

## 6. Sites no aaPanel

### 6.1 API — `api.twin.app.br`

1. **Website** → Add site → domínio `api.twin.app.br`
2. Tipo: **PHP**
3. **Raiz do site:** `/www/wwwroot/twin.app.br/apps/api/public`
4. PHP: 8.2+
5. **Configuração** → cole o conteúdo de `infra/aapanel/nginx-api.conf.snippet` em **Custom**
6. **SSL** → Let's Encrypt → force HTTPS

### 6.2 Web — `twin.app.br`

1. Add site `twin.app.br` (pode apontar para `/www/wwwroot/twin.app.br/apps/web` — o tráfego vai para PM2)
2. **Configuração** → cole `infra/aapanel/nginx-web.conf.snippet`
3. SSL Let's Encrypt

### 6.3 PM2 — Next.js

```bash
cd /www/wwwroot/twin.app.br/apps/web
pm2 start npm --name twin-web -- start
pm2 save
pm2 startup    # siga as instruções exibidas
```

---

## 7. Workers — Supervisor

Copie e ajuste:

```bash
cp infra/aapanel/supervisor-twin.conf.example /etc/supervisor/conf.d/twin.conf
# Edite caminhos PHP e usuário www
supervisorctl reread
supervisorctl update
supervisorctl status
```

Programas:

| Programa | Comando |
|----------|---------|
| `twin-queue` | `php artisan queue:work redis` (×2) |
| `twin-ai-engine` | `uvicorn app.main:app --host 127.0.0.1 --port 8100` |
| `twin-celery` | `celery -A app.celery_app worker` |

### Laravel Horizon (opcional)

O pacote `laravel/horizon` está no `composer.json`. Se publicar a config:

```bash
php artisan horizon:install
php artisan horizon:publish
```

Substitua `twin-queue` por `php artisan horizon` no Supervisor. Caso contrário, `queue:work` é suficiente.

### Alternativa: cron aaPanel

Não recomendado para fila contínua. Se necessário, use apenas para tarefas agendadas (`schedule:run`):

```
* * * * * cd /www/wwwroot/twin.app.br/apps/api && /www/server/php/82/bin/php artisan schedule:run >> /dev/null 2>&1
```

---

## 8. AI Engine e Celery

Porta **8100** (interna), diferente do dev Docker (8000):

```bash
cd /www/wwwroot/twin.app.br/apps/ai-engine
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8100 --workers 2
# Em produção: use Supervisor (supervisor-twin.conf.example)

celery -A app.celery_app worker -l info -c 2
```

Teste local no servidor:

```bash
curl -s http://127.0.0.1:8100/health
# {"status":"ok","service":"twin-ai-engine"}
```

Snippet opcional: `infra/aapanel/nginx-ai-internal.conf.snippet` (não exponha publicamente).

---

## 9. SSL

No aaPanel, para **cada** domínio (`twin.app.br`, `api.twin.app.br`):

1. Site → **SSL**
2. **Let's Encrypt** → Apply
3. Ative **Force HTTPS**

Renovação costuma ser automática pelo painel.

---

## 10. Permissões

```bash
cd /www/wwwroot/twin.app.br/apps/api
chown -R www:www storage bootstrap/cache
chmod -R ug+rwx storage bootstrap/cache
```

Imports e uploads usam `storage/` — o usuário `www` (php-fpm) precisa escrever.

---

## 11. Atualização (deploy contínuo)

```bash
cd /www/wwwroot/twin.app.br
git pull origin main
RUN_MIGRATE=1 ./infra/aapanel/setup.sh

cd apps/api
/www/server/php/82/bin/php artisan migrate --force
/www/server/php/82/bin/php artisan tenants:provision

supervisorctl restart twin-queue:* twin-ai-engine twin-celery
pm2 restart twin-web
```

---

## 12. Checklist pós-deploy

Execute no servidor:

```bash
# API health
curl -sf https://api.twin.app.br/up && echo "API OK"

# MySQL / tenants
cd /www/wwwroot/twin.app.br/apps/api
/www/server/php/82/bin/php artisan twin:db-check

# AI interno
curl -sf http://127.0.0.1:8100/health && echo "AI OK"

# Web + proxy AI health
curl -sf https://twin.app.br/ai-engine/health && echo "AI proxy OK"

# Redis
redis-cli ping

# Filas
supervisorctl status | grep twin
pm2 status twin-web
```

No browser:

1. `https://twin.app.br` — login
2. `https://api.twin.app.br/api/v1/docs` — documentação (se habilitada)
3. Importar conversa — health do motor IA deve ficar verde

Login demo (após seed): `admin@twin.local` / `password` — **altere em produção**.

---

## 13. Backup

MySQL (todos os bancos `twin_*`):

```bash
mysqldump -u twin -p --databases twin_landlord \
  $(mysql -u twin -p -N -e "SHOW DATABASES LIKE 'twin_tenant_%'") \
  > /www/backup/twin_$(date +%Y%m%d).sql
```

Agende no aaPanel → **Cron** (ex.: 03:00 diário).

---

## 14. Problemas comuns

| Sintoma | Solução |
|---------|---------|
| 502 na web | `pm2 status` — reinicie `twin-web` |
| 502 na API | php-fpm ativo? `storage/` gravável? |
| `tenant_not_provisioned` | `php artisan tenants:provision` |
| Motor IA indisponível no import | Supervisor `twin-ai-engine`; nginx `/ai-engine/` no site web |
| Fila não processa | `QUEUE_CONNECTION=redis`, Redis ativo, Supervisor `twin-queue` |
| `pdo_mysql` ausente | aaPanel → PHP → Install extensions → **reboot** |
| CORS no login | `FRONTEND_URL=https://twin.app.br` na API |

---

## 15. Comandos rápidos (resumo)

```bash
# Clone + bootstrap completo (primeira vez)
cd /www/wwwroot/twin.app.br
mysql -u root -p < scripts/mysql/01-create-landlord.sql
# configure apps/api/.env e apps/ai-engine/.env
chmod +x infra/aapanel/setup.sh
RUN_MIGRATE=1 RUN_SEED=1 ./infra/aapanel/setup.sh
cp infra/aapanel/supervisor-twin.conf.example /etc/supervisor/conf.d/twin.conf
supervisorctl update
# Cole snippets nginx nos sites + SSL no painel
pm2 save
```

---

## Referências

- [mysql-server.md](./mysql-server.md) — banco landlord/tenant
- [vps-quickstart.md](./vps-quickstart.md) — deploy alternativo com Docker
- [local-windows.md](./local-windows.md) — desenvolvimento local
- Snippets: `infra/aapanel/`
