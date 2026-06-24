/**
 * TWIN Copilot — content script para web.whatsapp.com
 *
 * Limitações conhecidas:
 * - WhatsApp Web altera o DOM com frequência; seletores podem quebrar após updates.
 * - Só mensagens de texto são lidas; mídia, áudio e stickers são ignorados.
 * - A extensão NÃO envia mensagens automaticamente — apenas injeta no campo de composição.
 */

const PANEL_ID = "twin-copilot-panel";
const SHORTCUT_HINT = "Ctrl+Shift+S";

/** Seletores frágeis — ver README.md § Seletores DOM */
const SELECTORS = {
  main: ["#main", '[data-testid="conversation-panel-wrapper"]', "#pane-side ~ div"],
  compose: [
    'footer div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][data-tab="10"]',
    'div[contenteditable="true"][data-lexical-editor="true"]',
    'div[contenteditable="true"][aria-label*="mensagem" i]',
    'div[contenteditable="true"][aria-label*="message" i]',
    'div[contenteditable="true"][aria-label*="Type" i]',
    'div[contenteditable="true"][spellcheck="true"]',
    "footer div[contenteditable='true']",
  ],
  incomingMessages: [
    ".message-in",
    'div.message-in',
    '[data-testid="msg-container"].message-in',
    '[data-testid="msg-container"][class*="message-in"]',
    '[data-icon="tail-in"]',
  ],
  messageText: [
    "span.selectable-text.copyable-text",
    "span.selectable-text",
    '[data-testid="msg-text"] span',
    '[data-testid="conversation-text"]',
    ".copyable-text",
  ],
  outgoingMarker: [".message-out", '[data-icon="tail-out"]'],
};

const BREAKDOWN_LABELS = {
  formalidade: "Formalidade",
  tom_emocional: "Tom emocional",
  vocabulario: "Vocabulário",
  persuasao: "Persuasão",
  geral: "Geral",
  estilo: "Estilo",
  contexto: "Contexto",
  playbook: "Playbook",
};

const TWIN_LOGO_SVG = `<svg class="twin-logo-svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="#00d4ff" stroke-width="1.5"/><path d="M7 8h10M7 12h7M7 16h10" stroke="#00d4ff" stroke-width="1.5" stroke-linecap="round"/></svg>`;

function queryFirst(selectors, root = document) {
  if (!root) return null;
  for (const sel of selectors) {
    try {
      const el = root.querySelector(sel);
      if (el) return el;
    } catch {
      /* seletor inválido */
    }
  }
  return null;
}

function getMainPanel() {
  return queryFirst(SELECTORS.main);
}

function nodeInMain(node) {
  const main = getMainPanel();
  if (!main || !node) return false;
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return el ? main.contains(el) : false;
}

function getSelectedText() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "";

  const text = sel.toString().trim();
  if (!text) return "";

  // Prioriza seleção dentro do painel da conversa
  if (nodeInMain(sel.anchorNode) || nodeInMain(sel.focusNode)) {
    return text;
  }

  // Fallback: qualquer seleção não vazia na página
  return text;
}

function extractMessageText(node) {
  if (!node) return "";

  for (const sel of SELECTORS.messageText) {
    const spans = node.querySelectorAll(sel);
    if (spans.length) {
      const joined = Array.from(spans)
        .map((s) => s.textContent?.trim() || "")
        .filter(Boolean)
        .join("\n");
      if (joined) return joined;
    }
  }

  // Evita capturar metadados (hora, status) quando possível
  const copyable = node.querySelector(".copyable-text, [data-testid='msg-text']");
  if (copyable?.textContent?.trim()) return copyable.textContent.trim();

  return node.textContent?.trim() || "";
}

function isOutgoingMessage(node) {
  if (!node) return false;
  if (node.classList?.contains("message-out")) return true;
  for (const sel of SELECTORS.outgoingMarker) {
    if (node.matches?.(sel) || node.querySelector(sel)) return true;
  }
  return false;
}

function resolveIncomingBubble(node) {
  if (!node) return null;
  if (node.matches?.(".message-in, [data-testid='msg-container']")) return node;
  return node.closest?.(".message-in, [data-testid='msg-container']") || node;
}

function getLastIncomingMessage() {
  const main = getMainPanel();
  if (!main) return "";

  // Estratégia 1: seletores conhecidos de message-in
  for (const sel of SELECTORS.incomingMessages) {
    const nodes = main.querySelectorAll(sel);
    if (!nodes.length) continue;

    for (let i = nodes.length - 1; i >= 0; i--) {
      const bubble = resolveIncomingBubble(nodes[i]);
      if (isOutgoingMessage(bubble)) continue;
      const text = extractMessageText(bubble);
      if (text) return text;
    }
  }

  // Estratégia 2: percorrer msg-container de trás pra frente
  const bubbles = main.querySelectorAll('[data-testid="msg-container"]');
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const bubble = bubbles[i];
    if (isOutgoingMessage(bubble)) continue;
    const text = extractMessageText(bubble);
    if (text) return text;
  }

  // Estratégia 3: linhas de mensagem (role=row) sem indicador de saída
  const rows = main.querySelectorAll('[role="row"]');
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (isOutgoingMessage(row)) continue;
    const text = extractMessageText(row);
    if (text && text.length > 1) return text;
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
  const footer = document.querySelector("footer");
  const roots = [footer, main, document].filter(Boolean);

  for (const root of roots) {
    const box = queryFirst(SELECTORS.compose, root);
    if (box && box.isContentEditable) return box;
  }

  // Fallback: último contenteditable visível no rodapé
  const foot = document.querySelector("footer");
  if (foot) {
    const editables = foot.querySelectorAll('[contenteditable="true"]');
    for (let i = editables.length - 1; i >= 0; i--) {
      const el = editables[i];
      if (el.offsetParent !== null) return el;
    }
  }

  return null;
}

function dispatchInput(box, text) {
  box.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  box.dispatchEvent(new Event("change", { bubbles: true }));
}

function injectIntoCompose(text) {
  const box = findComposeBox();
  if (!box) {
    throw new Error("Campo de mensagem não encontrado. Abra uma conversa no WhatsApp Web.");
  }

  box.focus();

  // Estratégia 1: execCommand (melhor compatibilidade com Lexical)
  const inserted = document.execCommand("insertText", false, text);
  if (inserted) return true;

  // Estratégia 2: beforeinput + input
  try {
    box.dispatchEvent(
      new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: text })
    );
    if (box.textContent !== text) {
      box.textContent = text;
    }
    dispatchInput(box, text);
    return true;
  } catch {
    /* continua */
  }

  // Estratégia 3: innerText + eventos
  box.innerText = text;
  dispatchInput(box, text);
  return true;
}

function toPercent(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

function formatScore(score) {
  if (score == null || Number.isNaN(Number(score))) return "—";
  return `${toPercent(score)}%`;
}

function extractBreakdown(data) {
  return (
    data?.score_breakdown ||
    data?.similarity_baseline ||
    data?.metadata?.score_breakdown ||
    data?.metadata?.similarity_baseline ||
    data?.metadata?.similarity_breakdown ||
    null
  );
}

function renderBreakdown(breakdown) {
  if (!breakdown || typeof breakdown !== "object") return "";

  const rows = Object.entries(breakdown)
    .filter(([, v]) => typeof v === "number" && !Number.isNaN(v))
    .map(([key, raw]) => {
      const pct = toPercent(raw);
      if (pct == null) return "";
      const label = BREAKDOWN_LABELS[key] || key;
      const width = Math.min(100, Math.max(0, pct));
      return `
        <div class="twin-breakdown-item">
          <div class="twin-breakdown-head">
            <span>${label}</span>
            <span class="twin-breakdown-pct">${pct}%</span>
          </div>
          <div class="twin-breakdown-bar"><div style="width:${width}%"></div></div>
        </div>`;
    })
    .filter(Boolean);

  if (!rows.length) return "";
  return `<div class="twin-breakdown"><p class="twin-breakdown-title">Similaridade</p>${rows.join("")}</div>`;
}

function ensurePanel() {
  let panel = document.getElementById(PANEL_ID);
  if (panel) return panel;

  panel = document.createElement("aside");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <header class="twin-header">
      ${TWIN_LOGO_SVG}
      <span class="twin-logo">TWIN</span>
      <span class="twin-sub">Copilot</span>
      <button type="button" class="twin-toggle" title="Recolher painel" aria-label="Recolher painel">◀</button>
    </header>
    <div class="twin-body">
      <p class="twin-hint">Abra uma conversa e clique em <strong>Sugerir resposta</strong> ou use <kbd>${SHORTCUT_HINT}</kbd>.</p>
      <div class="twin-source"></div>
      <button type="button" class="twin-btn twin-btn-primary twin-suggest">Sugerir resposta</button>
      <div class="twin-status" role="status"></div>
      <span class="twin-retry-wrap hidden">
        <button type="button" class="twin-btn twin-retry">Tentar novamente</button>
      </span>
      <div class="twin-result hidden">
        <label for="twin-suggestion-field">Sugestão</label>
        <textarea id="twin-suggestion-field" class="twin-suggestion" rows="5"></textarea>
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
  panel.querySelector(".twin-retry").addEventListener("click", () => void runSuggest(panel));
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

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void runSuggest(panel);
    }
  });

  return panel;
}

function setStatus(panel, text, kind = "") {
  const el = panel.querySelector(".twin-status");
  el.textContent = text;
  el.className = `twin-status${kind ? ` twin-status-${kind}` : ""}`;
}

function setRetryVisible(panel, visible) {
  panel.querySelector(".twin-retry-wrap").classList.toggle("hidden", !visible);
}

function setLoading(panel, loading) {
  const btn = panel.querySelector(".twin-suggest");
  btn.disabled = loading;
  btn.classList.toggle("twin-loading", loading);
  btn.textContent = loading ? "Gerando…" : "Sugerir resposta";
}

async function runSuggest(panel) {
  const ctx = getInputContext();
  const sourceEl = panel.querySelector(".twin-source");
  const resultEl = panel.querySelector(".twin-result");

  setRetryVisible(panel, false);

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

    const breakdown = extractBreakdown(data);
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
    setRetryVisible(panel, true);
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
    setRetryVisible(panel, true);
  }
}

function init() {
  if (window.location.hostname !== "web.whatsapp.com") return;

  const observer = new MutationObserver(() => {
    if ((getMainPanel() || document.querySelector("#app")) && !document.getElementById(PANEL_ID)) {
      ensurePanel();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  if (getMainPanel() || document.querySelector("#app")) {
    ensurePanel();
  }
}

init();
