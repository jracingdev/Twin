"use client";

import { useState } from "react";
import { twinApi } from "@/lib/api";

type TrainJob = {
  id: string;
  twin_id: string;
  type: string;
  status: string;
  result?: { error?: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  queued: "Na fila",
  processing: "Processando",
  completed: "Concluído",
  failed: "Falhou",
};

type Props = {
  twinId: string;
};

export function TrainPanel({ twinId }: Props) {
  const [job, setJob] = useState<TrainJob | null>(null);
  const [loading, setLoading] = useState<"dna_extract" | "reindex" | null>(null);
  const [message, setMessage] = useState("");

  async function trigger(type: "dna_extract" | "reindex") {
    if (!twinId) return;
    setLoading(type);
    setMessage("");
    setJob(null);
    try {
      const created = await twinApi.trainTrigger({ twin_id: twinId, type });
      setJob(created);
      setMessage(
        type === "dna_extract"
          ? "Extração de DNA iniciada."
          : "Reindexação iniciada."
      );

      let current = created;
      let attempts = 0;
      while (
        current.status !== "completed" &&
        current.status !== "failed" &&
        attempts < 30
      ) {
        await new Promise((r) => setTimeout(r, 2000));
        current = await twinApi.trainJobStatus(current.id);
        setJob(current);
        attempts++;
      }

      if (current.status === "completed") {
        setMessage("Treinamento concluído com sucesso.");
      } else if (current.status === "failed") {
        const err =
          current.result?.error ||
          "Falha no treinamento. Verifique se o motor de IA está ativo.";
        setMessage(err);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro ao disparar treino");
    } finally {
      setLoading(null);
    }
  }

  if (!twinId) {
    return (
      <p className="text-sm text-twin-muted">
        Selecione um twin para extrair DNA ou reindexar.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!!loading}
          onClick={() => trigger("dna_extract")}
          className="rounded-lg border border-twin-cyan/40 px-4 py-2 text-sm text-twin-cyan hover:bg-twin-cyan/10 disabled:opacity-50"
        >
          {loading === "dna_extract" ? "Extraindo…" : "Extrair DNA"}
        </button>
        <button
          type="button"
          disabled={!!loading}
          onClick={() => trigger("reindex")}
          className="rounded-lg border border-twin-magenta/40 px-4 py-2 text-sm text-twin-magenta hover:bg-twin-magenta/10 disabled:opacity-50"
        >
          {loading === "reindex" ? "Reindexando…" : "Reindexar"}
        </button>
      </div>
      {job && (
        <div className="rounded-lg border border-twin-cyan/20 bg-black/30 px-4 py-3 text-sm">
          <p>
            Job <span className="font-mono text-twin-cyan">{job.id.slice(0, 8)}…</span>
          </p>
          <p className="text-twin-muted">
            Tipo: {job.type} · Status:{" "}
            <span
              className={
                job.status === "failed"
                  ? "text-red-400"
                  : job.status === "completed"
                    ? "text-green-400"
                    : "text-twin-cyan"
              }
            >
              {STATUS_LABELS[job.status] ?? job.status}
            </span>
          </p>
        </div>
      )}
      {message && (
        <p
          className={`text-sm ${
            message.includes("Falha") || message.includes("motor")
              ? "text-red-400"
              : "text-twin-cyan"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
