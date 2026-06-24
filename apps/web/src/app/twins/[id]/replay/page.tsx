"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SimilarityBreakdown } from "@/components/SimilarityBreakdown";
import {
  twinApi,
  type ScoreBreakdown,
  type TwinDetail,
  type TwinReplayResponse,
} from "@/lib/api";

export default function TwinReplayPage() {
  const params = useParams();
  const twinId = typeof params.id === "string" ? params.id : "";

  const [twin, setTwin] = useState<TwinDetail | null>(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<TwinReplayResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!twinId) return;
    twinApi.getTwin(twinId).then(setTwin).catch(() => {});
  }, [twinId]);

  async function handleReplay() {
    if (!twinId || !input.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await twinApi.twinReplay(twinId, {
        text: input,
        intensity: twin?.intensity,
        seller_mode: twin?.seller_mode,
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao simular replay");
    } finally {
      setLoading(false);
    }
  }

  const output = result?.suggested_text || result?.suggestion || "";
  const breakdown: ScoreBreakdown | null =
    result?.score_breakdown ??
    result?.similarity_baseline ??
    (result?.metadata?.score_breakdown as ScoreBreakdown | undefined) ??
    (result?.metadata?.similarity_baseline as ScoreBreakdown | undefined) ??
    null;

  const scorePct =
    result?.score != null
      ? result.score <= 1
        ? Math.round(result.score * 100)
        : Math.round(result.score)
      : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={`/twins/${twinId}`}
          className="text-sm text-twin-cyan hover:underline"
        >
          ← {twin?.name ?? "Twin"}
        </Link>
        <h1 className="text-3xl font-bold neon-text">Twin Replay</h1>
      </div>

      <p className="text-sm text-twin-muted">
        Simule como o twin responderia a uma mensagem usando o corpus indexado e
        memória de trabalho — sem gravar sugestão no inbox.
      </p>

      <div className="glass space-y-4 p-6">
        <textarea
          className="w-full rounded-lg border border-twin-cyan/20 bg-black/40 p-4 font-mono text-sm"
          rows={4}
          placeholder="Digite a mensagem recebida para simular…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="button"
          onClick={handleReplay}
          disabled={loading || !input.trim()}
          className="rounded-lg bg-twin-cyan px-4 py-2 font-medium text-black disabled:opacity-50"
        >
          {loading ? "Simulando…" : "Simular"}
        </button>

        {output && (
          <div className="rounded-lg border border-twin-magenta/30 bg-black/30 p-4">
            <p className="mb-2 text-xs text-twin-muted">Sugestão simulada</p>
            <p>{output}</p>
            {scorePct != null && (
              <p className="mt-3 text-sm text-twin-magenta">
                Similaridade: <strong>{scorePct}%</strong>
              </p>
            )}
            {breakdown && Object.keys(breakdown).length > 0 && (
              <div className="mt-4 border-t border-twin-cyan/10 pt-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-twin-muted">
                  Decomposição de similaridade
                </p>
                <SimilarityBreakdown baseline={breakdown} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
