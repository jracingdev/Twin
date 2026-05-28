"use client";

import { useCallback, useEffect, useState } from "react";
import { TwinSelect } from "@/components/TwinSelect";
import { twinApi, type ConversationDetail, type ConversationSummary } from "@/lib/api";

export default function ConversationsPage() {
  const [twinId, setTwinId] = useState("");
  const [list, setList] = useState<ConversationSummary[]>([]);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!twinId) return;
    setLoading(true);
    setError("");
    try {
      const res = await twinApi.listConversations(twinId);
      setList((res as { data: ConversationSummary[] }).data ?? []);
      setDetail(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [twinId]);

  useEffect(() => {
    load();
  }, [load]);

  async function openConversation(id: string) {
    try {
      setDetail(await twinApi.getConversation(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold neon-text">Conversas importadas</h1>
      <TwinSelect value={twinId} onChange={setTwinId} className="max-w-md" />
      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading && <p className="text-twin-muted">Carregando…</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <ul className="glass max-h-[60vh] space-y-2 overflow-y-auto p-4">
          {list.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => openConversation(c.id)}
                className="w-full rounded border border-twin-cyan/10 px-3 py-2 text-left text-sm hover:border-twin-cyan/40"
              >
                <strong>{c.contact?.display_name ?? "Contato"}</strong>
                <span className="ml-2 text-xs text-twin-muted">{c.channel}</span>
              </button>
            </li>
          ))}
          {!loading && twinId && list.length === 0 && (
            <p className="text-sm text-twin-muted">Nenhuma conversa. Importe mensagens primeiro.</p>
          )}
        </ul>
        <div className="glass max-h-[60vh] overflow-y-auto p-4">
          {detail ? (
            <div className="space-y-3">
              <h2 className="font-semibold">{detail.conversation.contact?.display_name}</h2>
              {detail.messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded px-3 py-2 text-sm ${
                    m.role === "user" ? "bg-twin-cyan/10" : "bg-black/40"
                  }`}
                >
                  <span className="text-xs text-twin-muted">{m.role}</span>
                  <p>{m.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-twin-muted">Selecione uma conversa.</p>
          )}
        </div>
      </div>
    </div>
  );
}
