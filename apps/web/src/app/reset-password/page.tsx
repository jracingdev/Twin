"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { twinApi } from "@/lib/api";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      await twinApi.resetPassword({
        token,
        email: String(fd.get("email") || email),
        password: String(fd.get("password")),
        password_confirmation: String(fd.get("password_confirmation")),
      });
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao redefinir.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-bold neon-text">Nova senha</h1>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <input name="email" type="email" defaultValue={email} required className="w-full rounded border border-twin-cyan/20 bg-black/40 px-3 py-2" />
      <input name="password" type="password" required minLength={8} placeholder="Nova senha" className="w-full rounded border border-twin-cyan/20 bg-black/40 px-3 py-2" />
      <input name="password_confirmation" type="password" required minLength={8} placeholder="Confirmar" className="w-full rounded border border-twin-cyan/20 bg-black/40 px-3 py-2" />
      <button type="submit" disabled={submitting} className="w-full rounded-lg bg-twin-cyan py-2 text-black">
        {submitting ? "Salvando…" : "Redefinir senha"}
      </button>
      <Link href="/login" className="text-sm text-twin-cyan">Login</Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="text-twin-muted">Carregando…</p>}>
      <ResetForm />
    </Suspense>
  );
}
