# Bootstrap MySQL após criar o banco no servidor (Windows)
$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$Api = Join-Path $Root "apps\api"

if (-not (Test-Path "$Api\.env")) {
    Write-Host "Copie .env.example para apps\api\.env e configure DB_* para MySQL." -ForegroundColor Red
    exit 1
}

Set-Location $Api

Write-Host "=== Verificando conexão MySQL ===" -ForegroundColor Cyan
php artisan twin:db-check
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "=== Migrations landlord ===" -ForegroundColor Cyan
php artisan migrate --path=database/migrations/landlord --force

Write-Host "=== Seed landlord ===" -ForegroundColor Cyan
php artisan db:seed --force

Write-Host "=== Provisionar tenants ===" -ForegroundColor Cyan
php artisan tenants:provision --seed

Write-Host "=== Concluído ===" -ForegroundColor Green
Write-Host "Login demo: admin@twin.local / password"
