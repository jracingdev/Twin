"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { twinApi } from "@/lib/api";

export default function LgpdPage() {
  const [retention, setRetention] = useState("");
  const [exportId, setExportId] = useState<number | null>(null);
  const [exportStatus, setExportStatus] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    twinApi.lgpdRetention().then((r) => setRetention(r.description));
  }, []);

  async function requestExport() {
    setError("");
    try {
      const res = await twinApi.lgpdRequestExport();
      setExportId(res.id);
      setMessage(res.message);
      setExportStatus(res.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  async function pollExport() {
    if (!exportId) return;
    const res = await twinApi.lgpdExportStatus(exportId);
    setExportStatus(res.status);
    if (res.download_url) setMessage(`Download: ${res.download_url}`);
  }

  async function requestDeletion() {
    if (!confirm("Solicitar exclusão da conta? Processo irreversível após aprovação.")) return;
    try {
      const res = await twinApi.lgpdAccountDeletion();
      setMessage(res.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/settings" className="text-sm text-twin-cyan hover:underline">
        ← Configurações
      </Link>
      <h1 className="text-3xl font-bold neon-text">LGPD</h1>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-twin-cyan">{message}</p>}
      <div className="glass p-4">
        <h2 className="font-semibold">Política de retenção</h2>
        <p className="mt-2 text-sm text-twin-muted">{retention || "Carregando…"}</p>
      </div>
      <div className="glass space-y-3 p-4">
        <h2 className="font-semibold">Exportar meus dados</h2>
        <button type="button" onClick={requestExport} className="rounded border border-twin-cyan/40 px-4 py-2 text-sm">
          Solicitar exportação JSON
        </button>
        {exportId && (
          <>
            <p className="text-xs text-twin-muted">Status: {exportStatus}</p>
            <button type="button" onClick={pollExport} className="text-sm text-twin-cyan underline">
              Atualizar status
            </button>
          </>
        )}
      </div>
      <div className="glass space-y-3 border-red-500/20 p-4">
        <h2 className="font-semibold text-red-400">Exclusão de conta</h2>
        <button type="button" onClick={requestDeletion} className="rounded bg-red-500/20 px-4 py-2 text-sm text-red-300">
          Solicitar exclusão da conta
        </button>
      </div>
    </div>
  );
}
