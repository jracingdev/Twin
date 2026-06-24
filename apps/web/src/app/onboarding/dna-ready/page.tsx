"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { twinApi } from "@/lib/api";

const SAMPLE_PROMPTS = [
  "Olá, quanto custa o serviço?",
  "Vocês entregam amanhã?",
  "Preciso de um orçamento urgente.",
];

export default function DnaReadyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const twinId = searchParams.get("twin") ?? "";
  const { organization } = useAuth();
  const [stats, setStats] = useState<{ dna_version: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePrompt, setActivePrompt] = useState(0);
  const [result, setResult] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!twinId || !organization?.id) {
      setLoading(false);
      return;
    }
    twinApi
      .stats(twinId)
      .then((s) => {
        if (s.dna_version === "0.0.0") {
          router.replace("/import");
          return;
        }
        setStats({ dna_version: s.dna_version, name: s.name });
      })
      .catch(() => router.replace("/dashboard"))
      .finally(() => setLoading(false));
  }, [twinId, organization?.id, router]);

  async function trySample() {
    if (!twinId) return;
    setGenerating(true);
    setResult("");
    try {
      const data = await twinApi.suggest(
        { twin_id: twinId, text: SAMPLE_PROMPTS[activePrompt] },
        organization?.id
      );
      setResult(data.suggested_text || data.suggestion || "");
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Erro ao gerar");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <p className="text-twin-muted">Carregando DNA…</p>;
  }

  if (!stats) {
    return (
      <p className="text-twin-muted">
        Selecione um twin em{" "}
        <Link href="/twins" className="text-twin-cyan hover:underline">
          Twins
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold neon-text">DNA pronto!</h1>
        <p className="mt-2 text-twin-muted">
          O twin <strong className="text-white">{stats.name}</strong> está treinado (v
          {stats.dna_version}). Teste com mensagens típicas do dia a dia.
        </p>
      </div>

      <div className="glass space-y-4 p-6">
        <h2 className="font-semibold">Experimente agora</h2>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_PROMPTS.map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => setActivePrompt(i)}
              className={`rounded-full border px-3 py-1 text-xs ${
                activePrompt === i
                  ? "border-twin-cyan bg-twin-cyan/10 text-twin-cyan"
                  : "border-twin-cyan/20 text-twin-muted"
              }`}
            >
              {p.slice(0, 28)}…
            </button>
          ))}
        </div>
        <p className="rounded bg-black/30 p-3 text-sm">{SAMPLE_PROMPTS[activePrompt]}</p>
        <button
          type="button"
          onClick={() => void trySample()}
          disabled={generating}
          className="rounded-lg bg-gradient-to-r from-twin-cyan to-twin-magenta px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {generating ? "Gerando…" : "Gerar resposta no meu estilo"}
        </button>
        {result && (
          <div className="rounded border border-twin-magenta/30 bg-black/30 p-4 text-sm">
            <p className="text-xs text-twin-muted">Sugestão TWIN</p>
            <p className="mt-2">{result}</p>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href={`/playground?twin=${twinId}`}
          className="glass block p-4 text-center text-sm hover:border-twin-cyan/40"
        >
          Playground completo
        </Link>
        <Link
          href={`/conversations`}
          className="glass block p-4 text-center text-sm hover:border-twin-cyan/40"
        >
          Conversas importadas
        </Link>
        <Link
          href="/inbox"
          className="glass block p-4 text-center text-sm hover:border-twin-cyan/40"
        >
          Caixa de entrada
        </Link>
      </div>

      <div className="text-center">
        <Link href="/dashboard" className="text-sm text-twin-cyan hover:underline">
          Ir para o painel →
        </Link>
      </div>
    </div>
  );
}
