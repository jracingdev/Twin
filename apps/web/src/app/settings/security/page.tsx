"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { twinApi } from "@/lib/api";

export default function SecurityPage() {
  const [enabled, setEnabled] = useState(false);
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    twinApi.twoFactorStatus().then((r) => setEnabled(r.enabled));
  }, []);

  async function enable() {
    setError("");
    try {
      const res = await twinApi.twoFactorEnable();
      setSecret(res.secret);
      setQr(res.qr_url);
      setMessage("Escaneie o QR no Google Authenticator e confirme abaixo.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    try {
      await twinApi.twoFactorConfirm(code);
      setEnabled(true);
      setMessage("2FA ativado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido");
    }
  }

  async function disable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get("password") as string;
    try {
      await twinApi.twoFactorDisable(password);
      setEnabled(false);
      setMessage("2FA desativado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/settings" className="text-sm text-twin-cyan hover:underline">
        ← Configurações
      </Link>
      <h1 className="text-3xl font-bold neon-text">Segurança (2FA)</h1>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-twin-cyan">{message}</p>}
      {enabled ? (
        <form onSubmit={disable} className="glass space-y-3 p-4">
          <p className="text-sm text-twin-muted">2FA está ativo.</p>
          <input name="password" type="password" required placeholder="Senha para desativar" className="w-full rounded border border-twin-cyan/20 bg-black/40 px-3 py-2" />
          <button type="submit" className="rounded border border-red-500/40 px-4 py-2 text-red-300">
            Desativar 2FA
          </button>
        </form>
      ) : (
        <>
          <button type="button" onClick={enable} className="rounded bg-twin-cyan px-4 py-2 text-black">
            Ativar 2FA
          </button>
          {secret && (
            <form onSubmit={confirm} className="glass space-y-3 p-4">
              <p className="break-all font-mono text-xs">{secret}</p>
              {qr && (
                <a href={qr} className="text-sm text-twin-cyan underline" target="_blank" rel="noreferrer">
                  Abrir URL do QR
                </a>
              )}
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código 6 dígitos" className="w-full rounded border border-twin-cyan/20 bg-black/40 px-3 py-2" maxLength={6} />
              <button type="submit" className="rounded border border-twin-cyan/40 px-4 py-2">
                Confirmar
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
