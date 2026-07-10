const DEFAULT_API_URL = "https://api.twin.app.br/api/v1";

/** Credenciais ficam só em chrome.storage.local (nunca sync — evita sync na conta Google). */
const STORAGE_KEYS = ["apiUrl", "token", "tenantId", "twinId", "intensity", "sellerMode"];

async function extensionStorageGet(keys = STORAGE_KEYS) {
  const local = await chrome.storage.local.get(keys);
  if (local.token) return local;

  // Migração one-shot de versões antigas que usavam sync
  try {
    const sync = await chrome.storage.sync.get(keys);
    if (sync.token) {
      await chrome.storage.local.set(sync);
      await chrome.storage.sync.remove(keys);
      return { ...local, ...sync };
    }
  } catch {
    /* sync indisponível */
  }
  return local;
}

async function extensionStorageSet(values) {
  await chrome.storage.local.set(values);
}

async function getSettings() {
  const data = await extensionStorageGet();
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

function mapHttpError(status, body) {
  if (status === 401) return "Token expirado ou inválido. Reimporte do painel TWIN ou faça login novamente.";
  if (status === 403) return "Sem permissão para esta organização. Verifique o ID da organização (X-Tenant).";
  if (status === 404) return "Recurso não encontrado. Verifique a URL da API.";
  if (status === 422) return body || "Dados inválidos na requisição.";
  if (status >= 500) return "Erro no servidor TWIN. Tente novamente em instantes.";
  return body || `Erro ${status}`;
}

async function parseError(res) {
  const raw = await res.text();
  try {
    const json = JSON.parse(raw);
    const msg = json.message || json.error || raw;
    return mapHttpError(res.status, msg);
  } catch {
    return mapHttpError(res.status, raw);
  }
}

async function apiFetch(path, options = {}, { requireTwin = false, requireTenant = true } = {}) {
  const settings = await getSettings();
  if (!settings.token) throw new Error("Token não configurado. Abra as opções da extensão.");
  if (requireTenant && !settings.tenantId) {
    throw new Error("Organização (tenant) não configurada.");
  }
  if (requireTwin && !settings.twinId) {
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
  return apiFetch(
    "/suggest",
    {
      method: "POST",
      body: JSON.stringify({
        twin_id: settings.twinId,
        text,
        intensity: settings.intensity,
        seller_mode: settings.sellerMode,
      }),
    },
    { requireTwin: true }
  );
}

async function listTwins() {
  const data = await apiFetch("/twins");
  return data?.data ?? data ?? [];
}

async function validateAuth() {
  const settings = await getSettings();
  if (!settings.token) {
    return { valid: false, reason: "no_token", message: "Token não configurado." };
  }

  try {
    await apiFetch("/me", {}, { requireTenant: false });
  } catch (e) {
    return {
      valid: false,
      reason: "expired",
      message: e.message || "Token inválido ou expirado.",
    };
  }

  if (!settings.tenantId) {
    return { valid: false, reason: "no_tenant", message: "Organização não configurada." };
  }

  if (!settings.twinId) {
    return { valid: false, reason: "no_twin", message: "Twin não selecionado." };
  }

  return { valid: true, reason: "ok", message: "Conectado ao TWIN." };
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

const TWIN_TAB_PATTERNS = [
  "https://twin.app.br/*",
  "https://*.twin.app.br/*",
  "http://localhost:3000/*",
  "http://127.0.0.1:3000/*",
];

async function findTwinTabs() {
  const seen = new Set();
  const tabs = [];
  for (const pattern of TWIN_TAB_PATTERNS) {
    const found = await chrome.tabs.query({ url: pattern });
    for (const tab of found) {
      if (!seen.has(tab.id)) {
        seen.add(tab.id);
        tabs.push({ id: tab.id, url: tab.url, title: tab.title });
      }
    }
  }
  return tabs;
}

async function readAuthFromTab(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: "GET_TWIN_AUTH" });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = async () => {
    switch (message.type) {
      case "GET_SETTINGS":
        return getSettings();
      case "VALIDATE_AUTH":
        return validateAuth();
      case "FIND_TWIN_TABS":
        return findTwinTabs();
      case "READ_TWIN_AUTH": {
        const tabs = await findTwinTabs();
        for (const tab of tabs) {
          try {
            const auth = await readAuthFromTab(tab.id);
            if (auth?.ok && auth.token) {
              return { ...auth, tabId: tab.id, tabUrl: tab.url };
            }
          } catch {
            /* aba sem bridge ou não logada */
          }
        }
        return { ok: false, reason: "no_tab", message: "Nenhuma aba TWIN logada encontrada." };
      }
      case "SUGGEST":
        return suggest(message.text);
      case "FEEDBACK":
        return feedback(message.suggestionId, message.status, message.editedText);
      case "LIST_TWINS":
        return listTwins();
      case "SAVE_AUTH": {
        await extensionStorageSet({
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

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "TWIN_AUTH_AVAILABLE") return;
  if (!message.token) return;
  void extensionStorageSet({
    token: message.token,
    ...(message.tenantId ? { tenantId: message.tenantId } : {}),
  });
});
