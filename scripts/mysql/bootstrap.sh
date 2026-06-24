#!/usr/bin/env bash
# Bootstrap MySQL após criar o banco no servidor.
# Uso: ./scripts/mysql/bootstrap.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
API="$ROOT/apps/api"

if [ ! -f "$API/.env" ]; then
  echo "Copie .env.example para apps/api/.env e configure DB_* para MySQL."
  exit 1
fi

cd "$API"

echo "=== Verificando conexão MySQL ==="
php artisan twin:db-check || exit 1

echo "=== Migrations landlord ==="
php artisan migrate --path=database/migrations/landlord --force

echo "=== Seed landlord ==="
php artisan db:seed --force

echo "=== Provisionar tenants (bancos twin_tenant_*) ==="
php artisan tenants:provision --seed

echo "=== Concluído ==="
echo "Login demo: admin@twin.local / password"
