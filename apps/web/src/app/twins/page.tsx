"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { twinApi, type Twin } from "@/lib/api";

const emptyForm = {
  name: "",
  description: "",
  intensity: 2,
  seller_mode: false,
  vertical: "",
};

export default function TwinsPage() {
  const [twins, setTwins] = useState<Twin[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Twin | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await twinApi.listTwins({ search: search || undefined, page });
      setTwins(res.data ?? []);
      setLastPage(res.last_page ?? 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao listar twins");
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        intensity: form.intensity,
        seller_mode: form.seller_mode,
        vertical: form.vertical || null,
      };
      if (editing) {
        await twinApi.updateTwin(editing.id, body);
      } else {
        await twinApi.createTwin(body);
      }
      setForm(emptyForm);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(t: Twin) {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description ?? "",
      intensity: t.intensity,
      seller_mode: t.seller_mode,
      vertical: t.vertical ?? "",
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este twin?")) return;
    try {
      await twinApi.deleteTwin(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir");
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold neon-text">Gerenciar Twins</h1>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Buscar twins…"
          className="max-w-xs rounded-lg border border-twin-cyan/20 bg-black/40 px-3 py-2 text-sm"
        />
        {lastPage > 1 && (
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-twin-cyan/30 px-2 py-1 disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-twin-muted">
              {page} / {lastPage}
            </span>
            <button
              type="button"
              disabled={page >= lastPage}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-twin-cyan/30 px-2 py-1 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="glass space-y-4 p-6">
        <h2 className="font-semibold">{editing ? "Editar twin" : "Novo twin"}</h2>
        <input
          required
          placeholder="Nome"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded border border-twin-cyan/20 bg-black/40 px-3 py-2"
        />
        <textarea
          placeholder="Descrição"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full rounded border border-twin-cyan/20 bg-black/40 px-3 py-2"
          rows={2}
        />
        <div className="flex flex-wrap gap-4">
          <label className="text-sm text-twin-muted">
            Intensidade
            <input
              type="number"
              min={1}
              max={4}
              value={form.intensity}
              onChange={(e) =>
                setForm({ ...form, intensity: Number(e.target.value) })
              }
              className="ml-2 w-16 rounded border border-twin-cyan/20 bg-black/40 px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.seller_mode}
              onChange={(e) =>
                setForm({ ...form, seller_mode: e.target.checked })
              }
            />
            Modo vendedor
          </label>
          <input
            placeholder="Vertical (ex: autopecas)"
            value={form.vertical}
            onChange={(e) => setForm({ ...form, vertical: e.target.value })}
            className="rounded border border-twin-cyan/20 bg-black/40 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-twin-cyan px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {saving ? "Salvando…" : editing ? "Atualizar" : "Criar twin"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(emptyForm);
              }}
              className="rounded border border-twin-cyan/30 px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="glass p-6">
        <h2 className="mb-4 font-semibold">Seus twins</h2>
        {loading ? (
          <p className="text-twin-muted">Carregando…</p>
        ) : twins.length === 0 ? (
          <p className="text-twin-muted">Nenhum twin cadastrado.</p>
        ) : (
          <ul className="space-y-3">
            {twins.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-twin-cyan/10 p-4"
              >
                <div>
                  <Link
                    href={`/twins/${t.id}`}
                    className="font-medium text-twin-cyan hover:underline"
                  >
                    {t.name}
                  </Link>
                  <p className="text-xs text-twin-muted">
                    {t.status} · intensidade {t.intensity}
                    {t.seller_mode ? " · vendedor" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/twins/${t.id}`}
                    className="rounded border border-twin-magenta/30 px-3 py-1 text-xs text-twin-magenta"
                  >
                    Detalhes
                  </Link>
                  <button
                    type="button"
                    onClick={() => startEdit(t)}
                    className="rounded border border-twin-cyan/30 px-3 py-1 text-xs"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id)}
                    className="rounded border border-red-500/30 px-3 py-1 text-xs text-red-300"
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
