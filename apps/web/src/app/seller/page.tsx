"use client";



import { FormEvent, useEffect, useState } from "react";

import { TwinSelect } from "@/components/TwinSelect";

import { twinApi, type Playbook, type TwinStats } from "@/lib/api";



export default function SellerPage() {

  const [twinId, setTwinId] = useState("");

  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);

  const [stats, setStats] = useState<TwinStats | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [syncMsg, setSyncMsg] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({ intent: "greeting", template: "", vertical: "autopecas" });



  function reload() {

    if (!twinId) return;

    setLoading(true);

    setError("");

    Promise.all([twinApi.playbooks(twinId), twinApi.stats(twinId)])

      .then(([pb, st]) => {

        setPlaybooks(pb.data ?? []);

        setStats(st);

      })

      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar"))

      .finally(() => setLoading(false));

  }



  useEffect(() => {

    reload();

  }, [twinId]);



  async function handleResync() {
    if (!twinId) return;
    setSyncing(true);
    setSyncMsg("");
    setError("");
    try {
      const res = await twinApi.resyncPlaybooks(twinId);
      setSyncMsg(res.message || "Playbooks sincronizados com sucesso.");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();

    if (!twinId) return;

    await twinApi.createPlaybook(twinId, form);

    setForm({ intent: "greeting", template: "", vertical: "autopecas" });

    reload();
  }



  async function handleDelete(playbookId: number) {

    if (!twinId || !confirm("Excluir playbook?")) return;

    await twinApi.deletePlaybook(twinId, playbookId);

    reload();

  }



  return (

    <div className="space-y-6">

      <h1 className="text-3xl font-bold neon-text">Modo Vendedor</h1>

      <p className="text-twin-muted">

        Motopeças, autopeças e atendimento ERP — playbooks e templates editáveis.

      </p>

      <TwinSelect value={twinId} onChange={setTwinId} className="max-w-md" />
      {twinId && (
        <button
          type="button"
          onClick={() => void handleResync()}
          disabled={syncing}
          className="rounded border border-twin-cyan/30 px-3 py-1 text-xs text-twin-cyan disabled:opacity-50"
        >
          {syncing ? "Sincronizando…" : "Sincronizar playbooks com IA"}
        </button>
      )}

      {syncMsg && (
        <p className="rounded border border-green-500/30 bg-green-950/30 px-3 py-2 text-sm text-green-300">
          {syncMsg}
        </p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading && <p className="text-twin-muted">Carregando…</p>}



      {twinId && (

        <form onSubmit={handleCreate} className="glass space-y-3 p-4">

          <h2 className="font-semibold">Novo template</h2>

          <input

            value={form.intent}

            onChange={(e) => setForm({ ...form, intent: e.target.value })}

            placeholder="Intent (ex: greeting)"

            className="w-full rounded border border-twin-cyan/20 bg-black/40 px-3 py-2 text-sm"

          />

          <textarea

            value={form.template}

            onChange={(e) => setForm({ ...form, template: e.target.value })}

            required

            placeholder="Template da mensagem…"

            rows={3}

            className="w-full rounded border border-twin-cyan/20 bg-black/40 px-3 py-2 text-sm"

          />

          <button type="submit" className="rounded bg-twin-cyan px-4 py-2 text-sm text-black">

            Adicionar playbook

          </button>

        </form>

      )}



      <div className="grid gap-4 md:grid-cols-2">

        {playbooks.map((p) => (

          <div key={p.id} className="glass p-4">

            <span className="text-xs text-twin-cyan">{p.vertical}</span>

            <h3 className="font-semibold">{p.template}</h3>

            <p className="mt-2 text-sm text-twin-muted">Intent: {p.intent}</p>

            <p className="text-xs text-twin-muted">Usos: {p.usage_count}</p>

            {twinId && (

              <button

                type="button"

                onClick={() => handleDelete(p.id)}

                className="mt-2 text-xs text-red-400 hover:underline"

              >

                Excluir

              </button>

            )}

          </div>

        ))}

        {!loading && playbooks.length === 0 && twinId && (

          <p className="text-twin-muted">Nenhum playbook para este twin.</p>

        )}

      </div>



      {stats && (

        <div className="glass p-6">

          <h2 className="mb-2 font-semibold">Métricas</h2>

          <p className="text-2xl font-bold text-twin-cyan">

            {stats.suggestions.accept_rate != null

              ? `${stats.suggestions.accept_rate}% taxa de aceite`

              : "Sem sugestões avaliadas ainda"}

          </p>

          <p className="text-sm text-twin-muted">

            {stats.suggestions.accepted} aceitas de {stats.suggestions.total} sugestões

          </p>

        </div>

      )}

    </div>

  );

}

