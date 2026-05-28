"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { TrainPanel } from "@/components/TrainPanel";
import { TwinSelect } from "@/components/TwinSelect";
import { twinApi, type TwinStats } from "@/lib/api";

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const twinFromUrl = searchParams.get("twin") ?? "";
  const [twinId, setTwinId] = useState("");
  const [stats, setStats] = useState<TwinStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!twinId) return;
    setLoading(true);
    setError("");
    twinApi
      .stats(twinId)
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar"))
      .finally(() => setLoading(false));
  }, [twinId]);

  const radar = stats?.radar ?? [];
  const intents = stats?.intents ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold neon-text">Painel de Personalidade</h1>
        <TwinSelect
          value={twinId}
          onChange={setTwinId}
          preferredTwinId={twinFromUrl}
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading && twinId && <p className="text-twin-muted">Carregando métricas…</p>}

      {twinId && (
        <div className="glass p-6">
          <h2 className="mb-4 text-xl font-semibold">Treinamento</h2>
          <TrainPanel twinId={twinId} />
        </div>
      )}

      {stats && !loading && (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="glass p-6 shadow-glow">
              <p className="text-sm text-twin-muted">Similaridade humana</p>
              <p className="text-4xl font-bold text-twin-cyan">
                {stats.similarity_score != null
                  ? `${stats.similarity_score}%`
                  : "—"}
              </p>
            </div>
            <div className="glass p-6">
              <p className="text-sm text-twin-muted">Mensagens indexadas</p>
              <p className="text-4xl font-bold">
                {stats.messages_indexed.toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="glass p-6">
              <p className="text-sm text-twin-muted">Versão DNA</p>
              <p className="text-4xl font-bold text-twin-magenta">
                {stats.dna_version}
              </p>
            </div>
          </div>
          <div className="glass p-6">
            <h2 className="mb-4 text-xl font-semibold">Radar comportamental</h2>
            <div className="h-80">
              {radar.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radar}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis
                      dataKey="trait"
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                    />
                    <Radar
                      dataKey="value"
                      stroke="#22d3ee"
                      fill="#22d3ee"
                      fillOpacity={0.35}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-twin-muted">
                  Sem DNA ainda — importe conversas para extrair o perfil.
                </p>
              )}
            </div>
          </div>
          <div className="glass p-6">
            <h2 className="mb-2 text-xl font-semibold">Mapa de intenções</h2>
            <div className="flex flex-wrap gap-2">
              {intents.length > 0 ? (
                intents.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-twin-cyan/30 px-3 py-1 text-sm"
                  >
                    {t}
                  </span>
                ))
              ) : (
                <p className="text-sm text-twin-muted">Nenhuma intenção mapeada.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
