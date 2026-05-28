# TWIN â€” configuraÃ§Ã£o inicial para servidor local (Windows)
$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $Root

Write-Host "=== TWIN Setup Local ===" -ForegroundColor Cyan

if (-not (Test-Path "$Root\.env")) {
    Copy-Item "$Root\.env.example" "$Root\.env"
    Write-Host "Criado .env na raiz â€” ajuste DB_PASSWORD se usar MySQL com senha."
}

if (-not (Test-Path "$Root\apps\api\.env")) {
    Copy-Item "$Root\.env" "$Root\apps\api\.env"
}

if (-not (Test-Path "$Root\composer.phar")) {
    Invoke-WebRequest -Uri "https://getcomposer.org/download/latest-stable/composer.phar" -OutFile "$Root\composer.phar"
}

Write-Host "Instalando dependencias PHP (API)..."
Set-Location "$Root\apps\api"
php "$Root\composer.phar" install --ignore-platform-reqs --no-interaction 2>$null
if (-not (Select-String -Path .env -Pattern "^APP_KEY=base64:" -Quiet)) {
    php artisan key:generate --force
}

New-Item -ItemType Directory -Force -Path bootstrap/cache, storage/logs, storage/framework/cache, storage/framework/sessions, storage/framework/views, storage/app/imports | Out-Null

Write-Host ""
Write-Host "MySQL: crie o banco antes de migrar:" -ForegroundColor Yellow
Write-Host "  CREATE DATABASE twin_landlord CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
Write-Host ""
Write-Host "Depois execute:" -ForegroundColor Green
Write-Host "  cd apps\api"
Write-Host "  php artisan migrate --path=database/migrations/landlord"
Write-Host "  php artisan db:seed"
Write-Host "  php artisan tenants:provision --seed"
Write-Host ""
Write-Host "Motor IA (Python 3.12+):" -ForegroundColor Yellow
Write-Host "  cd apps\ai-engine"
Write-Host "  python -m venv .venv"
Write-Host "  .\.venv\Scripts\Activate.ps1"
Write-Host "  pip install -r requirements.txt"
Write-Host "  pip install -e ..\..\packages\import-parsers"
Write-Host ""
Write-Host "Web (Node 20+):" -ForegroundColor Yellow
Write-Host "  cd apps\web"
Write-Host "  npm install"
Write-Host ""
Write-Host "Iniciar tudo: .\scripts\local\start.ps1" -ForegroundColor Cyan
