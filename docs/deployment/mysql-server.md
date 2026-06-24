# MySQL no servidor — TWIN Platform

Guia para usar **MySQL 8.0+** como banco central (landlord) e criar automaticamente um banco por organização (`twin_tenant_{uuid}`).

## Arquitetura

| Banco | Conteúdo |
|-------|----------|
| `twin_landlord` | Usuários, organizações, planos, billing, credenciais de canal |
| `twin_tenant_{uuid}` | Twins, mensagens, DNA, sugestões, playbooks (um banco por org) |

O prefixo dos tenants é configurado em `apps/api/config/tenancy.php` (`twin_tenant_`).

---

## Passo 1 — Criar banco no servidor

Conecte como `root` no MySQL do servidor (HeidiSQL, DBeaver, `mysql` CLI) e execute:

```bash
# Edite a senha no arquivo antes de rodar:
# scripts/mysql/01-create-landlord.sql
```

Ou manualmente:

```sql
CREATE DATABASE twin_landlord
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'twin'@'%' IDENTIFIED BY 'SUA_SENHA_FORTE';
GRANT ALL PRIVILEGES ON twin_landlord.* TO 'twin'@'%';
GRANT ALL PRIVILEGES ON `twin_tenant\_%`.* TO 'twin'@'%';
GRANT CREATE, DROP ON *.* TO 'twin'@'%';
FLUSH PRIVILEGES;
```

### Firewall

Libere a porta **3306** apenas para o IP da aplicação (API), não para a internet pública.

### Host do usuário

| Cenário | Host |
|---------|------|
| API no mesmo servidor | `'twin'@'localhost'` |
| API em outro servidor | `'twin'@'IP_DA_API'` ou rede `'twin'@'10.0.%'` |

---

## Passo 2 — Configurar `.env` da API

Em `apps/api/.env` (ou `.env` na raiz copiado para a API):

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.seudominio.com

DB_CONNECTION=mysql
DB_HOST=IP_OU_HOST_DO_MYSQL
DB_PORT=3306
DB_DATABASE=twin_landlord
DB_USERNAME=twin
DB_PASSWORD=SUA_SENHA_FORTE

QUEUE_CONNECTION=redis
REDIS_HOST=IP_DO_REDIS
REDIS_PORT=6379

AI_ENGINE_URL=http://127.0.0.1:8000
AI_ENGINE_SECRET=segredo-forte-igual-no-ai-engine
```

**Importante:** `DB_CONNECTION` deve ser `mysql` (não `sqlite`).

---

## Passo 3 — Bootstrap (migrations + tenants)

Na máquina que acessa o MySQL (servidor da API ou sua máquina com túnel SSH):

```powershell
# Windows
cd D:\twin
.\scripts\mysql\bootstrap.ps1
```

```bash
# Linux / servidor
chmod +x scripts/mysql/bootstrap.sh
./scripts/mysql/bootstrap.sh
```

Ou manualmente:

```bash
cd apps/api
php artisan twin:db-check
php artisan migrate --path=database/migrations/landlord --force
php artisan db:seed --force
php artisan tenants:provision --seed
```

O comando `tenants:provision` cria cada `twin_tenant_{uuid}` e aplica as migrations tenant.

---

## Passo 4 — Verificar

```bash
php artisan twin:db-check
```

No MySQL:

```sql
SHOW DATABASES LIKE 'twin%';
-- Esperado: twin_landlord + twin_tenant_<uuid>
```

Login demo (após seed): `admin@twin.local` / `password`

---

## Novas organizações

Sempre que criar uma org nova (cadastro ou seed):

```bash
php artisan tenants:provision --org=UUID_DA_ORG
```

Ou para todas:

```bash
php artisan tenants:provision
```

---

## Docker (MySQL + app no mesmo VPS)

```bash
cd infra/docker
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec api php artisan twin:db-check
docker compose -f docker-compose.prod.yml exec api php artisan tenants:provision --seed
```

O init em `infra/docker/mysql-init/` concede permissões de tenant ao usuário `twin`.

`.env` para Docker:

```env
DB_HOST=mysql
DB_DATABASE=twin_landlord
DB_USERNAME=twin
DB_PASSWORD=twin_secret
```

---

## Backup

Inclua **todos** os bancos `twin_*`:

```bash
mysqldump -u twin -p --databases twin_landlord $(mysql -u twin -p -N -e "SHOW DATABASES LIKE 'twin_tenant_%'") > twin-backup.sql
```

Ou use `infra/vps/backup.sh` no deploy VPS.

---

## Problemas comuns

| Erro | Solução |
|------|---------|
| `Access denied` | Usuário/senha/host em `DB_*` |
| `could not find driver` | Habilite `pdo_mysql` no PHP |
| `tenant_not_provisioned` | Rode `php artisan tenants:provision` |
| `CREATE DATABASE` negado | Execute `01-create-landlord.sql` (GRANT CREATE) |
| Conexão recusada | Firewall / `bind-address` do MySQL |

---

## Migrar de SQLite para MySQL

1. Crie `twin_landlord` no MySQL (passo 1).
2. Altere `apps/api/.env` para `DB_CONNECTION=mysql`.
3. Rode `bootstrap.ps1` / `bootstrap.sh` (banco novo, com seed).
4. Reimporte conversas dos twins se necessário (exportações originais).

Não há migração automática de dados SQLite → MySQL; em dev, reimportar costuma ser mais simples.

---

## Próximo passo

- Desenvolvimento local com MySQL: [local-windows.md](./local-windows.md)
- VPS com Docker: [vps-quickstart.md](./vps-quickstart.md)
- VPS com aaPanel (twin.app.br): [aapanel.md](./aapanel.md)
