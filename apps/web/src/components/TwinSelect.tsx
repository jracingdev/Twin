"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { twinApi, type Twin } from "@/lib/api";

type Props = {
  value: string;
  onChange: (id: string) => void;
  className?: string;
  /** Pré-seleciona um twin (ex.: query ?twin=) */
  preferredTwinId?: string;
};

export function TwinSelect({
  value,
  onChange,
  className = "",
  preferredTwinId,
}: Props) {
  const { organization, loading: authLoading } = useAuth();
  const [twins, setTwins] = useState<Twin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!organization) {
      setTwins([]);
      setError("Nenhuma organização vinculada à sua conta.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    twinApi
      .listTwins()
      .then((res) => {
        const list = res.data ?? [];
        setTwins(list);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar twins"))
      .finally(() => setLoading(false));
  }, [authLoading, organization?.id]);

  useEffect(() => {
    if (value) return;
    if (preferredTwinId && twins.some((t) => t.id === preferredTwinId)) {
      onChange(preferredTwinId);
      return;
    }
    if (twins[0]) {
      onChange(twins[0].id);
    }
  }, [twins, value, onChange, preferredTwinId]);

  if (loading) {
    return <p className="text-sm text-twin-muted">Carregando twins…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (twins.length === 0) {
    return (
      <p className="text-sm text-twin-muted">
        Nenhum twin.{" "}
        <a href="/twins" className="text-twin-cyan hover:underline">
          Criar um twin
        </a>
      </p>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded border border-twin-cyan/20 bg-black/40 px-3 py-2 text-sm ${className}`}
    >
      {twins.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
