#!/usr/bin/env bash
# TWIN — bootstrap idempotente para aaPanel (Ubuntu + /www/wwwroot/twin.app.br)
# Uso:
#   chmod +x infra/aapanel/setup.sh
#   APP_DIR=/www/wwwroot/twin.app.br RUN_MIGRATE=1 ./infra/aapanel/setup.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/www/wwwroot/twin.app.br}"
RUN_MIGRATE="${RUN_MIGRATE:-0}"
RUN_SEED="${RUN_SEED:-0}"
PHP_BIN="${PHP_BIN:-}"
NODE_BIN="${NODE_BIN:-node}"
NPM_BIN="${NPM_BIN:-npm}"
PM2_BIN="${PM2_BIN:-pm2}"

log() { echo "[twin-setup] $*"; }
die() { echo "[twin-setup] ERRO: $*" >&2; exit 1; }

# --- Detectar PHP do aaPanel ---
detect_php() {
  if [[ -n "$PHP_BIN" && -x "$PHP_BIN" ]]; then
    return
  fi
  for candidate in \
    /www/server/php/84/bin/php \
    /www/server/php/83/bin/php \
    /www/server/php/82/bin/php \
    "$(command -v php 2>/dev/null || true)"
  do
    if [[ -n "$candidate" && -x "$candidate" ]]; then
      PHP_BIN="$candidate"
      return
    fi
  done
  die "PHP não encontrado. Defina PHP_BIN=/www/server/php/82/bin/php"
}

detect_php
log "PHP: $PHP_BIN ($("$PHP_BIN" -v | head -1))"

if [[ ! -d "$APP_DIR" ]]; then
  die "Diretório $APP_DIR não existe. Clone o repositório primeiro."
fi

cd "$APP_DIR"
API="$APP_DIR/apps/api"
WEB="$APP_DIR/apps/web"
AI="$APP_DIR/apps/ai-engine"
PARSERS="$APP_DIR/packages/import-parsers"

[[ -d "$API" ]] || die "apps/api não encontrado em $APP_DIR"
[[ -d "$WEB" ]] || die "apps/web não encontrado em $APP_DIR"
[[ -d "$AI" ]] || die "apps/ai-engine não encontrado em $APP_DIR"

# --- .env da API ---
if [[ ! -f "$API/.env" ]]; then
  if [[ -f "$APP_DIR/.env" ]]; then
    log "Copiando $APP_DIR/.env → apps/api/.env"
    cp "$APP_DIR/.env" "$API/.env"
  elif [[ -f "$APP_DIR/infra/aapanel/env.production.snippet" ]]; then
    log "Criando apps/api/.env a partir do snippet (edite antes de produção!)"
    grep -v '^#' "$APP_DIR/infra/aapanel/env.production.snippet" | grep -v '^$' | grep -v 'NEXT_PUBLIC' | grep -v '^REDIS_URL' | head -40 > "$API/.env" || true
    log "IMPORTANTE: edite $API/.env com senhas e APP_KEY antes de continuar."
  else
    die "Configure apps/api/.env (copie infra/aapanel/env.production.snippet)"
  fi
fi

# --- .env do AI engine ---
if [[ ! -f "$AI/.env" ]]; then
  log "Criando apps/ai-engine/.env"
  SECRET="$(grep '^AI_ENGINE_SECRET=' "$API/.env" | cut -d= -f2- || echo 'change-me')"
  LARAVEL_URL="$(grep '^APP_URL=' "$API/.env" | cut -d= -f2- || echo 'https://api.twin.app.br')"
  cat > "$AI/.env" <<EOF
REDIS_URL=redis://127.0.0.1:6379/0
AI_ENGINE_SECRET="${SECRET}"
LARAVEL_API_URL=${LARAVEL_URL}
PINECONE_INDEX=twin-integrated
LLM_PROVIDER=openai
CELERY_INGEST=true
OPENAI_API_KEY=
PINECONE_API_KEY=
EOF
fi

# --- .env produção web (build) — criar antes de trocar usuário (ubuntu costuma ser dono do clone) ---
if [[ ! -f "$WEB/.env.production.local" ]]; then
  API_URL="$(grep '^APP_URL=' "$API/.env" | cut -d= -f2- || echo 'https://api.twin.app.br')"
  FRONT="$(grep '^FRONTEND_URL=' "$API/.env" | cut -d= -f2- || echo 'https://twin.app.br')"
  if ! cat > "$WEB/.env.production.local" <<EOF
NEXT_PUBLIC_API_URL=${API_URL}/api/v1
NEXT_PUBLIC_AI_ENGINE_URL=${FRONT}/ai-engine
EOF
  then
    die "Não foi possível criar $WEB/.env.production.local — rode o setup como ubuntu (não sudo -u www) ou: sudo chown -R ubuntu:www $WEB"
  fi
  log "Criado $WEB/.env.production.local"
fi

# --- Permissões Laravel ---
log "Ajustando permissões storage/ bootstrap/cache..."
mkdir -p "$API/storage/logs" "$API/storage/framework/cache" "$API/storage/framework/sessions" "$API/storage/framework/views"
SETUP_USER="$(whoami)"
chown -R "$SETUP_USER:$SETUP_USER" "$API/storage" "$API/bootstrap/cache" 2>/dev/null || true
chmod -R ug+rwx "$API/storage" "$API/bootstrap/cache" 2>/dev/null || true

# --- Composer ---
COMPOSER_BIN="${COMPOSER_BIN:-$(command -v composer 2>/dev/null || echo /usr/local/bin/composer)}"
if [[ ! -x "$COMPOSER_BIN" && -f /usr/local/bin/composer ]]; then
  COMPOSER_BIN=/usr/local/bin/composer
fi
[[ -f "$COMPOSER_BIN" || -x "$COMPOSER_BIN" ]] || die "Composer não encontrado. Instale: curl -sS https://getcomposer.org/installer | sudo php -- --install-dir=/usr/local/bin --filename=composer"
log "composer install (API) via $PHP_BIN..."
(cd "$API" && "$PHP_BIN" "$COMPOSER_BIN" install --no-dev --optimize-autoloader --no-interaction)

# APP_KEY (requer vendor/ — após composer install)
if ! grep -q '^APP_KEY=base64:' "$API/.env" 2>/dev/null; then
  if grep -qE '^APP_KEY=\s*$' "$API/.env" || ! grep -q '^APP_KEY=' "$API/.env"; then
    log "Gerando APP_KEY..."
    (cd "$API" && "$PHP_BIN" artisan key:generate --force)
  fi
fi

log "php artisan config:cache route:cache view:cache..."
mkdir -p "$API/resources/views"
(cd "$API" && "$PHP_BIN" artisan config:cache && "$PHP_BIN" artisan route:cache && "$PHP_BIN" artisan view:cache) || true

# --- Node / Next.js ---
if ! command -v "$NODE_BIN" &>/dev/null; then
  die "Node.js não encontrado. Instale via aaPanel → App Store → Node.js"
fi
log "npm ci + build (web)..."
(cd "$WEB" && "$NPM_BIN" ci && "$NPM_BIN" run build && "$NPM_BIN" run postbuild)

# --- Python venv + AI engine (3.10–3.13; evitar python3 = 3.14 no Ubuntu 26) ---
detect_python() {
  if [[ -n "${PYTHON_BIN:-}" && "$PYTHON_BIN" != "python3" ]]; then
    if command -v "$PYTHON_BIN" &>/dev/null; then
      return
    fi
    die "PYTHON_BIN=$PYTHON_BIN não encontrado. Ubuntu 26: sudo apt install python3.13 python3.13-venv"
  fi
  for candidate in python3.13 python3.12 python3.11 python3.10; do
    if command -v "$candidate" &>/dev/null; then
      PYTHON_BIN="$candidate"
      return
    fi
  done
  PYTHON_BIN=python3
}
detect_python
if ! command -v "$PYTHON_BIN" &>/dev/null; then
  die "Python 3.10–3.13 não encontrado. Ubuntu 26: sudo apt install python3.13 python3.13-venv (deadsnakes PPA)"
fi
PY_VER="$("$PYTHON_BIN" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
log "Python AI engine: $PYTHON_BIN ($PY_VER)"
PY_MINOR="$("$PYTHON_BIN" -c 'import sys; print(sys.version_info.minor)')"
PY_MAJOR="$("$PYTHON_BIN" -c 'import sys; print(sys.version_info.major)')"
if [[ "$PY_MAJOR" -eq 3 && "$PY_MINOR" -ge 14 ]]; then
  die "Python $PY_VER é incompatível com pydantic. Instale python3.13: sudo apt install python3.13 python3.13-venv"
fi
if [[ ! -d "$AI/.venv" ]]; then
  log "Criando venv em apps/ai-engine/.venv"
  (cd "$AI" && "$PYTHON_BIN" -m venv .venv)
fi
# shellcheck disable=SC1091
source "$AI/.venv/bin/activate"
pip install -q --upgrade pip
pip install -q -r "$AI/requirements.txt"
pip uninstall -y pinecone-plugin-inference pinecone-plugin-records 2>/dev/null || true
if [[ -d "$PARSERS" ]]; then
  pip install -q -e "$PARSERS"
fi
deactivate
chown -R www:www "$AI/.venv" 2>/dev/null || true

# --- Migrations (opcional) ---
if [[ "$RUN_MIGRATE" == "1" ]]; then
  log "php artisan twin:db-check..."
  (cd "$API" && "$PHP_BIN" artisan twin:db-check)
  log "Migrations landlord..."
  (cd "$API" && "$PHP_BIN" artisan migrate --path=database/migrations/landlord --force)
  if [[ "$RUN_SEED" == "1" ]]; then
    (cd "$API" && "$PHP_BIN" artisan db:seed --force)
    (cd "$API" && "$PHP_BIN" artisan tenants:provision --seed)
  else
    (cd "$API" && "$PHP_BIN" artisan tenants:provision)
  fi
fi

# --- PM2 web (standalone, porta 3001 — 3000 costuma estar ocupada no VPS) ---
WEB_PORT="${WEB_PORT:-3001}"
if command -v "$PM2_BIN" &>/dev/null; then
  if "$PM2_BIN" describe twin-web &>/dev/null; then
    log "PM2: reiniciando twin-web (porta $WEB_PORT)..."
    PORT="$WEB_PORT" HOSTNAME=0.0.0.0 "$PM2_BIN" restart twin-web --update-env
  else
    log "PM2: iniciando twin-web em .next/standalone (porta $WEB_PORT)..."
    (cd "$WEB/.next/standalone" && PORT="$WEB_PORT" HOSTNAME=0.0.0.0 "$PM2_BIN" start server.js --name twin-web)
    "$PM2_BIN" save || true
  fi
else
  log "PM2 não encontrado — cd apps/web/.next/standalone && PORT=3001 pm2 start server.js --name twin-web"
fi

log "=== Bootstrap concluído ==="
log "Próximos passos:"
log "  1. MySQL: scripts/mysql/01-create-landlord.sql (se ainda não rodou)"
log "  2. Edite apps/api/.env e apps/ai-engine/.env com segredos reais"
log "  3. Cole snippets nginx em infra/aapanel/*.conf.snippet nos sites do painel"
log "  4. SSL Let's Encrypt no aaPanel para twin.app.br e api.twin.app.br"
log "  5. Supervisor: infra/aapanel/supervisor-twin.conf.example"
log "  6. RUN_MIGRATE=1 RUN_SEED=1 $0  (primeira vez, após MySQL pronto)"
log "  7. Verifique: curl https://api.twin.app.br/up && curl http://127.0.0.1:8100/health"
