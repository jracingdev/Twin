"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { twinApi } from "@/lib/api";
import { setOrganizationId, setToken } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";

export default function SignupPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    setError("");
    try {
      const res = await twinApi.register({
        name: String(fd.get("name")),
        email: String(fd.get("email")),
        password: String(fd.get("password")),
        password_confirmation: String(fd.get("password_confirmation")),
        organization_name: String(fd.get("organization_name")),
      });
      setToken(res.token);
      if (res.organization?.id) setOrganizationId(res.organization.id);
      await refresh();
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cadastro indisponível.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <h1 className="text-center text-3xl font-bold neon-text">Criar conta TWIN</h1>
      <p className="text-center text-sm text-twin-muted">
        Cadastro público só funciona se TWIN_REGISTRATION_ENABLED=true no servidor.
      </p>
      <form onSubmit={handleSubmit} className="glass space-y-4 p-8">
        {error && <p className="text-sm text-red-400">{error}</p>}
        {(
          ["name", "email", "organization_name", "password", "password_confirmation"] as const
        ).map((field) => (
          <label key={field} className="block space-y-1 text-sm">
            <span className="text-twin-muted">
              {field === "organization_name"
                ? "Nome da organização"
                : field === "password_confirmation"
                  ? "Confirmar senha"
                  : field === "name"
                    ? "Nome"
                    : field === "email"
                      ? "E-mail"
                      : "Senha"}
            </span>
            <input
              name={field}
              type={field.includes("password") ? "password" : field === "email" ? "email" : "text"}
              required
              minLength={field.includes("password") ? 8 : undefined}
              className="w-full rounded-lg border border-twin-cyan/20 bg-black/40 px-3 py-2"
            />
          </label>
        ))}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-gradient-to-r from-twin-cyan to-twin-magenta py-3 font-medium text-black disabled:opacity-60"
        >
          {submitting ? "Criando…" : "Cadastrar"}
        </button>
      </form>
      <p className="text-center text-sm">
        <Link href="/login" className="text-twin-cyan hover:underline">
          Já tenho conta
        </Link>
      </p>
    </div>
  );
}
