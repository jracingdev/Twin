const DEFAULT_API_URL = "https://api.twin.app.br/api/v1";

/** Credenciais só em chrome.storage.local (nunca sync). */
const STORAGE_KEYS = ["apiUrl", "token", "tenantId", "twinId", "intensity", "sellerMode"];

async function extensionStorageGet(keys = STORAGE_KEYS) {
  const local = await chrome.storage.local.get(keys);
  if (local.token) return local;
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

const TWIN_LOGO_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="#00d4ff" stroke-width="1.5"/><path d="M7 8h10M7 12h7M7 16h10" stroke="#00d4ff" stroke-width="1.5" stroke-linecap="round"/></svg>`;

const fields = {
  apiUrl: document.getElementById("apiUrl"),
  token: document.getElementById("token"),
  tenantId: document.getElementById("tenantId"),
  twinId: document.getElementById("twinId"),
  intensity: document.getElementById("intensity"),
  sellerMode: document.getElementById("sellerMode"),
};

const statusEl = document.getElementById("status");
const authBadgeEl = document.getElementById("auth-badge");
const twinTabHintEl = document.getElementById("twin-tab-hint");

const AUTH_LABELS = {
  ok: { text: "Conectado", className: "auth-ok" },
  no_token: { text: "Sem token", className: "auth-warn" },
  expired: { text: "Token inválido", className: "auth-err" },
  no_tenant: { text: "Sem organização", className: "auth-warn" },
  no_twin: { text: "Twin não selecionado", className: "auth-warn" },
};

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = `status${kind ? ` ${kind}` : ""}`;
}

function setAuthBadge(reason, message) {
  const meta = AUTH_LABELS[reason] || { text: "Desconhecido", className: "auth-warn" };
  authBadgeEl.className = `auth-badge ${meta.className}`;
  authBadgeEl.textContent = meta.text;
  authBadgeEl.title = message || meta.text;
}

async function loadSettings() {
  const data = await extensionStorageGet();

  fields.apiUrl.value = data.apiUrl || DEFAULT_API_URL;
  fields.token.value = data.token || "";
  fields.tenantId.value = data.tenantId || "";
  fields.twinId.value = data.twinId || "";
  fields.intensity.value = data.intensity ?? 2;
  fields.sellerMode.checked = Boolean(data.sellerMode);
}

async function saveSettings(e) {
  e.preventDefault();
  await extensionStorageSet({
    apiUrl: fields.apiUrl.value.trim() || DEFAULT_API_URL,
    token: fields.token.value.trim(),
    tenantId: fields.tenantId.value.trim(),
    twinId: fields.twinId.value,
    intensity: Number(fields.intensity.value) || 2,
    sellerMode: fields.sellerMode.checked,
  });
  setStatus("Configurações salvas.", "ok");
  await validateConnection({ silent: true });
}

async function refreshTwins() {
  setStatus("Carregando twins…");
  try {
    await extensionStorageSet({
      apiUrl: fields.apiUrl.value.trim() || DEFAULT_API_URL,
      token: fields.token.value.trim(),
      tenantId: fields.tenantId.value.trim(),
    });

    const res = await chrome.runtime.sendMessage({ type: "LIST_TWINS" });
    if (!res?.ok) throw new Error(res?.error || "Erro ao listar twins");

    const twins = res.data || [];
    const current = fields.twinId.value;
    fields.twinId.innerHTML = '<option value="">— Selecione —</option>';
    for (const twin of twins) {
      const opt = document.createElement("option");
      opt.value = twin.id;
      opt.textContent = twin.name || twin.id;
      fields.twinId.appendChild(opt);
    }
    if (current) fields.twinId.value = current;
    setStatus(`${twins.length} twin(s) carregado(s).`, "ok");
    await validateConnection({ silent: true });
  } catch (e) {
    setStatus(e.message || String(e), "err");
    setAuthBadge("expired", e.message);
  }
}

async function importFromTwinWeb() {
  setStatus("Buscando sessão no painel TWIN…");

  try {
    const res = await chrome.runtime.sendMessage({ type: "READ_TWIN_AUTH" });
    if (res?.ok && res.data?.token) {
      fields.token.value = res.data.token;
      if (res.data.tenantId) fields.tenantId.value = res.data.tenantId;
      setStatus("Token importado do painel TWIN. Salve as configurações.", "ok");
      return true;
    }
  } catch {
    /* fallback abaixo */
  }

  setStatus(
    "Abra o painel TWIN (twin.app.br) logado em uma aba e tente novamente, ou cole o token manualmente.",
    "err"
  );
  return false;
}

async function detectTwinTab() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "FIND_TWIN_TABS" });
    const tabs = res?.data || [];
    if (tabs.length) {
      const label = tabs[0].title || tabs[0].url || "twin.app.br";
      twinTabHintEl.textContent = `Aba TWIN detectada: ${label}`;
      twinTabHintEl.classList.add("visible");
      return tabs;
    }
  } catch {
    /* ignore */
  }
  twinTabHintEl.textContent = "";
  twinTabHintEl.classList.remove("visible");
  return [];
}

async function validateConnection({ silent = false } = {}) {
  try {
    const res = await chrome.runtime.sendMessage({ type: "VALIDATE_AUTH" });
    if (!res?.ok) throw new Error(res?.error || "Erro na validação");

    const result = res.data;
    setAuthBadge(result.reason, result.message);

    if (!silent && !result.valid) {
      setStatus(result.message, "err");
    } else if (!silent && result.valid) {
      setStatus(result.message, "ok");
    }
    return result;
  } catch (e) {
    setAuthBadge("expired", e.message);
    if (!silent) setStatus(e.message || String(e), "err");
    return { valid: false, reason: "expired" };
  }
}

async function bootstrap() {
  document.querySelector(".logo-wrap").innerHTML = TWIN_LOGO_SVG;

  await loadSettings();
  await detectTwinTab();

  // Auto-importa se não houver token mas houver aba TWIN logada
  if (!fields.token.value) {
    const imported = await importFromTwinWeb();
    if (imported) {
      await extensionStorageSet({
        apiUrl: fields.apiUrl.value.trim() || DEFAULT_API_URL,
        token: fields.token.value.trim(),
        tenantId: fields.tenantId.value.trim(),
      });
    }
  }

  await validateConnection({ silent: true });

  if (fields.token.value && fields.tenantId.value) {
    void refreshTwins();
  }
}

document.getElementById("settings-form").addEventListener("submit", (e) => void saveSettings(e));
document.getElementById("refresh-twins").addEventListener("click", () => void refreshTwins());
document.getElementById("import-auth").addEventListener("click", () => void importFromTwinWeb());
document.getElementById("validate-auth").addEventListener("click", () => void validateConnection());

void bootstrap();
