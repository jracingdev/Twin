"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { TwinSelect } from "@/components/TwinSelect";
import { useAuth } from "@/contexts/AuthContext";
import { IMPORT_CHANNELS } from "@/lib/import-channels";
import {
  twinApi,
  type ChannelCredential,
  type ChannelReplyMode,
} from "@/lib/api";

const CHANNEL_FORMS: Record<
  string,
  { key: string; label: string; type?: string; placeholder?: string }[]
> = {
  whatsapp: [
    { key: "phone_number_id", label: "Phone Number ID" },
    { key: "access_token", label: "Access Token", type: "password" },
    { key: "verify_token", label: "Verify Token" },
    { key: "app_secret", label: "App Secret", type: "password" },
  ],
  telegram: [{ key: "bot_token", label: "Bot Token", type: "password" }],
  slack: [
    { key: "bot_token", label: "Bot Token", type: "password" },
    { key: "signing_secret", label: "Signing Secret", type: "password" },
  ],
  discord: [
    { key: "bot_token", label: "Bot Token", type: "password" },
    { key: "public_key", label: "Public Key" },
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
    description:
      "Só gera sugestões internas — sem envio ao canal (sem botão de aprovar/enviar).",
  },
  {
    value: "copilot",
    label: "Copiloto (aprovação)",
    description:
      "Sugestões vão para a inbox com aprovação obrigatória antes de enviar no canal.",
  },
  {
    value: "auto",
    label: "Agente (autônomo)",
    description:
      "O vendedor clonado responde sozinho no WhatsApp quando a confiança atinge o limiar.",
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

export default function SettingsChannelsPage() {
  const { organization } = useAuth();
  const [credentials, setCredentials] = useState<ChannelCredential[]>([]);
  const [twinId, setTwinId] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [replyMode, setReplyMode] = useState<ChannelReplyMode>("copilot");
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.75);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [editingMode, setEditingMode] = useState<Record<string, ChannelReplyMode>>({});
  const [editingThreshold, setEditingThreshold] = useState<Record<string, number>>({});

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
    if (!twinId) return;
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const created = await twinApi.createChannelCredential({
        twin_id: twinId,
        channel,
        credentials: form,
        reply_mode: replyMode,
        ...(replyMode === "auto"
          ? { confidence_threshold: confidenceThreshold }
          : {}),
      });
      setMsg(
        `Canal ${created.channel} conectado. Webhook (copie agora): ${created.webhook_url}`
      );
      setForm({});
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conectar");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(c: ChannelCredential) {
    await twinApi.updateChannelCredential(c.id, { is_active: !c.is_active });
    load();
  }

  async function saveChannelSettings(c: ChannelCredential) {
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
        <h1 className="mt-2 text-3xl font-bold neon-text">Canais de atendimento</h1>
        <p className="mt-2 max-w-2xl text-sm text-twin-muted">
          Conecte o WhatsApp Business API e coloque o twin em modo{" "}
          <strong className="text-white">Agente</strong> para ele atender clientes
          em tempo real com o estilo do vendedor clonado. Use Copiloto se quiser
          aprovar cada resposta na Inbox.
        </p>
      </div>

      <div className="glass space-y-2 border border-twin-cyan/20 p-5">
        <p className="font-medium text-twin-cyan">Como ativar o agente no WhatsApp</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-twin-muted">
          <li>Treine o twin (importe conversas reais do vendedor).</li>
          <li>Conecte WhatsApp Business API abaixo com as credenciais da Meta.</li>
          <li>
            Escolha o modo <strong className="text-white">Agente (autônomo)</strong> e
            ajuste o limiar (padrão 75%).
          </li>
          <li>
            Configure o webhook na Meta e rode o worker com a fila{" "}
            <code className="text-twin-cyan">channel</code>.
          </li>
        </ol>
        <p className="text-xs text-twin-muted">
          Abaixo do limiar, a resposta cai na Inbox em vez de ir ao cliente. A
          extensão do WhatsApp Web continua só como copiloto (sem envio automático).
        </p>
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
                      Modo atual: {modeLabel(c.reply_mode)}
                      {normalizeReplyMode(c.reply_mode) === "auto" &&
                        ` · Limiar ${Math.round((c.confidence_threshold ?? 0.75) * 100)}%`}
                      {" · Twin: "}
                      {c.twin_id.slice(0, 8)}…
                    </p>
                    <p className="mt-1 break-all text-xs text-twin-muted">{c.webhook_url}</p>
                  </div>
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
                </div>
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
                        Limiar de confiança: {Math.round(threshold * 100)}%
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
              </div>
            );
          })}
        </section>
      )}

      <form onSubmit={handleConnect} className="glass space-y-4 p-6">
        <h2 className="font-semibold">Conectar novo canal</h2>
        <TwinSelect value={twinId} onChange={setTwinId} className="max-w-md" />
        <div className="flex flex-wrap gap-4">
          <select
            value={channel}
            onChange={(e) => {
              const next = e.target.value;
              setChannel(next);
              setForm({});
              if (next === "whatsapp" && replyMode === "copilot") {
                setReplyMode("auto");
              }
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
              O agente envia sozinho acima deste score; abaixo, a sugestão vai para a Inbox.
            </p>
          </label>
        )}
        {CHANNEL_FORMS[channel]?.map((field) => (
          <div key={field.key}>
            <label className="text-xs text-twin-muted">{field.label}</label>
            <input
              type={field.type ?? "text"}
              required
              className="mt-1 w-full max-w-lg rounded border border-twin-cyan/20 bg-black/40 px-3 py-2 text-sm"
              value={form[field.key] ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
              placeholder={field.placeholder}
            />
          </div>
        ))}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {msg && <p className="text-sm text-green-300">{msg}</p>}
        <button
          type="submit"
          disabled={loading || !twinId}
          className="rounded-lg bg-twin-cyan px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {loading ? "Conectando…" : "Conectar canal"}
        </button>
      </form>

      <div className="space-y-4">
        <h2 className="font-semibold">Importação para treino (exportações oficiais)</h2>
        {IMPORT_CHANNELS.map((ch) => (
          <section key={ch.id} className="glass p-5">
            <h3 className="font-medium text-twin-cyan">{ch.label}</h3>
            <p className="mt-1 text-sm text-twin-muted">{ch.fileTypes}</p>
          </section>
        ))}
        <Link
          href="/import/channels"
          className="inline-block rounded-lg bg-gradient-to-r from-twin-cyan to-twin-magenta px-4 py-2 text-sm font-medium text-black"
        >
          Importar conversas para treino
        </Link>
      </div>
    </div>
  );
}
