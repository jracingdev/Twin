"use client";

import { useEffect, useState } from "react";
import { twinApi } from "@/lib/api";

const API_ORIGIN =
  (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080/api/v1").replace(
    /\/api\/v1\/?$/,
    ""
  );

export default function DocsPage() {
  const [info, setInfo] = useState<{ title?: string; openapi?: string } | null>(
    null
  );

  useEffect(() => {
    twinApi.apiDocs().then(setInfo).catch(() => setInfo(null));
  }, []);

  const openapiUrl =
    info?.openapi ?? `${API_ORIGIN}/api/v1/docs/openapi.yaml`;
  const swaggerUiUrl = `${API_ORIGIN}/api/v1/docs/ui`;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold neon-text">Documentação da API</h1>
      <div className="glass space-y-4 p-6 text-sm">
        <p>
          Autenticação:{" "}
          <code className="text-twin-cyan">Authorization: Bearer token</code> +{" "}
          <code className="text-twin-cyan">X-Tenant: organization_uuid</code>
        </p>
        <p>
          OpenAPI:{" "}
          <a
            href={openapiUrl}
            className="text-twin-cyan underline"
            target="_blank"
            rel="noreferrer"
          >
            openapi.yaml
          </a>
        </p>
        <ul className="list-inside list-disc text-twin-muted">
          <li>POST /login — obter token</li>
          <li>GET /twins — listar gêmeos</li>
          <li>POST /imports — importar conversas</li>
          <li>POST /suggest — sugestão RAG</li>
          <li>POST /train/trigger — extrair DNA</li>
        </ul>
      </div>
      <iframe
        title="OpenAPI"
        src={swaggerUiUrl}
        className="h-[70vh] w-full rounded-lg border border-twin-cyan/20 bg-black/60"
      />
    </div>
  );
}
