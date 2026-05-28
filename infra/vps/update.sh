#!/usr/bin/env bash
set -euo pipefail

cd "${APP_DIR:-/opt/twin}"
git pull origin main

cd infra/docker
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec api php artisan migrate --force

echo "TWIN atualizado."
