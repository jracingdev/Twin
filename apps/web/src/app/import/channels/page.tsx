"use client";

import Link from "next/link";
import { IMPORT_CHANNELS } from "@/lib/import-channels";

export default function ImportChannelsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold neon-text">Canais de importação</h1>
        <p className="mt-2 max-w-2xl text-sm text-twin-muted">
          O TWIN treina apenas com exportações oficiais que você envia. Não usamos
          webhooks nem leitura em tempo real das suas contas para DNA.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {IMPORT_CHANNELS.map((ch) => (
          <article
            key={ch.id}
            className="glass flex flex-col gap-3 p-5 transition hover:border-twin-cyan/40"
          >
            <h2 className="text-lg font-semibold text-twin-cyan">{ch.label}</h2>
            <p className="text-xs text-twin-muted">Aceito: {ch.fileTypes}</p>
            <ol className="list-inside list-decimal space-y-1 text-sm text-twin-muted">
              {ch.exportSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <a
              href={ch.exportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-twin-magenta hover:underline"
            >
              Página oficial de exportação →
            </a>
            <Link
              href={`/import?channel=${ch.id}`}
              className="mt-auto rounded-lg border border-twin-cyan/40 py-2 text-center text-sm transition hover:bg-twin-cyan/10"
            >
              Importar {ch.label}
            </Link>
          </article>
        ))}
      </div>

      <p className="text-sm text-twin-muted">
        <Link href="/import" className="text-twin-cyan hover:underline">
          Ir para upload
        </Link>
        {" · "}
        <Link href="/settings/channels" className="text-twin-cyan hover:underline">
          Configurações de canais
        </Link>
      </p>
    </div>
  );
}
