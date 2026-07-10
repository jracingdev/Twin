"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { TwinSelect } from "@/components/TwinSelect";
import { useAuth } from "@/contexts/AuthContext";
import {
  twinApi,
  type ChannelCredential,
  type ChannelReplyMode,
} from "@/lib/api";

const CHANNEL_FORMS: Record<
  string,
  {
    key: string;
    label: string;
    type?: string;
    placeholder?: string;
    required?: boolean;
    hint?: string;
  }[]
> = {
  whatsapp: [
    { key: "phone_number_id", label: "Phone Number ID", required: true },
    { key: "access_token", label: "Access Token", type: "password", required: true },
    {
      key: "verify_token",
      label: "Verify Token",
      required: true,
      placeholder: "string aleatória (igual na Meta)",
    },
    { key: "app_secret", label: "App Secret", type: "password", required: true },
  ],
  telegram: [
    { key: "bot_token", label: "Bot Token (BotFather)", type: "password", required: true },
    {
      key: "secret_token",
      label: "Secret Token (webhook)",
      type: "password",
      required: false,
      placeholder: "mín. 8 caracteres — obrigatório em produção",
      hint: "Gere e use o mesmo valor em setWebhook. Em produção a API exige; em local/dev o Twin avisa se faltar.",
    },
  ],
  slack: [
    { key: "bot_token", label: "Bot Token", type: "password", required: true },
    { key: "signing_secret", label: "Signing Secret", type: "password", required: true },
  ],
  discord: [
    { key: "bot_token", label: "Bot Token", type: "password", required: true },
    { key: "public_key", label: "Public Key", required: true },
  ],
};

const REPLY_MODES: {
  value: ChannelReplyMode;
  label: string;
  description: string;
}[] = [
  {
    value: "assistant",
    label: "Assistente",
    description: "Só gera sugestões internas — sem envio ao canal.",
  },
  {
    value: "copilot",
    label: "Copiloto (aprovação)",
    description: "Sugestões na Inbox; humano aprova e envia.",
  },
  {
    value: "auto",
    label: "Agente (autônomo)",
    description:
      "O twin do melhor vendedor responde sozinho quando a confiança ≥ limiar.",
  },
];

function normalizeReplyMode(mode: string): ChannelReplyMode {
  if (mode === "approval") return "copilot";
  if (mode === "assistant" || mode === "copilot" || mode === "auto") return mode;
  return "copilot";
}

function modeLabel(mode: string): string {
  return REPLY_MODES.find((m) => m.value === normalizeReplyMode(mode))?.label ?? mode;
}

function randomSecret(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function SettingsChannelsPage() {
  const { organization } = useAuth();
  const canManage = useMemo(() => {
    const role = (organization?.role || "").toLowerCase();
    return role === "owner" || role === "admin";
  }, [organization?.role]);

  const [credentials, setCredentials] = useState<ChannelCredential[]>([]);
  const [twinId, setTwinId] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [replyMode, setReplyMode] = useState<ChannelReplyMode>("auto");
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.75);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [editingMode, setEditingMode] = useState<Record<string, ChannelReplyMode>>({});
  const [editingThreshold, setEditingThreshold] = useState<Record<string, number>>({});
  const [wizardStep, setWizardStep] = useState(1);

  function load() {
    twinApi
      .listChannelCredentials()
      .then((list) => {
        setCredentials(list);
        const modes: Record<string, ChannelReplyMode> = {};
        const thresholds: Record<string, number> = {};
        list.forEach((c) => {
          modes[c.id] = normalizeReplyMode(c.reply_mode);
          thresholds[c.id] = c.confidence_threshold ?? 0.75;
        });
        setEditingMode(modes);
        setEditingThreshold(thresholds);
      })
      .catch(() => setCredentials([]));
  }

  useEffect(() => {
    load();
  }, [organization?.id]);

  async function handleConnect(e: FormEvent) {
    e.preventDefault();
    if (!twinId || !canManage) return;
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const credentials = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v.trim() !== "")
      );
      const created = await twinApi.createChannelCredential({
        twin_id: twinId,
        channel,
        credentials,
        reply_mode: replyMode,
        ...(replyMode === "auto"
          ? { confidence_threshold: confidenceThreshold }
          : {}),
      });
      setMsg(
        `Canal ${created.channel} conectado. Copie o webhook agora: ${created.webhook_url}`
      );
      setForm({});
      setWizardStep(4);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conectar");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(c: ChannelCredential) {
    if (!canManage) return;
    await twinApi.updateChannelCredential(c.id, { is_active: !c.is_active });
    load();
  }

  async function saveChannelSettings(c: ChannelCredential) {
    if (!canManage) return;
    const mode = editingMode[c.id] ?? normalizeReplyMode(c.reply_mode);
    const threshold = editingThreshold[c.id] ?? c.confidence_threshold ?? 0.75;
    await twinApi.updateChannelCredential(c.id, {
      reply_mode: mode,
      ...(mode === "auto" ? { confidence_threshold: threshold } : {}),
    });
    setMsg(`Configurações de ${c.channel} salvas.`);
    load();
  }

  async function remove(c: ChannelCredential) {
    if (!canManage) return;
    if (!confirm(`Remover canal ${c.channel}?`)) return;
    await twinApi.deleteChannelCredential(c.id);
    load();
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/settings" className="text-sm text-twin-cyan hover:underline">
          ← Configurações
        </Link>
        <h1 className="mt-2 text-3xl font-bold neon-text">Conectar canais</h1>
        <p className="mt-2 max-w-2xl text-sm text-twin-muted">
          Conecte a conta da empresa ao twin do melhor vendedor. Quem tem papel{" "}
          <strong className="text-white">owner</strong> ou{" "}
          <strong className="text-white">admin</strong> cadastra o canal; o agente
          responde no estilo clonado.
        </p>
      </div>

      {/* Honest model */}
      <div className="glass space-y-3 border border-twin-cyan/25 p-5">
        <p className="font-medium text-twin-cyan">Modelo honesto — o que cada caminho faz</p>
        <ul className="space-y-2 text-sm text-twin-muted">
          <li>
            <strong className="text-white">WhatsApp Business API (Meta Cloud)</strong> —
            único caminho para o agente <em>enviar sozinho</em> (número Business).
          </li>
          <li>
            <strong className="text-white">WhatsApp pessoal / WhatsApp Web</strong> — só a{" "}
            <Link href="/docs" className="text-twin-cyan hover:underline">
              extensão Copilot
            </Link>
            : Twin sugere, humano envia. Sem Baileys/Evolution.
          </li>
          <li>
            <strong className="text-white">Telegram</strong> — Bot API (BotFather → token +
            secret_token no Twin).
          </li>
        </ul>
        <p className="text-xs text-twin-muted">
          Docs: <code className="text-twin-cyan">docs/product/connect-channels-seller.md</code>{" "}
          e <code className="text-twin-cyan">docs/product/piloto-primeiros-passos.md</code>.
        </p>
      </div>

      {/* Checklist clone → connect */}
      <div className="glass space-y-3 border border-twin-magenta/20 p-5">
        <p className="font-medium text-twin-magenta">Checklist piloto (clone → agente)</p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-twin-muted">
          <li>
            Importe conversas do melhor vendedor em{" "}
            <Link href="/import" className="text-twin-cyan hover:underline">
              /import
            </Link>{" "}
            (informe o <em>nome do vendedor</em> como no export).
          </li>
          <li>
            No twin, ative <strong className="text-white">Modo vendedor</strong> e ajuste a
            intensidade.
          </li>
          <li>
            Conecte WhatsApp Business ou Telegram abaixo apontando para esse twin.
          </li>
          <li>
            Escolha modo <strong className="text-white">Agente</strong> (auto) ou{" "}
            <strong className="text-white">Copiloto</strong> (Inbox).
          </li>
          <li>
            Worker com fila <code className="text-twin-cyan">channel</code>:{" "}
            <code className="text-xs">php artisan queue:work redis --queue=default,channel</code>
          </li>
          <li>
            Teste: mensagem de texto → resposta automática ou sugestão na{" "}
            <Link href="/inbox" className="text-twin-cyan hover:underline">
              Inbox
            </Link>
            .
          </li>
        </ol>
      </div>

      {!canManage && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          Seu papel nesta organização é <strong>{organization?.role || "member"}</strong>.
          Só <strong>owner</strong> e <strong>admin</strong> podem conectar ou alterar
          canais. Peça a um admin ou use a Inbox se tiver permissão de revisão.
        </div>
      )}

      {/* Wizard steps */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { n: 1, label: "Escolher twin" },
          { n: 2, label: "Canal + modo" },
          { n: 3, label: "Credenciais" },
          { n: 4, label: "Webhook + worker" },
        ].map((s) => (
          <button
            key={s.n}
            type="button"
            onClick={() => setWizardStep(s.n)}
            className={`rounded-full border px-3 py-1 ${
              wizardStep === s.n
                ? "border-twin-cyan bg-twin-cyan/15 text-twin-cyan"
                : "border-twin-cyan/20 text-twin-muted"
            }`}
          >
            {s.n}. {s.label}
          </button>
        ))}
      </div>

      <div className="glass grid gap-4 p-6 md:grid-cols-3">
        {REPLY_MODES.map((m) => (
          <div
            key={m.value}
            className="rounded-lg border border-twin-cyan/10 bg-black/20 p-4"
          >
            <p className="font-medium text-twin-cyan">{m.label}</p>
            <p className="mt-1 text-xs text-twin-muted">{m.description}</p>
          </div>
        ))}
      </div>

      {credentials.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Canais conectados</h2>
          {credentials.map((c) => {
            const mode = editingMode[c.id] ?? normalizeReplyMode(c.reply_mode);
            const threshold = editingThreshold[c.id] ?? c.confidence_threshold ?? 0.75;
            return (
              <div key={c.id} className="glass space-y-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium capitalize text-twin-cyan">{c.channel}</p>
                    <p className="text-xs text-twin-muted">
                      Modo: {modeLabel(c.reply_mode)}
                      {normalizeReplyMode(c.reply_mode) === "auto" &&
                        ` · Limiar ${Math.round((c.confidence_threshold ?? 0.75) * 100)}%`}
                      {" · Twin: "}
                      {c.twin_id.slice(0, 8)}…
                      {c.is_active ? " · Ativo" : " · Inativo"}
                    </p>
                    <p className="mt-1 break-all text-xs text-twin-muted">{c.webhook_url}</p>
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void toggleActive(c)}
                        className="rounded border border-twin-cyan/30 px-2 py-1 text-xs"
                      >
                        {c.is_active ? "Desativar" : "Ativar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(c)}
                        className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-300"
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </div>
                {canManage && (
                  <div className="flex flex-wrap items-end gap-4 border-t border-twin-cyan/10 pt-4">
                    <label className="text-sm">
                      <span className="text-twin-muted">Modo</span>
                      <select
                        value={mode}
                        onChange={(e) =>
                          setEditingMode((prev) => ({
                            ...prev,
                            [c.id]: e.target.value as ChannelReplyMode,
                          }))
                        }
                        className="mt-1 block rounded border border-twin-cyan/20 bg-black/40 px-3 py-2 text-sm"
                      >
                        {REPLY_MODES.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {mode === "auto" && (
                      <label className="min-w-[200px] flex-1 text-sm">
                        <span className="text-twin-muted">
                          Limiar: {Math.round(threshold * 100)}%
                        </span>
                        <input
                          type="range"
                          min={0.5}
                          max={0.95}
                          step={0.05}
                          value={threshold}
                          onChange={(e) =>
                            setEditingThreshold((prev) => ({
                              ...prev,
                              [c.id]: Number(e.target.value),
                            }))
                          }
                          className="mt-1 w-full accent-twin-cyan"
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={() => void saveChannelSettings(c)}
                      className="rounded-lg border border-twin-cyan/40 px-3 py-2 text-sm text-twin-cyan hover:bg-twin-cyan/10"
                    >
                      Salvar modo
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      <form onSubmit={handleConnect} className="glass space-y-5 p-6">
        <h2 className="font-semibold">Wizard — conectar novo canal</h2>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-twin-muted">
            Passo 1 — Twin do melhor vendedor
          </p>
          <TwinSelect value={twinId} onChange={setTwinId} className="max-w-md" />
          <p className="text-xs text-twin-muted">
            O canal responde com o DNA/RAG deste twin.{" "}
            <Link href="/twins" className="text-twin-cyan hover:underline">
              Gerenciar twins
            </Link>
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-twin-muted">
            Passo 2 — Canal e modo de resposta
          </p>
          <div className="flex flex-wrap gap-4">
            <select
              value={channel}
              onChange={(e) => {
                const next = e.target.value;
                setChannel(next);
                setForm({});
                if (next === "whatsapp" || next === "telegram") {
                  setReplyMode("auto");
                }
                setWizardStep(2);
              }}
              className="rounded border border-twin-cyan/20 bg-black/40 px-3 py-2 text-sm"
            >
              <option value="whatsapp">WhatsApp Business API</option>
              <option value="telegram">Telegram Bot</option>
              <option value="slack">Slack</option>
              <option value="discord">Discord</option>
            </select>
            <select
              value={replyMode}
              onChange={(e) => setReplyMode(e.target.value as ChannelReplyMode)}
              className="rounded border border-twin-cyan/20 bg-black/40 px-3 py-2 text-sm"
            >
              {REPLY_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          {replyMode === "auto" && (
            <label className="block max-w-md text-sm">
              <span className="text-twin-muted">
                Limiar de confiança (agente): {Math.round(confidenceThreshold * 100)}%
              </span>
              <input
                type="range"
                min={0.5}
                max={0.95}
                step={0.05}
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                className="mt-1 w-full accent-twin-cyan"
              />
              <p className="mt-1 text-xs text-twin-muted">
                Abaixo do limiar → Inbox (fallback). Comece em 70–75% no piloto.
              </p>
            </label>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-twin-muted">
            Passo 3 — Credenciais
          </p>
          {channel === "whatsapp" && (
            <p className="rounded border border-twin-cyan/15 bg-black/30 px-3 py-2 text-xs text-twin-muted">
              Meta for Developers → app Business → WhatsApp → Phone Number ID, token
              permanente, App Secret. Verify Token = string sua (gere abaixo).
            </p>
          )}
          {channel === "telegram" && (
            <div className="space-y-2 rounded border border-twin-cyan/15 bg-black/30 px-3 py-2 text-xs text-twin-muted">
              <p>
                1. Crie o bot no @BotFather e copie o token.
                <br />
                2. Gere um secret_token (botão abaixo) e grave no Twin.
                <br />
                3. Após conectar, registre o webhook:
              </p>
              <pre className="overflow-x-auto rounded bg-black/50 p-2 text-[11px] text-twin-cyan">
{`curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook" \\
  -d "url={WEBHOOK_URL}" \\
  -d "secret_token={SECRET_TOKEN}"`}
              </pre>
            </div>
          )}
          {CHANNEL_FORMS[channel]?.map((field) => (
            <div key={field.key}>
              <label className="text-xs text-twin-muted">{field.label}</label>
              <div className="mt-1 flex max-w-lg flex-wrap gap-2">
                <input
                  type={field.type ?? "text"}
                  required={field.required === true}
                  className="w-full flex-1 rounded border border-twin-cyan/20 bg-black/40 px-3 py-2 text-sm"
                  value={form[field.key] ?? ""}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, [field.key]: e.target.value }));
                    setWizardStep(3);
                  }}
                  placeholder={field.placeholder}
                  disabled={!canManage}
                />
                {field.key === "verify_token" && canManage && (
                  <button
                    type="button"
                    className="rounded border border-twin-cyan/40 px-2 py-1 text-xs text-twin-cyan"
                    onClick={() =>
                      setForm((f) => ({ ...f, verify_token: randomSecret(16) }))
                    }
                  >
                    Gerar
                  </button>
                )}
                {field.key === "secret_token" && canManage && (
                  <button
                    type="button"
                    className="rounded border border-twin-cyan/40 px-2 py-1 text-xs text-twin-cyan"
                    onClick={() =>
                      setForm((f) => ({ ...f, secret_token: randomSecret(24) }))
                    }
                  >
                    Gerar
                  </button>
                )}
              </div>
              {field.hint && (
                <p className="mt-1 max-w-lg text-xs text-twin-muted">{field.hint}</p>
              )}
            </div>
          ))}
        </div>

        <div className="rounded border border-twin-magenta/20 bg-black/20 px-3 py-3 text-xs text-twin-muted">
          <p className="font-medium text-twin-magenta">Passo 4 — Após salvar</p>
          <ol className="mt-1 list-decimal space-y-1 pl-4">
            <li>Copie a URL do webhook exibida e configure na Meta / setWebhook.</li>
            <li>
              Garanta <code className="text-twin-cyan">AI_ENGINE_SECRET</code> igual na API
              e no AI Engine.
            </li>
            <li>
              Rode o worker:{" "}
              <code className="text-twin-cyan">
                php artisan queue:work redis --queue=default,channel
              </code>
            </li>
            <li>Envie uma mensagem de texto de teste ao número/bot.</li>
          </ol>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {msg && <p className="text-sm text-green-300 break-all">{msg}</p>}
        <button
          type="submit"
          disabled={loading || !twinId || !canManage}
          className="rounded-lg bg-twin-cyan px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {loading ? "Conectando…" : "Conectar canal"}
        </button>
      </form>

      <div className="glass space-y-3 p-5">
        <h2 className="font-semibold">WhatsApp Web (só copiloto)</h2>
        <p className="text-sm text-twin-muted">
          Conta pessoal não envia sozinha. Use a extensão em{" "}
          <code className="text-twin-cyan">apps/browser-extension</code> — o Twin sugere;
          você cola/envia. Detalhes em{" "}
          <code className="text-twin-cyan">docs/product/whatsapp-copilot.md</code>.
        </p>
        <Link
          href="/import"
          className="inline-block text-sm text-twin-cyan hover:underline"
        >
          Ainda não clonou o vendedor? Importar conversas →
        </Link>
      </div>
    </div>
  );
}
