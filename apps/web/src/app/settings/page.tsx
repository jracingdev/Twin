"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TwinSelect } from "@/components/TwinSelect";
import { twinApi, type ApiKeyRow } from "@/lib/api";

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [purgeTwinId, setPurgeTwinId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookMsg, setWebhookMsg] = useState("");

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await twinApi.listApiKeys();
      setKeys(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar chaves");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
    twinApi.webhookSettings().then((w) => setWebhookUrl(w.webhook_url ?? ""));
  }, [loadKeys]);

  async function saveWebhook() {
    try {
      await twinApi.updateWebhookSettings({ webhook_url: webhookUrl || null });
      setWebhookMsg("Webhook salvo.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no webhook");
    }
  }

  async function testWebhook() {
    try {
      const res = await twinApi.testWebhook();
      setWebhookMsg(res.ok ? "Teste enviado com sucesso." : "Falha no teste.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no teste");
    }
  }

  async function revokeKey(id: number) {
    if (!confirm("Revogar esta chave?")) return;
    await twinApi.revokeApiKey(id);
    await loadKeys();
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) return;
    setError("");
    try {
      const res = await twinApi.createApiKey(newKeyName.trim());
      setCreatedKey(res.key);
      setNewKeyName("");
      await loadKeys();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar chave");
    }
  }

  async function handlePurge() {
    if (!purgeTwinId || !confirm("Exclusão LGPD irreversível para este twin. Continuar?")) {
      return;
    }
    setError("");
    try {
      const res = await twinApi.purge(purgeTwinId);
      setMessage(res.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro na exclusão");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold neon-text">Configurações</h1>

      <nav className="flex flex-wrap gap-4 text-sm">
        <Link href="/settings/billing" className="text-twin-cyan hover:underline">
          Faturamento
        </Link>
        <Link href="/settings/security" className="text-twin-cyan hover:underline">
          2FA
        </Link>
        <Link href="/settings/lgpd" className="text-twin-cyan hover:underline">
          LGPD
        </Link>
        <Link href="/settings/channels" className="text-twin-cyan hover:underline">
          Canais
        </Link>
      </nav>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-twin-cyan">{message}</p>}

      <div className="glass space-y-4 p-6">
        <h2 className="font-semibold">API Keys</h2>
        <p className="text-sm text-twin-muted">Gerencie chaves para integração pública.</p>
        {loading ? (
          <p className="text-sm text-twin-muted">Carregando…</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between rounded border border-twin-cyan/10 px-3 py-2">
                <span>
                  {k.name} — <span className="font-mono">{k.key_prefix}…</span>
                </span>
                <button
                  type="button"
                  onClick={() => revokeKey(k.id)}
                  className="text-xs text-red-400 hover:underline"
                >
                  Revogar
                </button>
              </li>
            ))}
            {keys.length === 0 && (
              <li className="text-twin-muted">Nenhuma chave cadastrada.</li>
            )}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Nome da chave"
            className="rounded border border-twin-cyan/20 bg-black/40 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleCreateKey}
            className="rounded border border-twin-cyan/40 px-4 py-2 text-sm"
          >
            Gerar nova chave
          </button>
        </div>
        {createdKey && (
          <p className="rounded border border-twin-magenta/30 bg-black/40 p-3 font-mono text-xs break-all">
            Copie agora: {createdKey}
          </p>
        )}
      </div>

      <div className="glass space-y-4 p-6">
        <h2 className="font-semibold">Webhooks de saída</h2>
        {webhookMsg && <p className="text-sm text-twin-cyan">{webhookMsg}</p>}
        <input
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://seu-sistema.com/webhooks/twin"
          className="w-full rounded border border-twin-cyan/20 bg-black/40 px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button type="button" onClick={saveWebhook} className="rounded border border-twin-cyan/40 px-3 py-1 text-sm">
            Salvar URL
          </button>
          <button type="button" onClick={testWebhook} className="rounded border border-twin-cyan/40 px-3 py-1 text-sm">
            Testar
          </button>
        </div>
      </div>

      <div className="glass space-y-4 border-red-500/30 p-6">
        <h2 className="font-semibold text-red-400">Exclusão de dados (LGPD)</h2>
        <p className="text-sm text-twin-muted">
          Remove permanentemente todos os dados do Twin, vetores Pinecone e arquivos.
        </p>
        <TwinSelect value={purgeTwinId} onChange={setPurgeTwinId} className="max-w-md" />
        <button
          type="button"
          onClick={handlePurge}
          disabled={!purgeTwinId}
          className="rounded bg-red-500/20 px-4 py-2 text-sm text-red-300 disabled:opacity-50"
        >
          Solicitar exclusão total do twin
        </button>
      </div>
    </div>
  );
}
