# TWIN — inicia API, motor IA e dashboard no localhost
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

Write-Host "=== TWIN Local Server ===" -ForegroundColor Cyan
Write-Host "API:        http://127.0.0.1:8080"
Write-Host "AI Engine:  http://127.0.0.1:8000/health"
Write-Host "Dashboard:  http://127.0.0.1:3000"
Write-Host ""

$apiCmd = "Set-Location '$Root\apps\api'; php artisan serve --host=127.0.0.1 --port=8080"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $apiCmd

$aiVenv = "$Root\apps\ai-engine\.venv\Scripts\python.exe"
$aiPy = if (Test-Path $aiVenv) { $aiVenv } else { "python" }
$redisOk = $false
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", 6379)
    $redisOk = $tcp.Connected
    $tcp.Close()
} catch { }

if ($redisOk) {
    Write-Host "Redis: OK — iniciando worker Celery" -ForegroundColor Green
    $celeryCmd = @"
`$env:REDIS_URL='redis://127.0.0.1:6379/0'
`$env:LARAVEL_API_URL='http://127.0.0.1:8080'
`$env:AI_ENGINE_SECRET='local-dev-secret-change-in-prod'
Set-Location '$Root\apps\ai-engine'
& '$aiPy' -m celery -A app.celery_app worker -l info -P solo
"@
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $celeryCmd
    $eagerFlag = ""
} else {
    Write-Host "Redis: offline — treino DNA roda inline (CELERY_TASK_ALWAYS_EAGER)" -ForegroundColor Yellow
    $eagerFlag = "`$env:CELERY_TASK_ALWAYS_EAGER='true'"
}

$aiCmd = @"
`$env:AI_ENGINE_SECRET='local-dev-secret-change-in-prod'
`$env:LARAVEL_API_URL='http://127.0.0.1:8080'
`$env:REDIS_URL='redis://127.0.0.1:6379/0'
$eagerFlag
Set-Location '$Root\apps\ai-engine'
& '$aiPy' -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $aiCmd

$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    $webCmd = "Set-Location '$Root\apps\web'; if (-not (Test-Path node_modules)) { npm install }; npm run dev"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $webCmd
} else {
    Write-Host "Node.js nao encontrado — instale para o dashboard web." -ForegroundColor Yellow
}

Write-Host "Janelas abertas. Pressione Enter para fechar este painel."
Read-Host
