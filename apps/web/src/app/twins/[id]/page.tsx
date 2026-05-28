"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { TrainPanel } from "@/components/TrainPanel";
import { twinApi, type ImportBatch, type TwinDetail, type TwinStats } from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  queued: "Na fila",
  processing: "Processando",
  completed: "Concluído",
  failed: "Falhou",
  pending: "Pendente",
};

export default function TwinDetailPage() {
  const params = useParams();
  const twinId = typeof params.id === "string" ? params.id : "";

  const [twin, setTwin] = useState<TwinDetail | null>(null);
  const [stats, setStats] = useState<TwinStats | null>(null);
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [intensity, setIntensity] = useState(2);
  const [sellerMode, setSellerMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dnaOpen, setDnaOpen] = useState(false);
  const [error, setError] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  const load = useCallback(async () => {
    if (!twinId) return;
    setError("");
    try {
      const [t, st, imp] = await Promise.all([
        twinApi.getTwin(twinId),
        twinApi.stats(twinId),
        twinApi.listImports(twinId),
      ]);
      setTwin(t);
      setStats(st);
      setImports(imp.data ?? []);
      setIntensity(t.intensity);
      setSellerMode(t.seller_mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar twin");
    }
  }, [twinId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveSettings() {
    if (!twinId) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const updated = await twinApi.updateTwin(twinId, {
        intensity,
        seller_mode: sellerMode,
      });
      setTwin((prev) => (prev ? { ...prev, ...updated } : updated));
      setSaveMsg("Configurações salvas.");
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const dnaPayload = twin?.active_dna?.payload;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/twins" className="text-sm text-twin-cyan hover:underline">
          ← Twins
        </Link>
        <h1 className="text-3xl font-bold neon-text">
          {twin?.name ?? "Twin"}
        </h1>
        {twin?.status && (
          <span className="rounded-full border border-twin-cyan/30 px-3 py-0.5 text-xs text-twin-muted">
            {twin.status}
          </span>
        )}
      </div>

      {error && (
        <p className="rounded border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {twin && (
        <>
          <div className="glass space-y-4 p-6">
            <p className="text-sm text-twin-muted">
              {twin.description || "Sem descrição."}
              {twin.vertical ? ` · Vertical: ${twin.vertical}` : ""}
            </p>
            <div className="flex flex-wrap gap-4">
              <label className="text-sm text-twin-muted">
                Intensidade
                <input
                  type="range"
                  min={1}
                  max={4}
                  value={intensity}
                  onChange={(e) => setIntensity(Number(e.target.value))}
                  className="ml-2 w-32 accent-twin-cyan"
                />
                <span className="ml-2 text-twin-cyan">{intensity}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sellerMode}
                  onChange={(e) => setSellerMode(e.target.checked)}
                />
                Modo vendedor
              </label>
              <button
                type="button"
                onClick={saveSettings}
                disabled={saving}
                className="rounded-lg border border-twin-cyan/40 px-4 py-1.5 text-sm text-twin-cyan hover:bg-twin-cyan/10 disabled:opacity-50"
              >
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
            {saveMsg && <p className="text-sm text-twin-cyan">{saveMsg}</p>}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href={`/import?twin=${twinId}`}
                className="rounded-lg bg-gradient-to-r from-twin-cyan to-twin-magenta px-4 py-2 text-sm font-medium text-black"
              >
                Importar conversas
              </Link>
              <Link
                href={`/playground?twin=${twinId}`}
                className="rounded-lg border border-twin-cyan/40 px-4 py-2 text-sm text-twin-cyan hover:bg-twin-cyan/10"
              >
                Playground
              </Link>
              <Link
                href={`/dashboard?twin=${twinId}`}
                className="rounded-lg border border-twin-cyan/30 px-4 py-2 text-sm hover:text-twin-cyan"
              >
                Painel
              </Link>
            </div>
          </div>

          {stats && (
            <div className="grid gap-4 md:grid-cols-4">
              <div className="glass p-4">
                <p className="text-xs text-twin-muted">Mensagens</p>
                <p className="text-2xl font-bold">
                  {stats.messages_indexed.toLocaleString("pt-BR")}
                </p>
              </div>
              <div className="glass p-4">
                <p className="text-xs text-twin-muted">DNA</p>
                <p className="text-2xl font-bold text-twin-magenta">
                  {stats.dna_version}
                </p>
              </div>
              <div className="glass p-4">
                <p className="text-xs text-twin-muted">Similaridade</p>
                <p className="text-2xl font-bold text-twin-cyan">
                  {stats.similarity_score != null
                    ? `${stats.similarity_score}%`
                    : "—"}
                </p>
              </div>
              <div className="glass p-4">
                <p className="text-xs text-twin-muted">Aceite sugestões</p>
                <p className="text-2xl font-bold">
                  {stats.suggestions.accept_rate != null
                    ? `${stats.suggestions.accept_rate}%`
                    : "—"}
                </p>
              </div>
            </div>
          )}

          <div className="glass p-6">
            <h2 className="mb-4 text-xl font-semibold">Treinamento</h2>
            <TrainPanel twinId={twinId} />
          </div>

          <div className="glass p-6">
            <h2 className="mb-4 text-xl font-semibold">Importações recentes</h2>
            {imports.length === 0 ? (
              <p className="text-sm text-twin-muted">
                Nenhuma importação ainda.{" "}
                <Link
                  href={`/import?twin=${twinId}`}
                  className="text-twin-cyan hover:underline"
                >
                  Importar agora
                </Link>
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {imports.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap justify-between gap-2 rounded border border-twin-cyan/10 px-3 py-2"
                  >
                    <span>
                      {b.source} · {b.id.slice(0, 8)}…
                    </span>
                    <span className="text-twin-muted">
                      {STATUS_LABELS[b.status] ?? b.status}
                      {b.total_messages > 0
                        ? ` · ${b.processed_messages}/${b.total_messages} msgs`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="glass p-6">
            <button
              type="button"
              onClick={() => setDnaOpen((o) => !o)}
              className="flex w-full items-center justify-between text-left text-xl font-semibold"
            >
              DNA (JSON)
              <span className="text-twin-cyan">{dnaOpen ? "▲" : "▼"}</span>
            </button>
            {dnaOpen && (
              <pre className="mt-4 max-h-96 overflow-auto rounded-lg border border-twin-cyan/20 bg-black/50 p-4 text-xs text-slate-300">
                {dnaPayload
                  ? JSON.stringify(dnaPayload, null, 2)
                  : "Sem DNA ativo. Importe conversas e extraia o DNA."}
              </pre>
            )}
          </div>
        </>
      )}

      {!twin && !error && (
        <p className="text-twin-muted">Carregando twin…</p>
      )}
    </div>
  );
}
