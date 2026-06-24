/**
 * TWIN Copilot — content script para web.whatsapp.com
 *
 * Limitações conhecidas:
 * - WhatsApp Web altera o DOM com frequência; seletores podem quebrar após updates.
 * - Só mensagens de texto são lidas; mídia, áudio e stickers são ignorados.
 * - A extensão NÃO envia mensagens automaticamente — apenas injeta no campo de composição.
 */

const PANEL_ID = "twin-copilot-panel";

const SELECTORS = {
  main: "#main",
  compose: [
    'div[contenteditable="true"][data-tab="10"]',
    'footer div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][aria-label*="mensagem" i]',
    'div[contenteditable="true"][aria-label*="message" i]',
    'div[contenteditable="true"][data-lexical-editor="true"]',
  ],
  incomingMessages: [
    ".message-in",
    '[data-testid="msg-container"][class*="message-in"]',
    'div.message-in',
  ],
  messageText: [
    "span.selectable-text.copyable-text",
    "span.selectable-text",
    '[data-testid="msg-text"] span',
    ".copyable-text",
  ],
};

function queryFirst(selectors, root = document) {
  for (const sel of selectors) {
    const el = root.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function queryAllFirst(selectors, root = document) {
  for (const sel of selectors) {
    const nodes = root.querySelectorAll(sel);
    if (nodes.length) return nodes;
  }
  return [];
}

function getMainPanel() {
  return document.querySelector(SELECTORS.main);
}

function getSelectedText() {
  const sel = window.getSelection();
  if (sel && sel.toString().trim()) return sel.toString().trim();
  return "";
}

function extractMessageText(node) {
  for (const sel of SELECTORS.messageText) {
    const spans = node.querySelectorAll(sel);
    if (spans.length) {
      return Array.from(spans)
        .map((s) => s.textContent?.trim() || "")
        .filter(Boolean)
        .join("\n");
    }
  }
  return node.textContent?.trim() || "";
}

function getLastIncomingMessage() {
  const main = getMainPanel();
  if (!main) return "";

  for (const sel of SELECTORS.incomingMessages) {
    const messages = main.querySelectorAll(sel);
    if (messages.length) {
      const last = messages[messages.length - 1];
      const text = extractMessageText(last);
      if (text) return text;
    }
  }

  // Fallback: última bolha que não seja message-out
  const bubbles = main.querySelectorAll('[data-testid="msg-container"]');
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const bubble = bubbles[i];
    if (bubble.classList.contains("message-out")) continue;
    const text = extractMessageText(bubble);
    if (text) return text;
  }

  return "";
}

function getInputContext() {
  const selected = getSelectedText();
  if (selected) return { text: selected, source: "seleção" };
  const last = getLastIncomingMessage();
  if (last) return { text: last, source: "última mensagem recebida" };
  return { text: "", source: "" };
}

function findComposeBox() {
  const main = getMainPanel();
  const roots = [document, main].filter(Boolean);
  for (const root of roots) {
    const box = queryFirst(SELECTORS.compose, root);
    if (box) return box;
  }
  return queryFirst(SELECTORS.compose);
}

function injectIntoCompose(text) {
  const box = findComposeBox();
  if (!box) {
    throw new Error("Campo de mensagem não encontrado. Abra uma conversa no WhatsApp Web.");
  }

  box.focus();

  // Tenta inserir via execCommand (compatível com contenteditable do WA)
  const inserted = document.execCommand("insertText", false, text);
  if (!inserted) {
    box.textContent = text;
    box.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  }

  return true;
}

function formatScore(score) {
  if (score == null || Number.isNaN(Number(score))) return "—";
  const n = Number(score);
  const pct = n <= 1 ? Math.round(n * 100) : Math.round(n);
  return `${pct}%`;
}

function renderBreakdown(breakdown) {
  if (!breakdown || typeof breakdown !== "object") return "";
  const labels = {
    formalidade: "Formalidade",
    tom_emocional: "Tom emocional",
    vocabulario: "Vocabulário",
    persuasao: "Persuasão",
    geral: "Geral",
    estilo: "Estilo",
    contexto: "Contexto",
    playbook: "Playbook",
  };
  const rows = Object.entries(breakdown)
    .filter(([, v]) => v != null && !Number.isNaN(Number(v)))
    .map(([k, v]) => {
      const pct = Number(v) <= 1 ? Math.round(Number(v) * 100) : Math.round(Number(v));
      return `<div class="twin-breakdown-row"><span>${labels[k] || k}</span><span>${pct}%</span></div>`;
    });
  if (!rows.length) return "";
  return `<div class="twin-breakdown">${rows.join("")}</div>`;
}

function ensurePanel() {
  let panel = document.getElementById(PANEL_ID);
  if (panel) return panel;

  panel = document.createElement("aside");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <header class="twin-header">
      <span class="twin-logo">TWIN</span>
      <span class="twin-sub">Copilot</span>
      <button type="button" class="twin-toggle" title="Recolher painel">◀</button>
    </header>
    <div class="twin-body">
      <p class="twin-hint">Abra uma conversa e clique em <strong>Sugerir resposta</strong>.</p>
      <div class="twin-source"></div>
      <button type="button" class="twin-btn twin-btn-primary twin-suggest">Sugerir resposta</button>
      <div class="twin-status"></div>
      <div class="twin-result hidden">
        <label>Sugestão</label>
        <textarea class="twin-suggestion" rows="5"></textarea>
        <div class="twin-meta"></div>
        <div class="twin-actions">
          <button type="button" class="twin-btn twin-copy">Copiar</button>
          <button type="button" class="twin-btn twin-btn-primary twin-inject">Inserir no WhatsApp</button>
        </div>
        <div class="twin-feedback hidden">
          <button type="button" class="twin-btn twin-accept">Aceitar sugestão</button>
          <button type="button" class="twin-btn twin-reject">Rejeitar</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(panel);
  document.body.classList.add("twin-copilot-active");

  panel.querySelector(".twin-toggle").addEventListener("click", () => {
    panel.classList.toggle("twin-collapsed");
    const btn = panel.querySelector(".twin-toggle");
    btn.textContent = panel.classList.contains("twin-collapsed") ? "▶" : "◀";
  });

  panel.querySelector(".twin-suggest").addEventListener("click", () => void runSuggest(panel));
  panel.querySelector(".twin-copy").addEventListener("click", () => {
    const text = panel.querySelector(".twin-suggestion").value;
    void navigator.clipboard.writeText(text);
    setStatus(panel, "Copiado!", "ok");
  });
  panel.querySelector(".twin-inject").addEventListener("click", () => {
    const text = panel.querySelector(".twin-suggestion").value;
    try {
      injectIntoCompose(text);
      setStatus(panel, "Texto inserido — revise e envie manualmente.", "ok");
    } catch (e) {
      setStatus(panel, e.message, "err");
    }
  });
  panel.querySelector(".twin-accept").addEventListener("click", () => void sendFeedback(panel, "accepted"));
  panel.querySelector(".twin-reject").addEventListener("click", () => void sendFeedback(panel, "rejected"));

  return panel;
}

function setStatus(panel, text, kind = "") {
  const el = panel.querySelector(".twin-status");
  el.textContent = text;
  el.className = `twin-status${kind ? ` twin-status-${kind}` : ""}`;
}

function setLoading(panel, loading) {
  panel.querySelector(".twin-suggest").disabled = loading;
  panel.querySelector(".twin-suggest").textContent = loading ? "Gerando…" : "Sugerir resposta";
}

async function runSuggest(panel) {
  const ctx = getInputContext();
  const sourceEl = panel.querySelector(".twin-source");
  const resultEl = panel.querySelector(".twin-result");

  if (!ctx.text) {
    setStatus(panel, "Nenhuma mensagem encontrada. Selecione um texto ou abra uma conversa.", "err");
    resultEl.classList.add("hidden");
    sourceEl.textContent = "";
    return;
  }

  sourceEl.textContent = `Fonte: ${ctx.source} — "${ctx.text.slice(0, 120)}${ctx.text.length > 120 ? "…" : ""}"`;
  setLoading(panel, true);
  setStatus(panel, "Consultando seu twin…");

  try {
    const res = await chrome.runtime.sendMessage({ type: "SUGGEST", text: ctx.text });
    if (!res?.ok) throw new Error(res?.error || "Erro desconhecido");

    const data = res.data;
    panel.dataset.suggestionId = data.id || "";

    const suggestion = data.suggested_text || data.suggestion || "";
    panel.querySelector(".twin-suggestion").value = suggestion;

    const breakdown = data.score_breakdown || data.metadata?.score_breakdown;
    panel.querySelector(".twin-meta").innerHTML = `
      <div class="twin-score">Confiança: <strong>${formatScore(data.score ?? data.confidence)}</strong></div>
      ${renderBreakdown(breakdown)}
    `;

    resultEl.classList.remove("hidden");
    panel.querySelector(".twin-feedback").classList.toggle("hidden", !data.id);
    setStatus(panel, "Sugestão pronta. Copie ou insira no campo de mensagem.", "ok");
  } catch (e) {
    setStatus(panel, e.message || String(e), "err");
    resultEl.classList.add("hidden");
  } finally {
    setLoading(panel, false);
  }
}

async function sendFeedback(panel, status) {
  const id = panel.dataset.suggestionId;
  if (!id) return;

  const text = panel.querySelector(".twin-suggestion").value;
  setStatus(panel, status === "accepted" ? "Registrando aceite…" : "Registrando rejeição…");

  try {
    const res = await chrome.runtime.sendMessage({
      type: "FEEDBACK",
      suggestionId: id,
      status,
      editedText: text,
    });
    if (!res?.ok) throw new Error(res?.error || "Erro");
    setStatus(panel, status === "accepted" ? "Aceite registrado no TWIN." : "Rejeição registrada.", "ok");
  } catch (e) {
    setStatus(panel, e.message || String(e), "err");
  }
}

function init() {
  if (window.location.hostname !== "web.whatsapp.com") return;

  const observer = new MutationObserver(() => {
    if (getMainPanel() && !document.getElementById(PANEL_ID)) {
      ensurePanel();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  if (getMainPanel() || document.querySelector("#app")) {
    ensurePanel();
  }
}

init();
