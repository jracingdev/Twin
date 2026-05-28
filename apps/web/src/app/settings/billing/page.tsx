"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { twinApi } from "@/lib/api";

export default function BillingPage() {
  const [sub, setSub] = useState<unknown>(null);
  const [plans, setPlans] = useState<{ slug: string; name: string; price_monthly: number }[]>([]);
  const [stripeOk, setStripeOk] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([twinApi.billingSubscription(), twinApi.billingPlans()])
      .then(([s, p]) => {
        setSub(s.subscription);
        setStripeOk(s.stripe_configured);
        setPlans((p.data ?? []) as typeof plans);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"))
      .finally(() => setLoading(false));
  }, []);

  async function checkout(slug: string) {
    try {
      const res = await twinApi.billingCheckout(slug);
      window.location.href = res.checkout_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no checkout");
    }
  }

  async function portal() {
    try {
      const res = await twinApi.billingPortal();
      window.location.href = res.portal_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no portal");
    }
  }

  if (loading) return <p className="text-twin-muted">Carregando…</p>;

  return (
    <div className="space-y-6">
      <Link href="/settings" className="text-sm text-twin-cyan hover:underline">
        ← Configurações
      </Link>
      <h1 className="text-3xl font-bold neon-text">Faturamento</h1>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!stripeOk && (
        <p className="text-sm text-amber-400">
          Stripe não configurado no servidor (STRIPE_SECRET). Modo demo sem cobrança real.
        </p>
      )}
      {sub ? (
        <div className="glass p-4 text-sm">
          <pre className="overflow-auto text-twin-muted">{JSON.stringify(sub, null, 2)}</pre>
        </div>
      ) : (
        <p className="text-twin-muted">Plano gratuito ativo.</p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <div key={p.slug} className="glass p-4">
            <h3 className="font-semibold">{p.name}</h3>
            <p className="text-2xl text-twin-cyan">R$ {p.price_monthly}</p>
            <button
              type="button"
              disabled={!stripeOk}
              onClick={() => checkout(p.slug)}
              className="mt-3 rounded border border-twin-cyan/40 px-3 py-1 text-sm disabled:opacity-40"
            >
              Assinar
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={!stripeOk}
        onClick={portal}
        className="rounded border border-twin-cyan/40 px-4 py-2 text-sm"
      >
        Portal do cliente Stripe
      </button>
    </div>
  );
}
