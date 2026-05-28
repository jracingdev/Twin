"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export function HomeHero() {
  const { user, loading } = useAuth();

  return (
    <div className="flex flex-col items-center gap-8 py-20 text-center">
      <h1 className="text-5xl font-bold neon-text">TWIN</h1>
      <p className="max-w-xl text-lg text-twin-muted">
        Seu gêmeo digital comunicativo. Aprende seu estilo a partir de conversas reais —
        com consentimento e controle total dos dados.
      </p>
      <div className="flex gap-4">
        {!loading && user ? (
          <Link
            href="/dashboard"
            className="rounded-lg bg-gradient-to-r from-twin-cyan to-twin-magenta px-6 py-3 font-medium text-black"
          >
            Ir ao painel
          </Link>
        ) : (
          <>
            <Link
              href="/onboarding"
              className="rounded-lg bg-gradient-to-r from-twin-cyan to-twin-magenta px-6 py-3 font-medium text-black"
            >
              Começar
            </Link>
            <Link href="/login" className="glass px-6 py-3">
              Entrar
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
