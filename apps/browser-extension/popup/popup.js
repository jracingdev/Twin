const DEFAULT_API_URL = "https://api.twin.app.br/api/v1";

const fields = {
  apiUrl: document.getElementById("apiUrl"),
  token: document.getElementById("token"),
  tenantId: document.getElementById("tenantId"),
  twinId: document.getElementById("twinId"),
  intensity: document.getElementById("intensity"),
  sellerMode: document.getElementById("sellerMode"),
};

const statusEl = document.getElementById("status");

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = `status${kind ? ` ${kind}` : ""}`;
}

async function loadSettings() {
  const data = await chrome.storage.sync.get([
    "apiUrl",
    "token",
    "tenantId",
    "twinId",
    "intensity",
    "sellerMode",
  ]);

  fields.apiUrl.value = data.apiUrl || DEFAULT_API_URL;
  fields.token.value = data.token || "";
  fields.tenantId.value = data.tenantId || "";
  fields.twinId.value = data.twinId || "";
  fields.intensity.value = data.intensity ?? 2;
  fields.sellerMode.checked = Boolean(data.sellerMode);
}

async function saveSettings(e) {
  e.preventDefault();
  await chrome.storage.sync.set({
    apiUrl: fields.apiUrl.value.trim() || DEFAULT_API_URL,
    token: fields.token.value.trim(),
    tenantId: fields.tenantId.value.trim(),
    twinId: fields.twinId.value,
    intensity: Number(fields.intensity.value) || 2,
    sellerMode: fields.sellerMode.checked,
  });
  setStatus("Configurações salvas.", "ok");
}

async function refreshTwins() {
  setStatus("Carregando twins…");
  try {
    // Salva credenciais antes de listar
    await chrome.storage.sync.set({
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
  } catch (e) {
    setStatus(e.message || String(e), "err");
  }
}

async function importFromTwinWeb() {
  setStatus("Buscando sessão no painel TWIN…");

  const twinOrigins = [
    "https://twin.app.br",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];

  for (const origin of twinOrigins) {
    try {
      const tabs = await chrome.tabs.query({ url: `${origin}/*` });
      if (!tabs.length) continue;

      const tab = tabs[0];
      const res = await chrome.tabs.sendMessage(tab.id, { type: "GET_TWIN_AUTH" });
      if (res?.ok && res.token) {
        fields.token.value = res.token;
        if (res.tenantId) fields.tenantId.value = res.tenantId;
        setStatus("Token importado do painel TWIN. Salve as configurações.", "ok");
        return;
      }
    } catch {
      // Aba sem content script ou sem login
    }
  }

  setStatus(
    "Abra o painel TWIN (twin.app.br) logado em uma aba e tente novamente, ou cole o token manualmente.",
    "err"
  );
}

document.getElementById("settings-form").addEventListener("submit", (e) => void saveSettings(e));
document.getElementById("refresh-twins").addEventListener("click", () => void refreshTwins());
document.getElementById("import-auth").addEventListener("click", () => void importFromTwinWeb());

void loadSettings().then(() => {
  if (fields.token.value && fields.tenantId.value) {
    void refreshTwins();
  }
});
