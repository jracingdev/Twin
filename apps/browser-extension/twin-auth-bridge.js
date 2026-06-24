/**
 * Ponte: lê credenciais do localStorage do painel TWIN.
 * Notifica a extensão quando há sessão ativa ao carregar a página.
 *
 * Nota: content scripts não interceptam setItem da página (world isolado).
 * Login na mesma aba exige reimportar via popup ou recarregar após login.
 */
const TOKEN_KEY = "twin_token";
const ORG_KEY = "twin_organization_id";

function readAuth() {
  return {
    token: localStorage.getItem(TOKEN_KEY) || "",
    tenantId: localStorage.getItem(ORG_KEY) || "",
  };
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

// Login/logout/troca de org em outra aba do painel
window.addEventListener("storage", (e) => {
  if (e.key === TOKEN_KEY || e.key === ORG_KEY) {
    notifyExtension();
  }
});
