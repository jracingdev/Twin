"use client";

import { useEffect, useState } from "react";
import type { ScoreBreakdown, SuggestionExplain } from "@/lib/api";
import { twinApi } from "@/lib/api";
import { SimilarityBreakdown } from "@/components/SimilarityBreakdown";

const INTENSITY_LABELS = ["Leve", "Moderado", "Avançado", "Ultra"] as const;

const BREAKDOWN_HINTS: Record<string, string> = {
  formalidade: "Quão alinhada está a formalidade com o seu estilo habitual.",
  tom_emocional: "Proximidade do tom emocional às suas mensagens de referência.",
  vocabulario: "Uso de vocabulário e expressões típicas do seu perfil.",
  persuasao: "Aderência às técnicas comerciais do seu DNA.",
  estilo: "Imitação geral do estilo de escrita nas mensagens indexadas.",
  contexto: "Relevância do contexto recuperado (RAG) para a mensagem.",
  playbook: "Influência de playbooks comerciais no modo vendedor.",
  geral: "Score agregado de similaridade com o corpus de treino.",
};

type Props = {
  suggestionId?: string;
  intensity?: number;
  sellerMode?: boolean;
  score?: number | null;
  scoreBreakdown?: ScoreBreakdown | null;
  className?: string;
};

export function TwinCoachPanel({
  suggestionId,
  intensity = 2,
  sellerMode = false,
  score,
  scoreBreakdown,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [explain, setExplain] = useState<SuggestionExplain | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState("");

  useEffect(() => {
    if (!open || !suggestionId) return;
    setExplainLoading(true);
    setExplainError("");
    twinApi
      .explainSuggestion(suggestionId)
      .then(setExplain)
      .catch((e) =>
        setExplainError(e instanceof Error ? e.message : "Erro ao explicar sugestão")
      )
      .finally(() => setExplainLoading(false));
  }, [open, suggestionId]);

  const intensityLabel =
    INTENSITY_LABELS[Math.min(Math.max(intensity, 1), 4) - 1] ?? "Moderado";

  const resolvedBreakdown =
    explain?.factors?.length && !scoreBreakdown
      ? Object.fromEntries(
          explain.factors.map((f) => [f.key, f.value <= 1 ? f.value * 100 : f.value])
        )
      : scoreBreakdown;

  const hasBreakdown =
    resolvedBreakdown &&
    Object.values(resolvedBreakdown).some((v) => typeof v === "number");

  const resolvedScore = explain?.score ?? score;
  const scorePct =
    resolvedScore != null
      ? resolvedScore <= 1
        ? Math.round(resolvedScore * 100)
        : Math.round(resolvedScore)
      : null;

  return (
    <div className={`rounded-lg border border-twin-cyan/20 bg-black/20 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-twin-cyan hover:bg-twin-cyan/5"
      >
        <span>Por que esta resposta?</span>
        <span className="text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-twin-cyan/10 px-4 py-4 text-sm">
          {explainLoading && (
            <p className="text-xs text-twin-muted">Carregando explicação do coach…</p>
          )}
          {explainError && <p className="text-xs text-red-400">{explainError}</p>}
          {explain?.summary && (
            <p className="rounded border border-twin-cyan/10 bg-black/30 p-3 text-xs text-twin-muted">
              {explain.summary}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded border border-twin-cyan/10 bg-black/30 p-3">
              <p className="text-xs text-twin-muted">Intensidade</p>
              <p className="font-medium">{intensityLabel}</p>
              <p className="mt-1 text-xs text-twin-muted">
                {intensity <= 1 &&
                  "Resposta mais neutra, com menos imitação do estilo pessoal."}
                {intensity === 2 &&
                  "Equilíbrio entre clareza e fidelidade ao seu tom habitual."}
                {intensity === 3 &&
                  "Maior aderência a gírias, saudações e padrões do DNA."}
                {intensity >= 4 &&
                  "Máxima imitação do estilo — use com contexto rico importado."}
              </p>
            </div>
            <div className="rounded border border-twin-cyan/10 bg-black/30 p-3">
              <p className="text-xs text-twin-muted">Modo vendedor</p>
              <p className="font-medium">{sellerMode ? "Ativo" : "Desativado"}</p>
              <p className="mt-1 text-xs text-twin-muted">
                {sellerMode
                  ? "Playbooks comerciais e templates de vendas influenciaram a sugestão."
                  : "Resposta baseada no estilo pessoal, sem templates comerciais."}
              </p>
            </div>
          </div>

          {scorePct != null && (
            <div className="rounded border border-twin-magenta/20 bg-black/30 p-3">
              <p className="text-xs text-twin-muted">Confiança da sugestão</p>
              <p className="text-2xl font-bold text-twin-magenta">{scorePct}%</p>
            </div>
          )}

          {explain?.factors && explain.factors.length > 0 && (
            <ul className="space-y-2 text-xs">
              {explain.factors.map((f) => (
                <li
                  key={f.key}
                  className="rounded border border-twin-cyan/10 bg-black/20 px-3 py-2"
                >
                  <span className="font-medium text-twin-cyan">{f.label}</span>
                  <span className="ml-2 text-twin-muted">
                    {f.value <= 1 ? `${Math.round(f.value * 100)}%` : f.value}
                  </span>
                  {f.explanation && (
                    <p className="mt-1 text-twin-muted">{f.explanation}</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {hasBreakdown && (
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-twin-muted">
                Decomposição do score
              </p>
              <SimilarityBreakdown baseline={resolvedBreakdown!} />
              <ul className="mt-3 space-y-1 text-xs text-twin-muted">
                {Object.entries(resolvedBreakdown!)
                  .filter(([, v]) => typeof v === "number")
                  .map(([key]) => (
                    <li key={key}>
                      <span className="text-twin-cyan/80">
                        {BREAKDOWN_HINTS[key] ? `${key}: ` : ""}
                      </span>
                      {BREAKDOWN_HINTS[key] ?? key}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {!hasBreakdown && scorePct == null && !explainLoading && (
            <p className="text-xs text-twin-muted">
              O motor ainda não retornou decomposição detalhada. Ajuste intensidade
              e modo vendedor para comparar sugestões no playground.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
