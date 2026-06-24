# TWIN — smoke test leve para desenvolvimento local (Windows)
# Uso: .\scripts\deploy\smoke-test.ps1
param(
    [string]$ApiUrl = "http://127.0.0.1:8080",
    [string]$AiUrl = "http://127.0.0.1:8000",
    [string]$Email = $env:SMOKE_EMAIL,
    [string]$Password = $env:SMOKE_PASSWORD,
    [string]$TwinId = $env:SMOKE_TWIN_ID,
    [string]$TenantId = $env:SMOKE_TENANT_ID
)

$ErrorActionPreference = "Continue"
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$ApiEnv = Join-Path $Root "apps\api\.env"
$AiPython = Join-Path $Root "apps\ai-engine\.venv\Scripts\python.exe"

$script:Failures = 0
$script:Warnings = 0

function Write-Pass([string]$Message) { Write-Host "[PASS] $Message" -ForegroundColor Green }
function Write-Fail([string]$Message) { Write-Host "[FAIL] $Message" -ForegroundColor Red; $script:Failures++ }
function Write-Warn([string]$Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow; $script:Warnings++ }
function Write-Skip([string]$Message) { Write-Host "[SKIP] $Message" -ForegroundColor Cyan }

function Read-EnvVar([string]$File, [string]$Key) {
    if (-not (Test-Path $File)) { return $null }
    $line = Get-Content $File | Where-Object { $_ -match "^\s*$Key=" } | Select-Object -Last 1
    if (-not $line) { return $null }
    $val = $line -replace "^\s*$Key=", ""
    $val = $val.TrimEnd("`r")
    if ($val.StartsWith('"') -and $val.EndsWith('"')) { $val = $val.Substring(1, $val.Length - 2) }
    return $val
}

function Invoke-StatusCheck([string]$Label, [string]$Url, [int[]]$Expected = @(200)) {
    try {
        $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15
        if ($Expected -contains $resp.StatusCode) {
            Write-Pass "$Label → HTTP $($resp.StatusCode)"
            return $true
        }
        Write-Fail "$Label → HTTP $($resp.StatusCode) (esperado $($Expected -join '/'))"
    }
    catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -and ($Expected -contains [int]$code)) {
            Write-Pass "$Label → HTTP $code"
            return $true
        }
        Write-Fail "$Label → $($_.Exception.Message)"
    }
    return $false
}

Write-Host "=== TWIN smoke test (local) ===" -ForegroundColor Cyan
Write-Host "Raiz: $Root"
Write-Host "API:  $ApiUrl"
Write-Host "AI:   $AiUrl"
Write-Host ""

Invoke-StatusCheck "API GET /up" "$ApiUrl/up" | Out-Null
Invoke-StatusCheck "AI Engine GET /health" "$AiUrl/health" | Out-Null

$secret = Read-EnvVar $ApiEnv "AI_ENGINE_SECRET"
if (-not $secret) {
    Write-Fail "AI_ENGINE_SECRET ausente em apps\api\.env"
}
else {
    $batchId = "smoke-$(Get-Date -Format 'yyyyMMddHHmmss')"
    $body = @{
        tenant_id = "smoke-test"
        twin_id   = "smoke-test"
        batch_id  = $batchId
        source    = "whatsapp"
        content   = "aGVsbG8="
    } | ConvertTo-Json -Compress

    try {
        $headers = @{
            "Content-Type"      = "application/json"
            "X-Internal-Secret" = $secret
        }
        $resp = Invoke-WebRequest -Uri "$AiUrl/ai/ingest/batch" -Method POST -Headers $headers -Body $body -UseBasicParsing -TimeoutSec 20
        $json = $resp.Content | ConvertFrom-Json
        if ($resp.StatusCode -eq 200 -and $json.status -eq "queued") {
            Write-Pass "AI POST /ai/ingest/batch → HTTP 200 status=queued"
        }
        elseif ($resp.StatusCode -eq 200) {
            Write-Pass "AI POST /ai/ingest/batch → HTTP 200 (status=$($json.status))"
        }
        else {
            Write-Fail "AI POST /ai/ingest/batch → HTTP $($resp.StatusCode)"
        }
    }
    catch {
        Write-Fail "AI POST /ai/ingest/batch → $($_.Exception.Message)"
    }
}

if (Test-Path $AiPython) {
    Push-Location (Join-Path $Root "apps\ai-engine")
    try {
        $out = & $AiPython -c "from app.services.pinecone_client import get_index; idx=get_index(); raise SystemExit(1) if idx is None else print('ok')" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Pass "Pinecone get_index() disponível"
        }
        else {
            Write-Warn "Pinecone get_index() indisponível (opcional em dev local)"
        }
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Warn "venv do ai-engine não encontrado — pulando Pinecone"
}

if ($Email -and $Password) {
    try {
        $loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json -Compress
        $login = Invoke-RestMethod -Uri "$ApiUrl/api/v1/login" -Method POST -Body $loginBody -ContentType "application/json" -TimeoutSec 20
        if ($login.two_factor_required) {
            Write-Warn "Login exige 2FA — pulando /plan e /suggest"
        }
        else {
            Write-Pass "API POST /api/v1/login → OK"
            $token = $login.token
            $tenant = if ($TenantId) { $TenantId } else { $login.organization.id }
            $headers = @{
                Authorization = "Bearer $token"
                "X-Tenant"    = $tenant
            }
            $plan = Invoke-RestMethod -Uri "$ApiUrl/api/v1/plan" -Headers $headers -TimeoutSec 15
            if ($plan.slug -eq "business") {
                Write-Pass "API GET /api/v1/plan → business"
            }
            else {
                Write-Warn "API GET /api/v1/plan → slug=$($plan.slug)"
            }

            if ($TwinId) {
                $suggestBody = @{ twin_id = $TwinId; text = "smoke test — olá" } | ConvertTo-Json -Compress
                $suggest = Invoke-WebRequest -Uri "$ApiUrl/api/v1/suggest" -Method POST -Headers $headers -Body $suggestBody -ContentType "application/json" -UseBasicParsing -TimeoutSec 60
                if ($suggest.StatusCode -in 200, 201) {
                    Write-Pass "API POST /api/v1/suggest → HTTP $($suggest.StatusCode)"
                }
                else {
                    Write-Fail "API POST /api/v1/suggest → HTTP $($suggest.StatusCode)"
                }
            }
            else {
                Write-Skip "SMOKE_TWIN_ID não definido — pulando POST /suggest"
            }
        }
    }
    catch {
        Write-Fail "Login/API autenticada → $($_.Exception.Message)"
    }
}
else {
    Write-Skip "SMOKE_EMAIL/SMOKE_PASSWORD não definidos — pulando login"
}

Write-Host ""
Write-Host "=== Resumo ==="
if ($script:Failures -eq 0) {
    Write-Host "Todos os testes obrigatórios passaram. Avisos: $script:Warnings" -ForegroundColor Green
    exit 0
}
Write-Host "Falhas: $script:Failures | Avisos: $script:Warnings" -ForegroundColor Red
exit 1
