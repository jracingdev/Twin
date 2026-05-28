# Deploy TWIN em VPS

## Requisitos

- Ubuntu 22.04/24.04
- 8 vCPU, 32 GB RAM recomendado
- Docker + Docker Compose

## Passos

```bash
git clone <repo> /opt/twin
cd /opt/twin
cp .env.example .env
# Edite PINECONE_API_KEY, OPENAI_API_KEY, senhas MySQL

chmod +x infra/vps/*.sh
APP_DIR=/opt/twin ./infra/vps/install.sh
```

## SSL

```bash
certbot certonly --webroot -w /var/www/certbot -d app.seudominio.com
```

Monte `/etc/letsencrypt` no serviço nginx do compose prod.

## Backup

Cron diário:

```
0 3 * * * APP_DIR=/opt/twin /opt/twin/infra/vps/backup.sh
```
