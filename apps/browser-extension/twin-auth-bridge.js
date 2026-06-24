/**
 * Ponte opcional: lê credenciais do localStorage do painel TWIN
 * quando o popup da extensão solicita (GET_TWIN_AUTH).
 */
const TOKEN_KEY = "twin_token";
const ORG_KEY = "twin_organization_id";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "GET_TWIN_AUTH") return;

  try {
    sendResponse({
      ok: true,
      token: localStorage.getItem(TOKEN_KEY) || "",
      tenantId: localStorage.getItem(ORG_KEY) || "",
    });
  } catch (e) {
    sendResponse({ ok: false, error: e.message || String(e) });
  }
  return true;
});
