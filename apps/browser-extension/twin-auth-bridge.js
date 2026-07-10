/**
 * Ponte: lê credenciais do sessionStorage do painel TWIN
 * (com fallback a localStorage legado durante migração).
 * Notifica a extensão quando há sessão ativa ao carregar a página.
 * Token da extensão é persistido em chrome.storage.local (nunca sync).
 *
 * Nota: content scripts não interceptam setItem da página (world isolado).
 * Login na mesma aba exige reimportar via popup ou recarregar após login.
 * sessionStorage não dispara o evento `storage` entre abas.
 */
const TOKEN_KEY = "twin_token";
const ORG_KEY = "twin_organization_id";

function readAuth() {
  const token =
    sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || "";
  const tenantId =
    sessionStorage.getItem(ORG_KEY) || localStorage.getItem(ORG_KEY) || "";
  return { token, tenantId };
}

function notifyExtension() {
  const { token, tenantId } = readAuth();
  if (!token) return;
  chrome.runtime.sendMessage({ type: "TWIN_AUTH_AVAILABLE", token, tenantId }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "GET_TWIN_AUTH") return;

  try {
    const { token, tenantId } = readAuth();
    sendResponse({
      ok: true,
      token,
      tenantId,
      loggedIn: Boolean(token),
    });
  } catch (e) {
    sendResponse({ ok: false, error: e.message || String(e) });
  }
  return true;
});

if (readAuth().token) {
  notifyExtension();
}

// Logout/troca de org em outra aba (apenas localStorage legado dispara storage)
window.addEventListener("storage", (e) => {
  if (e.key === TOKEN_KEY || e.key === ORG_KEY) {
    notifyExtension();
  }
});
