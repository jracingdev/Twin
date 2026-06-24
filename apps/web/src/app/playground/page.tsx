"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { TwinCoachPanel } from "@/components/TwinCoachPanel";
import { TwinSelect } from "@/components/TwinSelect";
import { useAuth } from "@/contexts/AuthContext";
import { twinApi, type ScoreBreakdown, type SuggestionResponse } from "@/lib/api";

function copyText(text: string) {
  void navigator.clipboard.writeText(text);
}

export default function PlaygroundPage() {
  const searchParams = useSearchParams();
  const { organization, loading: authLoading } = useAuth();
  const twinFromUrl = searchParams.get("twin") ?? "";
  const [twinId, setTwinId] = useState("");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [suggestion, setSuggestion] = useState<SuggestionResponse | null>(null);
  const [intensity, setIntensity] = useState(2);
  const [sellerMode, setSellerMode] = useState(false);
  const [planAllowsSeller, setPlanAllowsSeller] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const orgReady = !authLoading && Boolean(organization?.id);

  useEffect(() => {
    twinApi.getPlan().then((p) => setPlanAllowsSeller(p.seller_mode)).catch(() => {});
  }, []);

  async function handleSuggest() {
    if (!twinId || !input) return;

    if (!organization?.id) {
      setError(
        "Organização ainda não carregada. Aguarde ou escolha uma organização no menu superior."
      );
      return;
    }

    setLoading(true);
    setError("");
    setSuggestion(null);
    setFeedbackMsg("");
    setCopied(false);
    try {
      const data = await twinApi.suggest(
        {
          twin_id: twinId,
          text: input,
          intensity,
          seller_mode: sellerMode,
        },
        organization.id
      );
      setOutput(data.suggested_text || data.suggestion || "");
      setSuggestion(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar sugestão");
      setOutput("");
    } finally {
      setLoading(false);
    }
  }

  async function sendFeedback(status: "accepted" | "rejected") {
    if (!suggestion?.id) return;
    if (!organization?.id) {
      setError("Organização não disponível para enviar feedback.");
      return;
    }
    setFeedbackMsg("");
    setError("");
    try {
      const res = await twinApi.feedback(suggestion.id, status);
      setFeedbackMsg(
        res.status === "accepted"
          ? "Feedback registrado: aceita."
          : "Feedback registrado: rejeitada."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar feedback");
    }
  }

  function handleCopy() {
    copyText(output);
    setCopied(true);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold neon-text">Playground de resposta</h1>
      <div className="glass space-y-4 p-6">
        {!orgReady && (
          <p className="text-sm text-amber-300">
            {authLoading
              ? "Carregando organização…"
              : "Nenhuma organização ativa. Faça login novamente ou selecione uma organização."}
          </p>
        )}
        <label className="block text-sm text-twin-muted">Twin</label>
        <TwinSelect
          value={twinId}
          onChange={setTwinId}
          preferredTwinId={twinFromUrl}
          className="w-full max-w-md"
        />

        <label className="block text-sm text-twin-muted">
          Intensidade: {["Leve", "Moderado", "Avançado", "Ultra"][intensity - 1]}
        </label>
        <input
          type="range"
          min={1}
          max={4}
          value={intensity}
          onChange={(e) => setIntensity(Number(e.target.value))}
          className="w-full accent-twin-cyan"
        />

        {planAllowsSeller && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sellerMode}
              onChange={(e) => setSellerMode(e.target.checked)}
            />
            Modo vendedor (playbooks comerciais)
          </label>
        )}

        <textarea
          className="w-full rounded-lg border border-twin-cyan/20 bg-black/40 p-4 font-mono text-sm"
          rows={4}
          placeholder="Digite a mensagem recebida..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          onClick={handleSuggest}
          disabled={loading || !input || !twinId || !orgReady}
          className="rounded-lg bg-twin-cyan px-4 py-2 font-medium text-black disabled:opacity-50"
        >
          {loading ? "Gerando..." : "Simular resposta"}
        </button>
        {output && (
          <div className="rounded-lg border border-twin-magenta/30 bg-black/30 p-4">
            <p className="mb-2 text-xs text-twin-muted">Sugestão TWIN</p>
            <p>{output}</p>
            {feedbackMsg && (
              <p className="mt-3 text-sm text-green-300">{feedbackMsg}</p>
            )}
            <TwinCoachPanel
              suggestionId={suggestion?.id}
              intensity={suggestion?.intensity ?? intensity}
              sellerMode={suggestion?.seller_mode ?? sellerMode}
              score={suggestion?.score}
              scoreBreakdown={
                suggestion?.score_breakdown ??
                (suggestion?.metadata?.score_breakdown as ScoreBreakdown | undefined) ??
                null
              }
              className="mt-4"
            />
            {suggestion && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded border border-twin-cyan/40 px-3 py-1 text-sm text-twin-cyan"
                >
                  {copied ? "Copiado!" : "Copiar"}
                </button>
                <button
                  type="button"
                  onClick={() => sendFeedback("accepted")}
                  className="rounded border border-green-500/40 px-3 py-1 text-sm text-green-300"
                >
                  Aceitar
                </button>
                <button
                  type="button"
                  onClick={() => sendFeedback("rejected")}
                  className="rounded border border-red-500/40 px-3 py-1 text-sm text-red-300"
                >
                  Rejeitar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
