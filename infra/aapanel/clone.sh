#!/usr/bin/env bash
# TWIN — clone inicial quando o aaPanel criou o site sem Git
# Uso:
#   chmod +x infra/aapanel/clone.sh
#   ./infra/aapanel/clone.sh
#   TARGET_DIR=/caminho/custom ./infra/aapanel/clone.sh
#
# Repositório privado (GitHub não aceita senha da conta):
#   export GITHUB_TOKEN='ghp_...'   # PAT classic, escopo repo — NUNCA commite
#   ./infra/aapanel/clone.sh
# Ou com GIT_ASKPASS (token não embutido na URL do git):
#   export GITHUB_TOKEN='ghp_...'
#   export GIT_ASKPASS="$(mktemp)" && printf '#!/bin/sh\necho "$GITHUB_TOKEN"\n' > "$GIT_ASKPASS" && chmod 700 "$GIT_ASKPASS"
#   export GIT_TERMINAL_PROMPT=0 && ./infra/aapanel/clone.sh
#   rm -f "$GIT_ASKPASS"
# SSH: REPO_URL=git@github.com:jracingdev/Twin.git ./infra/aapanel/clone.sh
# Doc: docs/deployment/aapanel.md — "Clonar repositório (HTTPS com PAT ou SSH)"
set -euo pipefail

TARGET_DIR="${TARGET_DIR:-/www/wwwroot/twin.app.br}"
REPO_URL="${REPO_URL:-https://github.com/jracingdev/Twin.git}"
BRANCH="${BRANCH:-main}"

# PAT via HTTPS — injeta token na URL só nesta sessão (não persiste no repo)
if [[ -n "${GITHUB_TOKEN:-}" && "${REPO_URL}" == https://github.com/* ]]; then
  REPO_URL="https://${GITHUB_TOKEN}@github.com/${REPO_URL#https://github.com/}"
fi

log() { echo "[twin-clone] $*"; }
die() { echo "[twin-clone] ERRO: $*" >&2; exit 1; }

# Arquivos típicos que o aaPanel deixa em site novo (não contam como "conteúdo real")
AAPANEL_DEFAULTS=(
  index.html
  index.php
  404.html
  .htaccess
  .user.ini
)

is_aapanel_only() {
  local name
  for name in "$@"; do
    local base
    base="$(basename "$name")"
    local found=0
    for def in "${AAPANEL_DEFAULTS[@]}"; do
      if [[ "$base" == "$def" ]]; then
        found=1
        break
      fi
    done
    if [[ "$found" -eq 0 ]]; then
      return 1
    fi
  done
  return 0
}

dir_is_empty_or_default() {
  local dir="$1"
  if [[ ! -d "$dir" ]]; then
    return 0
  fi
  shopt -s nullglob dotglob
  local entries=("$dir"/* "$dir"/.[!.]* "$dir"/..?*)
  shopt -u nullglob dotglob
  if [[ ${#entries[@]} -eq 0 ]]; then
    return 0
  fi
  is_aapanel_only "${entries[@]}"
}

print_option_b() {
  cat <<EOF

[twin-clone] A pasta já contém arquivos além do padrão do aaPanel.
[twin-clone] Use a Opção B (Git na pasta existente):

  cd ${TARGET_DIR}
  git init
  git remote add origin ${REPO_URL}
  git fetch origin
  git checkout -b ${BRANCH} origin/${BRANCH}

Se houver conflito com arquivos locais:

  cd ${TARGET_DIR}
  rm -f index.html index.php 404.html .htaccess
  git checkout -f ${BRANCH}

Documentação: docs/deployment/aapanel.md — "Site criado no aaPanel sem Git"
Repo privado: docs/deployment/aapanel.md — "Clonar repositório (HTTPS com PAT ou SSH)"
EOF
}

if [[ -d "${TARGET_DIR}/.git" ]]; then
  log "Repositório Git já existe em ${TARGET_DIR}"
  cd "${TARGET_DIR}"
  git remote -v | head -2 || true
  log "Para atualizar: cd ${TARGET_DIR} && git pull origin ${BRANCH}"
  exit 0
fi

if dir_is_empty_or_default "${TARGET_DIR}"; then
  log "Clonando ${REPO_URL} → ${TARGET_DIR}"
  if [[ -d "${TARGET_DIR}" ]]; then
    shopt -s nullglob dotglob
    rm -rf "${TARGET_DIR}"/* "${TARGET_DIR}"/.[!.]* "${TARGET_DIR}"/..?* 2>/dev/null || true
    shopt -u nullglob dotglob
  else
    mkdir -p "${TARGET_DIR}"
  fi
  git clone --branch "${BRANCH}" "${REPO_URL}" "${TARGET_DIR}"
  log "Clone concluído. Próximo passo:"
  log "  cd ${TARGET_DIR} && chmod +x infra/aapanel/setup.sh && ./infra/aapanel/setup.sh"
  exit 0
fi

print_option_b
exit 1
