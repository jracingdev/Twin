"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { setOrganizationId, setToken } from "@/lib/auth";
import type { Organization } from "@/lib/api";

type LoginResponse = {
  token: string;
  user: { id: number; name: string; email: string };
  organization: Organization | null;
};

function getNextPath(): string {
  if (typeof window === "undefined") return "/dashboard";
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") ? next : "/dashboard";
}

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/dashboard");
  const { user, loading, refresh } = useAuth();

  useEffect(() => {
    setNextPath(getNextPath());
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [needs2fa, setNeeds2fa] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(nextPath.startsWith("/") ? nextPath : "/dashboard");
    }
  }, [loading, user, router, nextPath]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await api<LoginResponse & { two_factor_required?: boolean }>("/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          ...(twoFactorCode ? { two_factor_code: twoFactorCode } : {}),
        }),
      });
      if ("two_factor_required" in data && data.two_factor_required) {
        setNeeds2fa(true);
        setError("Informe o código do autenticador.");
        return;
      }
      setToken(data.token);
      if (data.organization?.id) {
        setOrganizationId(data.organization.id);
      }
      await refresh();
      router.push(nextPath.startsWith("/") ? nextPath : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "E-mail ou senha inválidos.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || user) {
    return <p className="text-twin-muted">Carregando…</p>;
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-8 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold neon-text">Entrar no TWIN</h1>
        <p className="mt-2 text-sm text-twin-muted">
          Use as credenciais da sua organização demo.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="glass space-y-5 p-8 shadow-glow">
        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        <label className="block space-y-2">
          <span className="text-sm text-twin-muted">E-mail</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-twin-cyan/20 bg-black/40 px-4 py-3 outline-none focus:border-twin-cyan"
            placeholder="admin@twin.local"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-twin-muted">Senha</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-twin-cyan/20 bg-black/40 px-4 py-3 outline-none focus:border-twin-cyan"
          />
        </label>
        {needs2fa && (
          <label className="block space-y-2">
            <span className="text-sm text-twin-muted">Código 2FA</span>
            <input
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
              className="w-full rounded-lg border border-twin-cyan/20 bg-black/40 px-4 py-3"
              placeholder="000000"
              maxLength={6}
            />
          </label>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-gradient-to-r from-twin-cyan to-twin-magenta py-3 font-medium text-black disabled:opacity-60"
        >
          {submitting ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <p className="text-center text-sm text-twin-muted space-x-4">
        <Link href="/forgot-password" className="hover:text-twin-cyan">
          Esqueci a senha
        </Link>
        <Link href="/signup" className="hover:text-twin-cyan">
          Criar conta
        </Link>
        <Link href="/" className="hover:text-twin-cyan">
          Início
        </Link>
      </p>
    </div>
  );
}
