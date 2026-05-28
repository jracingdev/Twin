#!/usr/bin/env bash
set -euo pipefail

# TWIN — instalação em VPS Ubuntu 22.04/24.04
echo "=== TWIN VPS Install ==="

if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker "$USER"
fi

if ! command -v docker compose &>/dev/null; then
  apt-get update && apt-get install -y docker-compose-plugin
fi

APP_DIR="${APP_DIR:-/opt/twin}"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Configure .env antes de continuar."
  exit 1
fi

cd infra/docker
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

docker compose -f docker-compose.prod.yml exec api php artisan migrate --force
docker compose -f docker-compose.prod.yml exec api php artisan db:seed --force

echo "=== TWIN instalado. Configure SSL com certbot. ==="
