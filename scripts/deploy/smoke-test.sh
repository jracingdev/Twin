#!/usr/bin/env bash
# TWIN — smoke tests de produção (VPS aaPanel)
# Uso (na raiz do repositório):
#   chmod +x scripts/deploy/smoke-test.sh
#   ./scripts/deploy/smoke-test.sh
#
# Teste completo com login (org demo + suggest):
#   SMOKE_EMAIL=admin@twin.local SMOKE_PASSWORD=password \
#   SMOKE_TWIN_ID=<uuid-do-twin> ./scripts/deploy/smoke-test.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

APP_DIR="${APP_DIR:-$ROOT}"
API_ENV="${API_ENV:-$APP_DIR/apps/api/.env}"
AI_VENV="${AI_VENV:-$APP_DIR/apps/ai-engine/.venv/bin/python}"

SMOKE_API_URL="${SMOKE_API_URL:-https://api.twin.app.br}"
SMOKE_WEB_URL="${SMOKE_WEB_URL:-https://twin.app.br}"
SMOKE_AI_URL="${SMOKE_AI_URL:-http://127.0.0.1:8100}"
SMOKE_TENANT_ID="${SMOKE_TENANT_ID:-}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

FAILURES=0
WARNINGS=0

pass() { echo -e "${GREEN}[PASS]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; FAILURES=$((FAILURES + 1)); }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; WARNINGS=$((WARNINGS + 1)); }
skip() { echo -e "${BLUE}[SKIP]${NC} $*"; }
info() { echo -e "       $*"; }

read_env_var() {
  local file="$1" key="$2"
  local line val
  if [[ ! -f "$file" ]]; then
    return 1
  fi
  line="$(grep -E "^${key}=" "$file" 2>/dev/null | tail -1 || true)"
  [[ -n "$line" ]] || return 1
  val="${line#*=}"
  val="${val%$'\r'}"
  if [[ "$val" == \"*\" && "$val" == *\" ]]; then
    val="${val:1:${#val}-2}"
  elif [[ "$val" == \'*\' && "$val" == *\' ]]; then
    val="${val:1:${#val}-2}"
  fi
  printf '%s' "$val"
}

json_field() {
  local json="$1" field="$2"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$json" | jq -r ".$field // empty"
    return
  fi
  ROOT="$ROOT" FIELD="$field" python3 -c '
import json, os, sys
data = json.load(sys.stdin)
keys = os.environ["FIELD"].split(".")
cur = data
for k in keys:
    if not isinstance(cur, dict) or k not in cur:
        sys.exit(0)
    cur = cur[k]
if cur is None:
    sys.exit(0)
print(cur)
' <<<"$json"
}

http_code() {
  local url="$1"
  shift
  curl -sS -o /dev/null -w '%{http_code}' "$@" "$url" 2>/dev/null || echo "000"
}

echo "=== TWIN smoke test (produção) ==="
info "Raiz: $APP_DIR"
info "API:  $SMOKE_API_URL"
info "Web:  $SMOKE_WEB_URL"
info "AI:   $SMOKE_AI_URL"
echo ""

# --- Supervisor (obrigatório) ---
supervisorctl_cmd() {
  if [[ -n "${SUPERVISORCTL:-}" ]]; then
    $SUPERVISORCTL "$@"
  elif [[ "$(id -u)" -eq 0 ]]; then
    supervisorctl "$@"
  else
    sudo supervisorctl "$@"
  fi
}

if command -v supervisorctl >/dev/null 2>&1; then
  all_status="$(supervisorctl_cmd status 2>/dev/null || true)"
  if [[ -z "$all_status" ]]; then
    fail "supervisorctl status vazio (tente: sudo supervisorctl status)"
  else
    check_supervisor() {
      local pattern="$1" label="$2" min="${3:-1}"
      local count
      count="$(printf '%s\n' "$all_status" | grep -E "$pattern" | grep -c RUNNING || true)"
      if [[ "${count:-0}" -ge "$min" ]]; then
        pass "Supervisor $label RUNNING (${count} processo(s))"
      else
        fail "Supervisor $label não está RUNNING (esperado >= ${min})"
        printf '%s\n' "$all_status" | grep -E "$pattern" | head -5 | sed 's/^/       /' || true
      fi
    }
    # aaPanel usa grupo twin: — ex.: twin:twin-queue_00, twin:twin-ai-engine
    check_supervisor '^twin:twin-queue' 'twin-queue' 1
    check_supervisor '^twin:twin-ai-engine' 'twin-ai-engine' 1
    check_supervisor '^twin:twin-celery' 'twin-celery' 1
  fi
else
  fail "supervisorctl não encontrado"
fi

# --- PM2 twin-web (opcional) ---
if command -v pm2 >/dev/null 2>&1; then
  if pm2 jlist 2>/dev/null | grep -q '"name":"twin-web"'; then
    pm2_line="$(pm2 status twin-web 2>/dev/null | grep -E 'twin-web' | head -1 || true)"
    if [[ "$pm2_line" == *online* ]]; then
      pass "PM2 twin-web online"
    else
      warn "PM2 twin-web encontrado mas não online — $pm2_line"
    fi
  else
    warn "PM2 twin-web não encontrado (opcional)"
  fi
else
  warn "pm2 não encontrado — pulando checagem twin-web"
fi

# --- API /up ---
api_code="$(http_code "$SMOKE_API_URL/up")"
if [[ "$api_code" == "200" ]]; then
  pass "API GET /up → HTTP $api_code"
else
  fail "API GET /up → HTTP $api_code (esperado 200)"
fi

# --- AI health (direto) ---
ai_code="$(http_code "$SMOKE_AI_URL/health")"
if [[ "$ai_code" == "200" ]]; then
  pass "AI Engine GET /health (direto) → HTTP $ai_code"
else
  fail "AI Engine GET /health (direto) → HTTP $ai_code (esperado 200)"
fi

# --- AI health (proxy nginx) ---
proxy_code="$(http_code "$SMOKE_WEB_URL/ai-engine/health")"
if [[ "$proxy_code" == "200" ]]; then
  pass "AI Engine GET /ai-engine/health (proxy) → HTTP $proxy_code"
else
  warn "AI proxy GET /ai-engine/health → HTTP $proxy_code (opcional; nginx web)"
fi

# --- AI ingest batch (secret do .env da API) ---
AI_SECRET="$(read_env_var "$API_ENV" AI_ENGINE_SECRET || true)"
if [[ -z "${AI_SECRET:-}" ]]; then
  fail "AI_ENGINE_SECRET ausente em $API_ENV"
else
  batch_id="smoke-$(date +%s)"
  ingest_body="$(cat <<EOF
{"tenant_id":"smoke-test","twin_id":"smoke-test","batch_id":"$batch_id","source":"whatsapp","content":"aGVsbG8="}
EOF
)"
  ingest_tmp="$(mktemp)"
  ingest_code="$(curl -sS -o "$ingest_tmp" -w '%{http_code}' \
    -X POST "$SMOKE_AI_URL/ai/ingest/batch" \
    -H "Content-Type: application/json" \
    -H "X-Internal-Secret: $AI_SECRET" \
    -d "$ingest_body" 2>/dev/null || echo "000")"
  ingest_status="$(json_field "$(cat "$ingest_tmp" 2>/dev/null || echo '{}')" status)"
  rm -f "$ingest_tmp"
  if [[ "$ingest_code" == "200" && "$ingest_status" == "queued" ]]; then
    pass "AI POST /ai/ingest/batch → HTTP $ingest_code status=$ingest_status"
  elif [[ "$ingest_code" == "200" ]]; then
    pass "AI POST /ai/ingest/batch → HTTP $ingest_code (status=$ingest_status)"
  else
    fail "AI POST /ai/ingest/batch → HTTP $ingest_code (esperado 200 queued)"
  fi
fi

# --- Pinecone get_index ---
if [[ -x "$AI_VENV" || -f "$AI_VENV" ]]; then
  pine_tmp="$(mktemp)"
  if (cd "$APP_DIR/apps/ai-engine" && "$AI_VENV" -c "
from app.services.pinecone_client import get_index
idx = get_index()
if idx is None:
    raise SystemExit('index_unavailable')
print('ok')
" >"$pine_tmp" 2>&1); then
    pass "Pinecone get_index() disponível"
  else
    fail "Pinecone get_index() indisponível — veja logs do ai-engine"
    info "$(head -3 "$pine_tmp" | sed 's/^/         /')"
  fi
  rm -f "$pine_tmp"
else
  fail "Python venv do ai-engine não encontrado em $AI_VENV"
fi

# --- Login + plan + suggest (opcional) ---
if [[ -n "${SMOKE_EMAIL:-}" && -n "${SMOKE_PASSWORD:-}" ]]; then
  login_tmp="$(mktemp)"
  login_code="$(curl -sS -o "$login_tmp" -w '%{http_code}' \
    -X POST "$SMOKE_API_URL/api/v1/login" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"$SMOKE_PASSWORD\"}" 2>/dev/null || echo "000")"
  login_json="$(cat "$login_tmp" 2>/dev/null || echo '{}')"
  rm -f "$login_tmp"

  if [[ "$login_code" != "200" ]]; then
    fail "API POST /api/v1/login → HTTP $login_code"
  elif [[ "$(json_field "$login_json" two_factor_required)" == "true" ]]; then
    warn "Login exige 2FA — pulando /plan e /suggest"
  else
    pass "API POST /api/v1/login → HTTP $login_code"
    TOKEN="$(json_field "$login_json" token)"
    TENANT_ID="${SMOKE_TENANT_ID:-$(json_field "$login_json" organization.id)}"

    if [[ -z "$TOKEN" || -z "$TENANT_ID" ]]; then
      fail "Login sem token ou organization.id"
    else
      plan_tmp="$(mktemp)"
      plan_code="$(curl -sS -o "$plan_tmp" -w '%{http_code}' \
        -H "Authorization: Bearer $TOKEN" \
        -H "X-Tenant: $TENANT_ID" \
        -H "Accept: application/json" \
        "$SMOKE_API_URL/api/v1/plan" 2>/dev/null || echo "000")"
      plan_json="$(cat "$plan_tmp" 2>/dev/null || echo '{}')"
      plan_slug="$(json_field "$plan_json" slug)"
      rm -f "$plan_tmp"

      if [[ "$plan_code" == "200" && "$plan_slug" == "business" ]]; then
        pass "API GET /api/v1/plan → business (demo)"
      elif [[ "$plan_code" == "200" ]]; then
        warn "API GET /api/v1/plan → slug=$plan_slug (esperado business para org demo)"
      else
        fail "API GET /api/v1/plan → HTTP $plan_code"
      fi

      if [[ -n "${SMOKE_TWIN_ID:-}" ]]; then
        suggest_tmp="$(mktemp)"
        suggest_code="$(curl -sS -o "$suggest_tmp" -w '%{http_code}' \
          -X POST "$SMOKE_API_URL/api/v1/suggest" \
          -H "Authorization: Bearer $TOKEN" \
          -H "X-Tenant: $TENANT_ID" \
          -H "Content-Type: application/json" \
          -H "Accept: application/json" \
          -d "{\"twin_id\":\"$SMOKE_TWIN_ID\",\"text\":\"smoke test — olá\"}" 2>/dev/null || echo "000")"
        rm -f "$suggest_tmp"
        if [[ "$suggest_code" == "200" || "$suggest_code" == "201" ]]; then
          pass "API POST /api/v1/suggest → HTTP $suggest_code"
        else
          fail "API POST /api/v1/suggest → HTTP $suggest_code (esperado 200)"
        fi
      else
        skip "SMOKE_TWIN_ID não definido — pulando POST /suggest"
      fi
    fi
  fi
else
  skip "SMOKE_EMAIL/SMOKE_PASSWORD não definidos — pulando login/plan/suggest"
fi

echo ""
echo "=== Resumo ==="
if [[ $FAILURES -eq 0 ]]; then
  echo -e "${GREEN}Todos os testes obrigatórios passaram.${NC} Avisos: $WARNINGS"
  exit 0
fi

echo -e "${RED}Falhas: $FAILURES${NC} | Avisos: $WARNINGS"
exit 1
