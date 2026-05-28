# Usa SQLite para dev local sem instalar MySQL
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$envFile = "$Root\apps\api\.env"

(Get-Content $envFile) `
    -replace 'DB_CONNECTION=mysql', 'DB_CONNECTION=sqlite' `
    -replace 'DB_HOST=.*', '# DB_HOST=127.0.0.1' `
    -replace 'DB_PORT=.*', '# DB_PORT=3306' `
    -replace 'DB_DATABASE=.*', '# DB_DATABASE=twin_landlord' `
    -replace 'DB_USERNAME=.*', '# DB_USERNAME=root' `
    -replace 'DB_PASSWORD=.*', '# DB_PASSWORD=' |
    Set-Content $envFile

if (-not (Select-String -Path $envFile -Pattern "DB_DATABASE=")) {
    Add-Content $envFile "`nDB_DATABASE=$Root\apps\api\database\twin.sqlite"
}

New-Item -ItemType File -Force -Path "$Root\apps\api\database\twin.sqlite" | Out-Null

Set-Location "$Root\apps\api"
php artisan config:clear
php artisan migrate --path=database/migrations/landlord --force
php artisan db:seed --force

Write-Host "SQLite configurado em apps\api\database\twin.sqlite" -ForegroundColor Green
