"use client";

import { useEffect, useState } from "react";
import { TwinSelect } from "@/components/TwinSelect";
import { twinApi, type ChannelMetrics } from "@/lib/api";

export default function MetricsPage() {
  const [twinId, setTwinId] = useState("");
  const [metrics, setMetrics] = useState<ChannelMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!twinId) {
      setMetrics(null);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    twinApi
      .channelMetrics(twinId)
      .then(setMetrics)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar"))
      .finally(() => setLoading(false));
  }, [twinId]);

  const cards = [
    {
      label: "Pendentes",
      value: metrics?.pending ?? "—",
      hint: "Sugestões aguardando revisão",
      accent: "text-twin-cyan",
    },
    {
      label: "Enviadas hoje",
      value: metrics?.sent_today ?? "—",
      hint: "Respostas enviadas nas últimas 24h",
      accent: "text-twin-magenta",
    },
    {
      label: "Taxa aceite 7d",
      value:
        metrics?.accept_rate_7d != null ? `${metrics.accept_rate_7d}%` : "—",
      hint: "Aceites + envios nos últimos 7 dias",
      accent: "text-green-300",
    },
    {
      label: "Tempo médio",
      value:
        metrics?.avg_response_time_minutes != null
          ? `${metrics.avg_response_time_minutes} min`
          : "—",
      hint: "Da sugestão ao envio (canal)",
      accent: "text-amber-300",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold neon-text">Métricas de canal</h1>
          <p className="mt-1 text-sm text-twin-muted">
            Acompanhe volume, aceite e tempo de resposta do atendimento assistido.
          </p>
        </div>
        <TwinSelect value={twinId} onChange={setTwinId} className="max-w-xs" />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading && twinId && <p className="text-twin-muted">Carregando métricas…</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="glass p-6 shadow-glow">
            <p className="text-sm text-twin-muted">{c.label}</p>
            <p className={`mt-2 text-4xl font-bold ${c.accent}`}>{c.value}</p>
            <p className="mt-2 text-xs text-twin-muted">{c.hint}</p>
          </div>
        ))}
      </div>

      {!loading && metrics && (
        <div className="glass p-6 text-sm text-twin-muted">
          <p>
            Twin selecionado.
            Dados baseados em sugestões de canal e inbox.
          </p>
        </div>
      )}
    </div>
  );
}
