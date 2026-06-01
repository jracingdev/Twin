# TWIN — inicia API, motor IA e dashboard no localhost
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

Write-Host "=== TWIN Local Server ===" -ForegroundColor Cyan
Write-Host "API:        http://127.0.0.1:8080"
Write-Host "AI Engine:  http://127.0.0.1:8000/health"
Write-Host "Dashboard:  http://127.0.0.1:3000"
Write-Host ""

# --- API Laravel ---
$apiCmd = "Set-Location '$Root\apps\api'; php artisan serve --host=127.0.0.1 --port=8080"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $apiCmd -WindowStyle Minimized

# --- Queue Worker (database queue, inclui fila 'channel' do gateway) ---
$queueCmd = "Set-Location '$Root\apps\api'; php artisan queue:work --queue=default,channel --timeout=300 --tries=1 --sleep=2"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $queueCmd -WindowStyle Minimized

# --- Motor IA (FastAPI) ---
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
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $celeryCmd -WindowStyle Minimized
    $eagerFlag = ""
} else {
    Write-Host "Redis: offline — DNA e reindex rodam inline (CELERY_TASK_ALWAYS_EAGER=true)" -ForegroundColor Yellow
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
Start-Process powershell -ArgumentList "-NoExit", "-Command", $aiCmd -WindowStyle Minimized

# --- Dashboard Next.js ---
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    $webCmd = "Set-Location '$Root\apps\web'; if (-not (Test-Path node_modules)) { npm install }; npm run dev"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $webCmd -WindowStyle Minimized
} else {
    Write-Host "Node.js nao encontrado — instale para o dashboard web." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Janelas abertas. Aguarde ~10s para os servicos iniciarem." -ForegroundColor Green
Write-Host "Pressione Enter para fechar este painel."
Read-Host
