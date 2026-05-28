"use client";

import Link from "next/link";
import { useState } from "react";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { useAuth } from "@/contexts/AuthContext";

const links = [
  { href: "/", label: "Início" },
  { href: "/twins", label: "Twins" },
  { href: "/dashboard", label: "Painel" },
  { href: "/import", label: "Importar" },
  { href: "/conversations", label: "Conversas" },
  { href: "/contacts", label: "Contatos" },
  { href: "/playground", label: "Playground" },
  { href: "/seller", label: "Vendedor" },
  { href: "/timeline", label: "Timeline" },
  { href: "/settings", label: "Config" },
  { href: "/docs", label: "API" },
];

export function Nav() {
  const { user, loading, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
  }

  return (
    <header className="border-b border-twin-cyan/10 bg-black/40 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-xl font-bold neon-text">
          TWIN
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm text-twin-muted">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="transition hover:text-twin-cyan"
            >
              {l.label}
            </Link>
          ))}
          {!loading && user ? (
            <>
              <OrgSwitcher />
              <span className="text-twin-cyan/80" title={user.email}>
                {user.name || user.email}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="rounded-lg border border-twin-cyan/30 px-3 py-1.5 transition hover:border-twin-cyan hover:text-twin-cyan disabled:opacity-60"
              >
                {loggingOut ? "Saindo…" : "Sair"}
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg border border-twin-cyan/30 px-3 py-1.5 transition hover:border-twin-cyan hover:text-twin-cyan"
            >
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
