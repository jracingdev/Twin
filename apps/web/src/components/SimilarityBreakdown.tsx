import type { SimilarityBaseline } from "@/lib/api";

const DIMENSION_LABELS: Record<string, string> = {
  formalidade: "Formalidade",
  tom_emocional: "Tom emocional",
  vocabulario: "Vocabulário",
  persuasao: "Persuasão",
  geral: "Geral",
};

function toPercent(value: number): number {
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

type Props = {
  baseline: SimilarityBaseline;
  className?: string;
};

export function SimilarityBreakdown({ baseline, className = "" }: Props) {
  const entries = Object.entries(baseline).filter(
    ([, v]) => typeof v === "number" && !Number.isNaN(v)
  );

  if (entries.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {entries.map(([key, raw]) => {
        const pct = toPercent(raw as number);
        return (
          <div key={key}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-twin-muted">
                {DIMENSION_LABELS[key] ?? key}
              </span>
              <span className="font-medium text-twin-cyan">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-twin-cyan to-twin-magenta transition-all"
                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
