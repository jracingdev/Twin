"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { twinApi, type DnaEvolution, type DnaEvolutionPoint } from "@/lib/api";


export default function TwinEvolutionPage() {
  const params = useParams();
  const twinId = typeof params.id === "string" ? params.id : "";

  const [data, setData] = useState<DnaEvolution | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!twinId) return;
    setLoading(true);
    setError("");
    try {
      const evo = await twinApi.dnaEvolution(twinId);
      setData(evo);
      setSelectedIdx(evo.versions.length > 0 ? evo.versions.length - 1 : -1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar evolução");
    } finally {
      setLoading(false);
    }
  }, [twinId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = selectedIdx >= 0 ? data?.versions[selectedIdx] : null;
  const previous = selectedIdx > 0 ? data?.versions[selectedIdx - 1] : null;

  const overlayRadar = useMemo(() => {
    if (!selected) return [];
    const traits = new Set<string>();
    selected.radar.forEach((p) => traits.add(p.trait));
    previous?.radar.forEach((p) => traits.add(p.trait));
    const currMap = Object.fromEntries(selected.radar.map((p) => [p.trait, p.value]));
    const prevMap = Object.fromEntries((previous?.radar ?? []).map((p) => [p.trait, p.value]));
    return Array.from(traits).map((trait) => ({
      trait,
      atual: currMap[trait] ?? 0,
      anterior: prevMap[trait] ?? currMap[trait] ?? 0,
    }));
  }, [selected, previous]);

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/twins/${twinId}`} className="text-sm text-twin-cyan hover:underline">
          ← Twin
        </Link>
        <h1 className="mt-2 text-3xl font-bold neon-text">Evolução do DNA</h1>
        <p className="mt-2 max-w-2xl text-sm text-twin-muted">
          Compare versões do perfil comportamental e veja como cada traço mudou ao longo
          das importações e extrações.
        </p>
      </div>

      {error && (
        <p className="rounded border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {loading && <p className="text-twin-muted">Carregando evolução…</p>}

      {!loading && data && data.versions.length === 0 && (
        <div className="glass p-6 text-sm text-twin-muted">
          Nenhuma versão de DNA registrada.{" "}
          <Link href={`/import?twin=${twinId}`} className="text-twin-cyan hover:underline">
            Importe conversas
          </Link>{" "}
          e extraia o DNA para ver a evolução.
        </div>
      )}

      {data && data.versions.length > 0 && (
        <>
          <section className="glass p-6">
            <h2 className="mb-4 text-xl font-semibold">Versões</h2>
            <div className="flex flex-wrap gap-2">
              {data.versions.map((v, idx) => (
                <button
                  key={`${v.version}-${idx}`}
                  type="button"
                  onClick={() => setSelectedIdx(idx)}
                  className={`rounded-lg border px-3 py-2 text-sm transition ${
                    selectedIdx === idx
                      ? "border-twin-cyan bg-twin-cyan/10 text-twin-cyan"
                      : "border-twin-cyan/20 hover:border-twin-cyan/40"
                  }`}
                >
                  v{v.version}
                  {v.created_at && (
                    <span className="ml-2 text-xs text-twin-muted">
                      {new Date(v.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>

          {selected && (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="glass p-6">
                  <h2 className="mb-4 text-xl font-semibold">
                    Radar — v{selected.version}
                    {previous && (
                      <span className="ml-2 text-sm font-normal text-twin-muted">
                        vs v{previous.version}
                      </span>
                    )}
                  </h2>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={overlayRadar}>
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis
                          dataKey="trait"
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                        />
                        {previous && (
                          <Radar
                            name="Anterior"
                            dataKey="anterior"
                            stroke="#e879f9"
                            fill="#e879f9"
                            fillOpacity={0.2}
                          />
                        )}
                        <Radar
                          name="Atual"
                          dataKey="atual"
                          stroke="#22d3ee"
                          fill="#22d3ee"
                          fillOpacity={0.35}
                        />
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <DeltaPanel point={selected} />
              </div>

              {selected.change_summary && (
                <div className="glass p-6">
                  <h2 className="mb-2 text-lg font-semibold">Resumo da mudança</h2>
                  <p className="text-sm text-twin-muted">{selected.change_summary}</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function DeltaPanel({ point }: { point: DnaEvolutionPoint }) {
  if (point.deltas.length === 0) {
    return (
      <div className="glass flex items-center justify-center p-6 text-sm text-twin-muted">
        Primeira versão — sem deltas anteriores.
      </div>
    );
  }

  return (
    <div className="glass p-6">
      <h2 className="mb-4 text-xl font-semibold">Deltas de traços</h2>
      <ul className="space-y-3">
        {point.deltas.map((d) => {
          const up = d.delta > 0;
          const flat = d.delta === 0;
          return (
            <li
              key={d.trait}
              className="flex items-center justify-between rounded border border-twin-cyan/10 px-3 py-2 text-sm"
            >
              <span>{d.trait}</span>
              <span className="text-twin-muted">
                {d.from} → {d.to}
              </span>
              <span
                className={
                  flat
                    ? "text-twin-muted"
                    : up
                      ? "text-green-300"
                      : "text-red-300"
                }
              >
                {flat ? "—" : `${up ? "+" : ""}${d.delta}`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
