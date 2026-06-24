#!/usr/bin/env bash
# TWIN — comandos pós git pull na VPS (aaPanel)
# Uso: cd /www/wwwroot/twin.app.br && ./scripts/deploy/post-pull.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/www/wwwroot/twin.app.br}"
PHP_BIN="${PHP_BIN:-/www/server/php/82/bin/php}"
BRANCH="${BRANCH:-main}"

log() { echo "[twin-deploy] $*"; }

cd "$APP_DIR"

log "git pull origin $BRANCH"
git pull origin "$BRANCH"

log "setup.sh (build + cache)"
RUN_MIGRATE=1 "$APP_DIR/infra/aapanel/setup.sh"

log "migrations tenant + provision"
cd "$APP_DIR/apps/api"
"$PHP_BIN" artisan migrate --force
"$PHP_BIN" artisan tenants:provision

log "reiniciar workers e web"
supervisorctl restart twin-queue:* twin-ai-engine twin-celery || supervisorctl restart twin:
pm2 restart twin-web || log "pm2 twin-web não encontrado — ignore se web não usa PM2"

log "concluído — opcional: ./scripts/deploy/smoke-test.sh"
