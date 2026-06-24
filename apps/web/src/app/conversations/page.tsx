"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TwinSelect } from "@/components/TwinSelect";
import { useAuth } from "@/contexts/AuthContext";
import { twinApi, type ConversationDetail, type ConversationSummary } from "@/lib/api";

function copyText(text: string) {
  void navigator.clipboard.writeText(text);
}

export default function ConversationsPage() {
  const { organization } = useAuth();
  const [twinId, setTwinId] = useState("");
  const [list, setList] = useState<ConversationSummary[]>([]);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const [customInput, setCustomInput] = useState("");

  const load = useCallback(async () => {
    if (!twinId) return;
    setLoading(true);
    setError("");
    try {
      const res = await twinApi.listConversations(twinId);
      setList((res as { data: ConversationSummary[] }).data ?? []);
      setDetail(null);
      setSuggestion(null);
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
      const d = await twinApi.getConversation(id);
      setDetail(d);
      setSuggestion(null);
      const lastContact = [...d.messages].reverse().find((m) => m.role === "contact");
      setCustomInput(lastContact?.body ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  async function generateSuggestion(text: string) {
    if (!twinId || !text || !organization?.id || !detail) return;
    setSuggesting(true);
    setError("");
    setSuggestion(null);
    try {
      const data = await twinApi.suggest(
        {
          twin_id: twinId,
          text,
          contact_id: detail.conversation.contact_id,
          conversation_id: detail.conversation.id,
        },
        organization.id
      );
      setSuggestion({
        id: data.id,
        text: data.suggested_text || data.suggestion || "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar sugestão");
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold neon-text">Conversas</h1>
        <Link href="/inbox" className="text-sm text-twin-cyan hover:underline">
          Ver caixa de entrada →
        </Link>
      </div>
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
                <div key={m.id} className="group relative">
                  <div
                    className={`rounded px-3 py-2 text-sm ${
                      m.role === "user"
                        ? "ml-8 bg-twin-cyan/10"
                        : m.role === "contact"
                          ? "mr-8 bg-black/40"
                          : "bg-twin-magenta/10"
                    }`}
                  >
                    <span className="text-xs text-twin-muted">
                      {m.role === "user" ? "Você" : m.role === "contact" ? "Cliente" : m.role}
                    </span>
                    <p>{m.body}</p>
                  </div>
                  {m.role === "contact" && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomInput(m.body);
                        void generateSuggestion(m.body);
                      }}
                      className="mt-1 text-xs text-twin-cyan opacity-0 transition group-hover:opacity-100"
                    >
                      Responder com TWIN
                    </button>
                  )}
                </div>
              ))}

              <div className="sticky bottom-0 space-y-2 border-t border-twin-cyan/10 bg-[#0a0e17]/95 pt-4">
                <label className="text-xs text-twin-muted">Mensagem do cliente</label>
                <textarea
                  className="w-full rounded border border-twin-cyan/20 bg-black/40 p-2 text-sm"
                  rows={2}
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Cole ou digite a mensagem recebida…"
                />
                <button
                  type="button"
                  onClick={() => void generateSuggestion(customInput)}
                  disabled={suggesting || !customInput}
                  className="rounded bg-twin-cyan px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
                >
                  {suggesting ? "Gerando…" : "Gerar resposta"}
                </button>
                {suggestion && (
                  <div className="rounded border border-twin-magenta/30 bg-black/30 p-3 text-sm">
                    <p className="text-xs text-twin-muted">Sugestão</p>
                    <p className="mt-1">{suggestion.text}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => copyText(suggestion.text)}
                        className="rounded border border-twin-cyan/30 px-2 py-1 text-xs"
                      >
                        Copiar
                      </button>
                      <button
                        type="button"
                        onClick={() => twinApi.feedback(suggestion.id, "accepted")}
                        className="rounded border border-green-500/40 px-2 py-1 text-xs text-green-300"
                      >
                        Aceitar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-twin-muted">Selecione uma conversa.</p>
          )}
        </div>
      </div>
    </div>
  );
}
