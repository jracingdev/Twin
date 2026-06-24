"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  twinApi,
  type InboxSuggestion,
  type TrainingJob,
  type TwinDetail,
} from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  queued: "Na fila",
  processing: "Processando",
  completed: "Concluído",
  failed: "Falhou",
};

function trainingText(s: InboxSuggestion): string {
  const edited = s.metadata?.edited_text;
  if (typeof edited === "string" && edited.trim()) return edited;
  return s.suggested_text;
}

function wasEdited(s: InboxSuggestion): boolean {
  const edited = s.metadata?.edited_text;
  return typeof edited === "string" && edited.trim() !== s.suggested_text.trim();
}

export default function TwinTrainerPage() {
  const params = useParams();
  const twinId = typeof params.id === "string" ? params.id : "";

  const [twin, setTwin] = useState<TwinDetail | null>(null);
  const [examples, setExamples] = useState<InboxSuggestion[]>([]);
  const [job, setJob] = useState<TrainingJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!twinId) return;
    setLoading(true);
    setError("");
    try {
      const [t, accepted, sent] = await Promise.all([
        twinApi.getTwin(twinId),
        twinApi.listSuggestions({ twin_id: twinId, status: "accepted" }),
        twinApi.listSuggestions({ twin_id: twinId, status: "sent" }),
      ]);
      setTwin(t);
      const merged = [...(accepted.data ?? []), ...(sent.data ?? [])];
      const seen = new Set<string>();
      const unique = merged.filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
      unique.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setExamples(unique.slice(0, 30));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [twinId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleTrain() {
    if (!twinId) return;
    setTraining(true);
    setMessage("");
    setJob(null);
    setError("");
    try {
      const created = await twinApi.twinTrain(twinId);
      setJob(created);
      setMessage(
        created.examples_used != null
          ? `Treinamento iniciado com ${created.examples_used} exemplos.`
          : "Treinamento incremental iniciado."
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
      setError(e instanceof Error ? e.message : "Erro ao treinar");
    } finally {
      setTraining(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={`/twins/${twinId}`}
          className="text-sm text-twin-cyan hover:underline"
        >
          ← {twin?.name ?? "Twin"}
        </Link>
        <h1 className="text-3xl font-bold neon-text">Twin Trainer</h1>
      </div>

      {error && (
        <p className="rounded border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="glass space-y-4 p-6">
        <p className="text-sm text-twin-muted">
          Use sugestões aceitas ou editadas como exemplos de treino incremental.
          O twin aprende com o feedback que você já deu no playground e inbox.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleTrain}
            disabled={training || examples.length === 0}
            className="rounded-lg bg-gradient-to-r from-twin-cyan to-twin-magenta px-5 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {training ? "Treinando…" : "Treinar agora"}
          </button>
          <span className="text-sm text-twin-muted">
            {examples.length} exemplo{examples.length !== 1 ? "s" : ""} disponíve
            {examples.length !== 1 ? "is" : "l"}
          </span>
        </div>

        {job && (
          <div className="rounded-lg border border-twin-cyan/20 bg-black/30 px-4 py-3 text-sm">
            <p>
              Job{" "}
              <span className="font-mono text-twin-cyan">
                {job.id.slice(0, 8)}…
              </span>
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

      <div className="glass p-6">
        <h2 className="mb-4 text-xl font-semibold">Exemplos de treino</h2>
        {loading ? (
          <p className="text-sm text-twin-muted">Carregando exemplos…</p>
        ) : examples.length === 0 ? (
          <p className="text-sm text-twin-muted">
            Nenhuma sugestão aceita ainda.{" "}
            <Link href={`/playground?twin=${twinId}`} className="text-twin-cyan hover:underline">
              Teste no playground
            </Link>{" "}
            e aceite respostas para alimentar o treino.
          </p>
        ) : (
          <ul className="space-y-3">
            {examples.map((s) => (
              <li
                key={s.id}
                className="rounded border border-twin-cyan/10 px-4 py-3 text-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-twin-muted">
                  <span
                    className={
                      wasEdited(s)
                        ? "rounded bg-twin-magenta/20 px-2 py-0.5 text-twin-magenta"
                        : "rounded bg-green-500/20 px-2 py-0.5 text-green-300"
                    }
                  >
                    {wasEdited(s) ? "Editada" : "Aceita"}
                  </span>
                  <span>{new Date(s.created_at).toLocaleString("pt-BR")}</span>
                  {s.score != null && (
                    <span>Score: {Math.round(s.score <= 1 ? s.score * 100 : s.score)}%</span>
                  )}
                </div>
                <p className="text-twin-muted">
                  <span className="text-xs uppercase tracking-wide">Entrada</span>
                  <br />
                  {s.input_text}
                </p>
                <p className="mt-2">
                  <span className="text-xs uppercase tracking-wide text-twin-cyan">
                    Resposta de treino
                  </span>
                  <br />
                  {trainingText(s)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
