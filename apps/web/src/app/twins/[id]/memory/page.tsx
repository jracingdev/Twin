"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { twinApi, type MemoryEntity, type TwinDetail } from "@/lib/api";

const ENTITY_TYPES = [
  { value: "person", label: "Pessoa" },
  { value: "product", label: "Produto" },
  { value: "topic", label: "Tópico" },
  { value: "fact", label: "Fato" },
  { value: "preference", label: "Preferência" },
];

export default function TwinMemoryPage() {
  const params = useParams();
  const twinId = typeof params.id === "string" ? params.id : "";

  const [twin, setTwin] = useState<TwinDetail | null>(null);
  const [entities, setEntities] = useState<MemoryEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ type: "fact", label: "", content: "" });

  const load = useCallback(async () => {
    if (!twinId) return;
    setLoading(true);
    setError("");
    try {
      const [t, mem] = await Promise.all([
        twinApi.getTwin(twinId),
        twinApi.listMemoryEntities(twinId),
      ]);
      setTwin(t);
      setEntities(mem.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar memória");
    } finally {
      setLoading(false);
    }
  }, [twinId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!twinId || !form.label.trim()) return;
    setSaving(true);
    setError("");
    try {
      await twinApi.createMemoryEntity(twinId, {
        type: form.type,
        label: form.label.trim(),
        content: form.content.trim() || undefined,
      });
      setForm({ type: "fact", label: "", content: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar entidade");
    } finally {
      setSaving(false);
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
        <h1 className="text-3xl font-bold neon-text">Memória do twin</h1>
      </div>

      <p className="text-sm text-twin-muted">
        Grafo de memória simplificado — entidades que o twin usa no contexto RAG.
      </p>

      {error && (
        <p className="rounded border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="glass space-y-4 p-6">
        <h2 className="font-semibold">Adicionar entidade</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-twin-muted">
            Tipo
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="mt-1 w-full rounded border border-twin-cyan/20 bg-black/40 px-3 py-2"
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-twin-muted">
            Rótulo
            <input
              required
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Ex: Cliente VIP João"
              className="mt-1 w-full rounded border border-twin-cyan/20 bg-black/40 px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm text-twin-muted">
          Conteúdo (opcional)
          <textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={2}
            placeholder="Detalhes, contexto ou relação…"
            className="mt-1 w-full rounded border border-twin-cyan/20 bg-black/40 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-twin-cyan px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {saving ? "Salvando…" : "Adicionar"}
        </button>
      </form>

      <div className="glass p-6">
        <h2 className="mb-4 text-xl font-semibold">
          Entidades ({entities.length})
        </h2>
        {loading ? (
          <p className="text-sm text-twin-muted">Carregando…</p>
        ) : entities.length === 0 ? (
          <p className="text-sm text-twin-muted">
            Nenhuma entidade cadastrada. Adicione fatos, pessoas ou produtos que
            o twin deve lembrar.
          </p>
        ) : (
          <ul className="space-y-2">
            {entities.map((ent) => (
              <li
                key={ent.id}
                className="rounded border border-twin-cyan/10 px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-twin-cyan/10 px-2 py-0.5 text-xs text-twin-cyan">
                    {ENTITY_TYPES.find((t) => t.value === ent.type)?.label ??
                      ent.type}
                  </span>
                  <span className="font-medium">{ent.label}</span>
                  {ent.created_at && (
                    <span className="text-xs text-twin-muted">
                      {new Date(ent.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
                {ent.content && (
                  <p className="mt-2 text-twin-muted">{ent.content}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
