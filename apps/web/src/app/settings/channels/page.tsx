"use client";

import Link from "next/link";
import { IMPORT_CHANNELS } from "@/lib/import-channels";

export default function SettingsChannelsPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link href="/settings" className="text-sm text-twin-cyan hover:underline">
          ← Configurações
        </Link>
        <h1 className="mt-2 text-3xl font-bold neon-text">Canais</h1>
        <p className="mt-2 max-w-2xl text-sm text-twin-muted">
          O TWIN treina com exportações oficiais que você envia — arquivos JSON, TXT
          ou ZIP obtidos legalmente nas plataformas. Não conectamos APIs de mensagens
          em tempo real para treinar o DNA.
        </p>
      </div>

      <div className="glass space-y-3 border-twin-cyan/20 p-6">
        <h2 className="font-semibold">Consentimento</h2>
        <p className="text-sm text-twin-muted">
          Ao importar, você confirma que possui direito sobre os dados e que o uso
          para criar o Twin está de acordo com a LGPD e os termos da plataforma de
          origem. Revise em{" "}
          <Link href="/settings/lgpd" className="text-twin-cyan hover:underline">
            LGPD
          </Link>
          .
        </p>
      </div>

      <div className="space-y-4">
        {IMPORT_CHANNELS.map((ch) => (
          <section key={ch.id} className="glass p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="font-semibold text-twin-cyan">{ch.label}</h2>
              <span className="rounded-full border border-green-500/30 bg-green-950/30 px-2 py-0.5 text-xs text-green-300">
                Exportação oficial
              </span>
            </div>
            <p className="mt-2 text-sm text-twin-muted">{ch.fileTypes}</p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-twin-muted">
              {ch.exportSteps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <a
              href={ch.exportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-xs text-twin-magenta hover:underline"
            >
              Documentação oficial
            </a>
          </section>
        ))}
      </div>

      <div className="glass border-amber-500/20 p-5 opacity-70">
        <h2 className="font-semibold text-twin-muted">Sync business (em breve)</h2>
        <p className="mt-1 text-sm text-twin-muted">
          Integração em tempo real com APIs Meta Cloud e Telegram TDLib para atendimento
          comercial ficará disponível numa fase futura — não é usada para treino de DNA.
        </p>
        <button
          type="button"
          disabled
          className="mt-3 cursor-not-allowed rounded border border-twin-cyan/20 px-3 py-1 text-xs text-twin-muted"
        >
          Conectar API — indisponível
        </button>
      </div>

      <Link
        href="/import/channels"
        className="inline-block rounded-lg bg-gradient-to-r from-twin-cyan to-twin-magenta px-4 py-2 text-sm font-medium text-black"
      >
        Importar conversas
      </Link>
    </div>
  );
}
