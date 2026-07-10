"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getToken, isPublicPath } from "@/lib/auth";

/**
 * Guarda client-side alinhada ao middleware:
 * - Rotas públicas: mesma lista em `auth-constants` / middleware.
 * - Rotas privadas: exige token em sessionStorage + user via /me.
 * O middleware já redireciona sem cookie `twin_auth`; aqui cobrimos
 * cookie órfão (sem token) e sessão inválida após clearToken.
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isPublic = isPublicPath(pathname);

  useEffect(() => {
    if (loading || isPublic) return;
    if (!getToken() || !user) {
      const next = encodeURIComponent(pathname);
      router.replace(`/login?next=${next}`);
    }
  }, [loading, user, isPublic, pathname, router]);

  if (!isPublic && loading) {
    return <p className="text-twin-muted">Carregando…</p>;
  }

  if (!isPublic && (!getToken() || !user)) {
    return null;
  }

  return <>{children}</>;
}
