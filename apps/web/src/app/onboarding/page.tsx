"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { twinApi } from "@/lib/api";
import {
  CONSENT_VERSION,
  getStoredConsentId,
  setStoredConsentId,
} from "@/lib/consent";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, organization, loading: authLoading } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkExistingConsent() {
      const stored = getStoredConsentId();
      if (stored) {
        router.replace("/import");
        return;
      }

      if (authLoading || !user || !organization?.id) {
        if (!authLoading) setCheckingExisting(false);
        return;
      }

      try {
        const consent = await twinApi.latestConsent("import", organization.id);
        if (cancelled) return;
        setStoredConsentId(consent.id);
        router.replace("/import");
      } catch {
        if (!cancelled) setCheckingExisting(false);
      }
    }

    void checkExistingConsent();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, organization?.id, router]);

  async function handleProceed() {
    if (!accepted) return;

    if (!user) {
      router.push("/login?next=/onboarding");
      return;
    }

    if (!organization?.id) {
      setError("Aguarde o carregamento da organização ou recarregue a página.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const consent = await twinApi.consent(
        {
          type: "import",
          text_version: CONSENT_VERSION,
        },
        organization.id
      );
      setStoredConsentId(consent.id);
      router.push("/import");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao registrar consentimento");
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingExisting && (authLoading || Boolean(user))) {
    return <p className="text-twin-muted">Verificando consentimento existente…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold neon-text">Consentimento LGPD</h1>
      <div className="glass space-y-4 p-6 text-sm text-twin-muted">
        <p>
          Ao continuar, você autoriza o processamento das conversas exportadas exclusivamente
          para treinar seu gêmeo digital TWIN. Você pode solicitar exclusão total a qualquer momento.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Dados armazenados com criptografia</li>
          <li>Isolamento por organização (tenant)</li>
          <li>Sem quebra de criptografia de apps</li>
          <li>Apenas exportações que você fornece</li>
        </ul>
        <label className="flex items-center gap-2 text-white">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          Li e aceito os termos (versão {CONSENT_VERSION})
        </label>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {!authLoading && !user && accepted && (
        <p className="text-sm text-twin-muted">
          É necessário entrar na sua conta para registrar o consentimento legalmente.
        </p>
      )}

      <button
        type="button"
        onClick={handleProceed}
        disabled={!accepted || submitting || authLoading}
        className="rounded-lg bg-gradient-to-r from-twin-cyan to-twin-magenta px-6 py-3 font-medium text-black disabled:opacity-50"
      >
        {submitting
          ? "Registrando…"
          : !user && accepted
            ? "Entrar e continuar"
            : "Prosseguir para importação"}
      </button>
    </div>
  );
}
