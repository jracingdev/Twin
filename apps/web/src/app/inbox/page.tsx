"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TwinCoachPanel } from "@/components/TwinCoachPanel";
import { TwinSelect } from "@/components/TwinSelect";
import { useAuth } from "@/contexts/AuthContext";
import { twinApi, type InboxSuggestion, type ScoreBreakdown } from "@/lib/api";

function copyText(text: string) {
  void navigator.clipboard.writeText(text);
}

export default function InboxPage() {
  const { organization } = useAuth();
  const [twinId, setTwinId] = useState("");
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState<InboxSuggestion[]>([]);
  const [metrics, setMetrics] = useState<{
    pending: number;
    accept_rate: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    setError("");
    try {
      const [list, m] = await Promise.all([
        twinApi.listSuggestions({ twin_id: twinId || undefined, status }),
        twinApi.suggestionMetrics(twinId || undefined),
      ]);
      setItems(list.data ?? []);
      setMetrics({ pending: m.pending, accept_rate: m.accept_rate });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [organization?.id, twinId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSend(item: InboxSuggestion) {
    const text = editing[item.id] ?? item.suggested_text;
    try {
      await twinApi.sendSuggestion(item.id, text);
      setMsg("Resposta enviada / registrada.");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar");
    }
  }

  async function handleFeedback(item: InboxSuggestion, st: "accepted" | "rejected") {
    const text = editing[item.id] ?? item.suggested_text;
    try {
      await twinApi.feedback(item.id, st, text !== item.suggested_text ? text : undefined);
      setMsg(st === "accepted" ? "Sugestão aceita." : "Sugestão rejeitada.");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold neon-text">Caixa de entrada</h1>
          <p className="mt-1 text-sm text-twin-muted">
            Revise sugestões antes de enviar — ideal para atendimento comercial.
          </p>
        </div>
        {metrics && (
          <div className="glass flex gap-4 px-4 py-2 text-sm">
            <span>
              Pendentes: <strong className="text-twin-cyan">{metrics.pending}</strong>
            </span>
            {metrics.accept_rate != null && (
              <span>
                Aceite: <strong className="text-green-300">{metrics.accept_rate}%</strong>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        <TwinSelect value={twinId} onChange={setTwinId} className="max-w-xs" />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-twin-cyan/20 bg-black/40 px-3 py-2 text-sm"
        >
          <option value="pending">Pendentes</option>
          <option value="sent">Enviadas</option>
          <option value="accepted">Aceitas</option>
          <option value="rejected">Rejeitadas</option>
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-twin-cyan/30 px-3 py-2 text-sm hover:border-twin-cyan"
        >
          Atualizar
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {msg && <p className="text-sm text-green-300">{msg}</p>}
      {loading && <p className="text-twin-muted">Carregando…</p>}

      <ul className="space-y-4">
        {items.map((item) => {
          const fromChannel = item.metadata?.source === "channel_webhook";
          const channel = item.metadata?.channel as string | undefined;
          return (
            <li key={item.id} className="glass space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-twin-muted">
                <span>
                  {item.contact?.display_name ?? "Cliente"}
                  {fromChannel && channel && (
                    <span className="ml-2 rounded bg-twin-magenta/20 px-2 py-0.5 text-twin-magenta">
                      {channel}
                    </span>
                  )}
                </span>
                <span>{new Date(item.created_at).toLocaleString("pt-BR")}</span>
              </div>
              <div className="rounded bg-black/30 p-3 text-sm">
                <p className="text-xs text-twin-muted">Mensagem recebida</p>
                <p className="mt-1">{item.input_text}</p>
              </div>
              <textarea
                className="w-full rounded border border-twin-cyan/20 bg-black/40 p-3 text-sm"
                rows={3}
                value={editing[item.id] ?? item.suggested_text}
                onChange={(e) =>
                  setEditing((prev) => ({ ...prev, [item.id]: e.target.value }))
                }
              />
              <TwinCoachPanel
                suggestionId={item.id}
                intensity={item.intensity}
                sellerMode={Boolean(item.metadata?.seller_mode)}
                score={item.score}
                scoreBreakdown={
                  (item.metadata?.score_breakdown as ScoreBreakdown | undefined) ??
                  null
                }
                className="mt-2"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyText(editing[item.id] ?? item.suggested_text)}
                  className="rounded border border-twin-cyan/30 px-3 py-1 text-sm"
                >
                  Copiar
                </button>
                {item.status === "pending" && fromChannel && (
                  <button
                    type="button"
                    onClick={() => void handleSend(item)}
                    className="rounded bg-twin-cyan px-3 py-1 text-sm font-medium text-black"
                  >
                    Aprovar e enviar
                  </button>
                )}
                {item.status === "pending" && !fromChannel && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleFeedback(item, "accepted")}
                      className="rounded border border-green-500/40 px-3 py-1 text-sm text-green-300"
                    >
                      Aceitar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleFeedback(item, "rejected")}
                      className="rounded border border-red-500/40 px-3 py-1 text-sm text-red-300"
                    >
                      Rejeitar
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
        {!loading && items.length === 0 && (
          <li className="glass p-6 text-sm text-twin-muted">
            Nenhuma sugestão neste filtro.{" "}
            <Link href="/conversations" className="text-twin-cyan hover:underline">
              Gere sugestões nas conversas
            </Link>{" "}
            ou conecte um canal em{" "}
            <Link href="/settings/channels" className="text-twin-cyan hover:underline">
              Configurações
            </Link>
            .
          </li>
        )}
      </ul>
    </div>
  );
}
