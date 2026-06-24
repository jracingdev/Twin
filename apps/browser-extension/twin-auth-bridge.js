/**
 * Ponte: lê credenciais do localStorage do painel TWIN.
 * Notifica a extensão quando há sessão ativa ou quando o usuário faz login/logout.
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

// Sessão disponível ao carregar a página
if (readAuth().token) {
  notifyExtension();
}

// Login/logout/troca de org em outra aba
window.addEventListener("storage", (e) => {
  if (e.key === TOKEN_KEY || e.key === ORG_KEY) {
    notifyExtension();
  }
});

// SPA: observa mudanças no localStorage da mesma aba (patch leve)
const nativeSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function patchedSetItem(key, value) {
  nativeSetItem(key, value);
  if (key === TOKEN_KEY || key === ORG_KEY) {
    notifyExtension();
  }
};

const nativeRemoveItem = localStorage.removeItem.bind(localStorage);
localStorage.removeItem = function patchedRemoveItem(key) {
  nativeRemoveItem(key);
  if (key === TOKEN_KEY || key === ORG_KEY) {
    notifyExtension();
  }
};
