const DEFAULT_API_URL = "https://api.twin.app.br/api/v1";

async function getSettings() {
  const data = await chrome.storage.sync.get([
    "apiUrl",
    "token",
    "tenantId",
    "twinId",
    "intensity",
    "sellerMode",
  ]);
  return {
    apiUrl: data.apiUrl || DEFAULT_API_URL,
    token: data.token || "",
    tenantId: data.tenantId || "",
    twinId: data.twinId || "",
    intensity: data.intensity ?? 2,
    sellerMode: Boolean(data.sellerMode),
  };
}

function buildHeaders(settings, json = true) {
  const headers = { Accept: "application/json" };
  if (json) headers["Content-Type"] = "application/json";
  if (settings.token) headers.Authorization = `Bearer ${settings.token}`;
  if (settings.tenantId) headers["X-Tenant"] = settings.tenantId;
  return headers;
}

async function parseError(res) {
  const raw = await res.text();
  try {
    const json = JSON.parse(raw);
    return json.message || json.error || raw || `Erro ${res.status}`;
  } catch {
    return raw || `Erro ${res.status}`;
  }
}

async function apiFetch(path, options = {}) {
  const settings = await getSettings();
  if (!settings.token) throw new Error("Token não configurado. Abra as opções da extensão.");
  if (!settings.tenantId) throw new Error("Organização (tenant) não configurada.");
  if (!settings.twinId && path === "/suggest") {
    throw new Error("Twin não selecionado. Configure nas opções da extensão.");
  }

  const url = `${settings.apiUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...buildHeaders(settings, !(options.body instanceof FormData)),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) throw new Error(await parseError(res));
  if (res.status === 204) return null;
  return res.json();
}

async function suggest(text) {
  const settings = await getSettings();
  return apiFetch("/suggest", {
    method: "POST",
    body: JSON.stringify({
      twin_id: settings.twinId,
      text,
      intensity: settings.intensity,
      seller_mode: settings.sellerMode,
    }),
  });
}

async function listTwins() {
  const data = await apiFetch("/twins");
  return data?.data ?? data ?? [];
}

async function feedback(suggestionId, status, editedText) {
  return apiFetch(`/suggestions/${suggestionId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      ...(editedText ? { edited_text: editedText } : {}),
    }),
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = async () => {
    switch (message.type) {
      case "GET_SETTINGS":
        return getSettings();
      case "SUGGEST":
        return suggest(message.text);
      case "FEEDBACK":
        return feedback(message.suggestionId, message.status, message.editedText);
      case "LIST_TWINS":
        return listTwins();
      case "SAVE_AUTH": {
        await chrome.storage.sync.set({
          token: message.token,
          tenantId: message.tenantId,
        });
        return { ok: true };
      }
      default:
        throw new Error("Ação desconhecida");
    }
  };

  handler()
    .then((result) => sendResponse({ ok: true, data: result }))
    .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));

  return true;
});
