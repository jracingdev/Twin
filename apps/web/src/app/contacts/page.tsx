"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { twinApi, type Contact } from "@/lib/api";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await twinApi.listContacts(search || undefined);
      setContacts((res as { data: Contact[] }).data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await twinApi.createContact({
      display_name: String(fd.get("display_name")),
      channel: String(fd.get("channel") || "whatsapp"),
    });
    formRef.current?.reset();
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold neon-text">Contatos</h1>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar contato…"
        className="max-w-md rounded-lg border border-twin-cyan/20 bg-black/40 px-3 py-2"
      />
      <form
        ref={formRef}
        onSubmit={handleCreate}
        className="glass flex flex-wrap gap-3 p-4"
      >
        <input
          name="display_name"
          required
          placeholder="Nome"
          className="rounded border border-twin-cyan/20 bg-black/40 px-3 py-2"
        />
        <input
          name="channel"
          defaultValue="whatsapp"
          placeholder="Canal"
          className="rounded border border-twin-cyan/20 bg-black/40 px-3 py-2"
        />
        <button
          type="submit"
          className="rounded bg-twin-cyan px-4 py-2 text-black"
        >
          Adicionar
        </button>
      </form>
      {loading ? (
        <p className="text-twin-muted">Carregando…</p>
      ) : (
        <ul className="glass divide-y divide-twin-cyan/10">
          {contacts.map((c) => (
            <li key={c.id} className="px-4 py-3">
              {c.display_name} —{" "}
              <span className="text-sm text-twin-muted">{c.channel}</span>
            </li>
          ))}
          {contacts.length === 0 && (
            <li className="px-4 py-6 text-center text-twin-muted">
              Nenhum contato.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
