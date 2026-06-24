"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TwinSelect } from "@/components/TwinSelect";
import { useAuth } from "@/contexts/AuthContext";
import { checkAiEngineHealth, twinApi } from "@/lib/api";
import {
  CONSENT_VERSION,
  getStoredConsentId,
  setStoredConsentId,
} from "@/lib/consent";
import {
  getChannel,
  IMPORT_CHANNELS,
  type ImportChannelId,
} from "@/lib/import-channels";

const STATUS_LABELS: Record<string, string> = {
  queued: "Na fila",
  processing: "Processando",
  completed: "Concluído",
  failed: "Falhou",
};

type ConsentStatus = "checking" | "ready" | "missing";

function formatImportError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("connection refused") ||
    lower.includes("failed to connect") ||
    lower.includes("could not resolve host") ||
    lower.includes("curl error 7")
  ) {
    return "Motor de IA indisponível. Inicie o serviço em apps/ai-engine (porta 8000) e tente novamente.";
  }
  if (lower.includes("timed out") || lower.includes("timeout")) {
    return "O motor de IA demorou para responder. Tente um arquivo menor ou verifique a conexão.";
  }
  return message;
}

const CHANNEL_IDS = new Set(IMPORT_CHANNELS.map((c) => c.id));

function resolveChannel(param: string | null): ImportChannelId {
  if (param && CHANNEL_IDS.has(param as ImportChannelId)) {
    return param as ImportChannelId;
  }
  return "whatsapp";
}

export default function ImportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, organization, loading: authLoading } = useAuth();
  const twinFromUrl = searchParams.get("twin") ?? "";
  const channelParam = searchParams.get("channel");
  const [twinId, setTwinId] = useState("");
  const [aiHealth, setAiHealth] = useState<{
    ok: boolean;
    message: string;
    checking: boolean;
  }>({ ok: false, message: "", checking: true });
  const [file, setFile] = useState<File | null>(null);
  const [channel, setChannel] = useState<ImportChannelId>("whatsapp");
  const [consentId, setConsentId] = useState<string | null>(null);
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>("checking");
  const [consentError, setConsentError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [batchStatus, setBatchStatus] = useState("");
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState("");

  const channelInfo = useMemo(() => getChannel(channel), [channel]);

  useEffect(() => {
    setChannel(resolveChannel(channelParam));
  }, [channelParam]);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        setConsentStatus((prev) => (prev === "checking" ? "missing" : prev));
      }
    }, 8000);

    async function resolveConsent() {
      setConsentStatus("checking");
      setConsentError("");

      const stored = getStoredConsentId();
      if (stored) {
        if (!cancelled) {
          setConsentId(stored);
          setConsentStatus("ready");
        }
        return;
      }

      if (authLoading) return;

      if (!user) {
        if (!cancelled) setConsentStatus("missing");
        return;
      }

      if (!organization?.id) {
        if (!cancelled) {
          setConsentError(
            "Aguardando organização… Se demorar, recarregue a página ou escolha uma organização no menu."
          );
        }
        return;
      }

      try {
        const consent = await twinApi.latestConsent("import", organization.id);
        if (cancelled) return;
        if (!consent) {
          setConsentStatus("missing");
          return;
        }
        setStoredConsentId(consent.id);
        setConsentId(String(consent.id));
        setConsentStatus("ready");
      } catch {
        if (!cancelled) setConsentStatus("missing");
      }
    }

    void resolveConsent();

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [authLoading, user, organization?.id]);

  useEffect(() => {
    checkAiEngineHealth().then((h) =>
      setAiHealth({ ok: h.ok, message: h.message, checking: false })
    );
  }, []);

  const isZip = file?.name.toLowerCase().endsWith(".zip") ?? false;
  const uploadSource = isZip ? "zip" : channel;

  async function handleUpload() {
    if (!file || !twinId || !consentId) return;
    setUploading(true);
    setError("");
    setProgress("");
    setBatchStatus("");
    setPercent(null);

    try {
      const form = new FormData();
      form.append("twin_id", twinId);
      form.append("source", uploadSource);
      form.append("channel", channel);
      form.append("consent_id", consentId);
      form.append("file", file);

      setProgress("Enviando arquivo…");
      const batch = await twinApi.importFile(form, {
        organizationId: organization?.id,
      });
      setBatchStatus(batch.status);
      setProgress(`Lote ${batch.id.slice(0, 8)}… enfileirado.`);

      let status = batch.status;
      let processed = batch.processed_messages ?? 0;
      let total = batch.total_messages ?? 0;
      let attempts = 0;

      while (status !== "completed" && status !== "failed" && attempts < 60) {
        await new Promise((r) => setTimeout(r, 2000));
        const updated = await twinApi.importStatus(batch.id);
        status = updated.status;
        processed = updated.processed_messages ?? processed;
        total = updated.total_messages ?? total;
        setBatchStatus(status);

        const pct =
          total > 0 ? Math.round((processed / total) * 100) : null;
        setPercent(pct);
        setProgress(
          `${STATUS_LABELS[status] ?? status}${
            pct != null ? ` — ${pct}% (${processed}/${total} mensagens)` : ""
          }`
        );
        attempts++;
      }

      if (status === "completed") {
        setProgress(
          `Importação concluída${total > 0 ? `: ${total} mensagens processadas` : ""}. DNA sendo extraído…`
        );
        window.setTimeout(() => {
          router.push(`/onboarding/dna-ready?twin=${twinId}`);
        }, 2500);
      } else if (status === "failed") {
        const detail = await twinApi.importStatus(batch.id);
        const metaError =
          detail.metadata &&
          typeof detail.metadata === "object" &&
          "error" in detail.metadata
            ? String((detail.metadata as { error?: string }).error)
            : "";
        setError(
          formatImportError(
            metaError || "A importação falhou. Verifique os logs da API e do motor de IA."
          )
        );
        setProgress("");
      } else {
        setError("Tempo esgotado aguardando o processamento. Consulte o status na timeline.");
      }
    } catch (e) {
      setError(formatImportError(e instanceof Error ? e.message : "Erro no upload"));
      setProgress("");
    } finally {
      setUploading(false);
    }
  }

  if (consentStatus === "checking") {
    return (
      <div className="space-y-3">
        <p className="text-twin-muted">Verificando consentimento…</p>
        {consentError && (
          <p className="text-sm text-amber-300">{consentError}</p>
        )}
      </div>
    );
  }

  if (consentStatus === "missing" || !consentId) {
    return (
      <div className="mx-auto max-w-lg space-y-4 glass p-6">
        <h1 className="text-xl font-bold text-twin-cyan">Consentimento necessário</h1>
        <p className="text-sm text-twin-muted">
          Para importar conversas, aceite os termos LGPD (versão {CONSENT_VERSION}).
          {!user && " Você precisa estar logado para registrar o consentimento."}
        </p>
        {consentError && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
            {consentError}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Link
            href="/onboarding"
            className="rounded-lg bg-gradient-to-r from-twin-cyan to-twin-magenta px-4 py-2 text-sm font-medium text-black"
          >
            Completar onboarding
          </Link>
          {!user && (
            <Link
              href="/login?next=/import"
              className="rounded-lg border border-twin-cyan/40 px-4 py-2 text-sm text-twin-cyan"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold neon-text">Importar conversas</h1>
        <Link
          href="/import/channels"
          className="text-sm text-twin-cyan hover:underline"
        >
          Ver todos os canais
        </Link>
      </div>

      <div className="glass space-y-4 p-6">
        <p className="text-sm text-twin-muted">
          Exportações oficiais apenas. Consentimento LGPD registrado (ID {consentId}).
          {" "}
          <Link href="/onboarding" className="text-twin-cyan hover:underline">
            Rever termos
          </Link>
        </p>

        {!aiHealth.checking && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              aiHealth.ok
                ? "border-green-500/30 bg-green-950/30 text-green-300"
                : "border-amber-500/40 bg-amber-950/30 text-amber-200"
            }`}
          >
            {aiHealth.message}
          </div>
        )}

        <label className="block text-sm text-twin-muted">Canal da exportação</label>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as ImportChannelId)}
          className="w-full max-w-md rounded border border-twin-cyan/20 bg-black/40 px-3 py-2"
        >
          {IMPORT_CHANNELS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>

        {channelInfo && (
          <div className="rounded-lg border border-twin-cyan/15 bg-black/30 p-4 text-sm">
            <p className="font-medium text-twin-cyan">Como exportar ({channelInfo.label})</p>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-twin-muted">
              {channelInfo.exportSteps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-twin-muted">
              Tipos aceitos: {channelInfo.fileTypes}
            </p>
            <a
              href={channelInfo.exportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-twin-magenta hover:underline"
            >
              Exportação oficial →
            </a>
          </div>
        )}

        <label className="block text-sm text-twin-muted">Twin de destino</label>
        <TwinSelect
          value={twinId}
          onChange={setTwinId}
          preferredTwinId={twinFromUrl}
          className="w-full max-w-md"
        />
        {twinId && (
          <p className="text-xs text-twin-muted">
            As mensagens importadas treinarão o twin selecionado acima.
          </p>
        )}

        <div
          className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-twin-cyan/30 hover:border-twin-cyan/60"
          onClick={() => document.getElementById("file")?.click()}
        >
          <input
            id="file"
            type="file"
            className="hidden"
            accept={channelInfo?.accept ?? ".txt,.json,.zip,.csv,.eml"}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {file ? (
            <p>
              {file.name}
              {isZip && (
                <span className="block text-xs text-twin-muted">
                  ZIP — canal: {channelInfo?.label}
                </span>
              )}
            </p>
          ) : (
            <p className="text-twin-muted">Arraste ou clique para selecionar</p>
          )}
        </div>

        {batchStatus && (
          <div className="rounded-lg border border-twin-cyan/20 bg-black/30 px-4 py-3">
            <p className="text-xs text-twin-muted">Status do lote</p>
            <p className="font-medium text-twin-cyan">
              {STATUS_LABELS[batchStatus] ?? batchStatus}
            </p>
            {percent != null && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-twin-cyan to-twin-magenta transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        {progress && !error && (
          <p className="text-sm text-twin-cyan">{progress}</p>
        )}
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading || !file || !twinId || !aiHealth.ok}
          className="w-full rounded-lg bg-gradient-to-r from-twin-cyan to-twin-magenta py-3 font-medium text-black disabled:opacity-50"
        >
          {uploading ? "Processando…" : "Enviar importação"}
        </button>
      </div>
    </div>
  );
}
