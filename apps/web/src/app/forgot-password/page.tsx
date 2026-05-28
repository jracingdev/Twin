"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { twinApi } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get("email") as string;
    setSubmitting(true);
    setError("");
    try {
      const res = await twinApi.forgotPassword(email);
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar link.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <h1 className="text-2xl font-bold neon-text">Esqueci a senha</h1>
      <form onSubmit={handleSubmit} className="glass space-y-4 p-6">
        {error && <p className="text-sm text-red-400">{error}</p>}
        {message && <p className="text-sm text-twin-cyan">{message}</p>}
        <input
          name="email"
          type="email"
          required
          placeholder="seu@email.com"
          className="w-full rounded-lg border border-twin-cyan/20 bg-black/40 px-3 py-2"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg border border-twin-cyan/40 py-2 text-twin-cyan"
        >
          {submitting ? "Enviando…" : "Enviar link"}
        </button>
      </form>
      <Link href="/login" className="text-sm text-twin-cyan hover:underline">
        Voltar ao login
      </Link>
    </div>
  );
}
