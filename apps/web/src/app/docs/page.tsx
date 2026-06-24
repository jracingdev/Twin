"use client";

import { useEffect, useState } from "react";
import { twinApi } from "@/lib/api";

const API_ORIGIN =
  (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080/api/v1").replace(
    /\/api\/v1\/?$/,
    ""
  );

const PRODUCTION_API = "https://api.twin.app.br/api/v1";

type DocsInfo = {
  title?: string;
  openapi?: string;
  swagger_ui?: string;
  production_api_url?: string;
  auth?: {
    login: string;
    header: string;
    tenant: string;
    api_key?: string;
  };
  tags?: string[];
};

const ENDPOINT_GROUPS: Record<string, string[]> = {
  Auth: [
    "POST /login",
    "POST /register",
    "POST /logout",
    "GET /me",
    "GET /organizations",
    "POST /organizations/switch",
  ],
  Twins: [
    "GET /twins",
    "POST /twins",
    "GET /twins/{id}",
    "PUT /twins/{id}",
    "DELETE /twins/{id}",
    "GET /twins/{id}/stats",
    "POST /twins/{id}/purge",
  ],
  Imports: ["POST /imports", "GET /imports/{id}"],
  Consent: ["GET /consent/latest", "POST /consent"],
  AI: ["POST /suggest", "POST /twins/{id}/replay"],
  Suggestions: [
    "GET /suggestions",
    "PATCH /suggestions/{id}",
    "POST /suggestions/{id}/send",
    "GET /suggestions/{id}/explain",
  ],
  Channels: [
    "GET /channel-credentials",
    "POST /channel-credentials",
    "GET /channel-metrics",
  ],
  Billing: [
    "GET /billing/plans",
    "GET /billing/subscription",
    "POST /billing/checkout",
  ],
  LGPD: ["GET /lgpd/retention", "POST /lgpd/export", "POST /lgpd/account-deletion"],
  Webhooks: ["GET /webhooks/settings", "PUT /webhooks/settings", "POST /webhooks/test"],
  Contacts: ["GET /contacts", "POST /contacts"],
  Conversations: ["GET /conversations", "GET /conversations/{id}"],
  Train: [
    "POST /train/trigger",
    "POST /twins/{id}/train",
    "GET /twins/{id}/training-status",
  ],
  Plan: ["GET /plan"],
};

function CurlBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="space-y-1">
      <p className="font-medium text-twin-cyan">{title}</p>
      <pre className="overflow-x-auto rounded border border-twin-cyan/20 bg-black/40 p-3 text-xs leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

function EndpointGroup({
  tag,
  endpoints,
  defaultOpen,
}: {
  tag: string;
  endpoints: string[];
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="rounded border border-twin-cyan/15 bg-black/30"
      open={defaultOpen}
    >
      <summary className="cursor-pointer px-4 py-2 font-medium text-twin-cyan hover:bg-twin-cyan/5">
        {tag}
        <span className="ml-2 text-xs text-twin-muted">({endpoints.length})</span>
      </summary>
      <ul className="list-inside list-disc px-4 pb-3 text-xs text-twin-muted">
        {endpoints.map((ep) => (
          <li key={ep}>
            <code>{ep}</code>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function DocsPage() {
  const [info, setInfo] = useState<DocsInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    twinApi
      .apiDocs()
      .then(setInfo)
      .catch(() => {
        setError("Não foi possível carregar metadados da API.");
        setInfo(null);
      });
  }, []);

  const productionUrl = info?.production_api_url ?? PRODUCTION_API;
  const openapiUrl =
    info?.openapi ?? `${API_ORIGIN}/api/v1/docs/openapi.yaml`;
  const swaggerUiUrl =
    info?.swagger_ui ?? `${API_ORIGIN}/api/v1/docs/ui`;

  const tags =
    info?.tags?.filter((t) => ENDPOINT_GROUPS[t]) ??
    Object.keys(ENDPOINT_GROUPS);

  const curlLogin = `curl -X POST "${productionUrl}/login" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"voce@exemplo.com","password":"senha"}'`;

  const curlTwins = `curl "${productionUrl}/twins" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "X-Tenant: UUID_DA_ORGANIZACAO"`;

  const curlSuggest = `curl -X POST "${productionUrl}/suggest" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "X-Tenant: UUID_DA_ORGANIZACAO" \\
  -H "Content-Type: application/json" \\
  -d '{"twin_id":"UUID_DO_TWIN","text":"Olá, preciso de ajuda"}'`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-3xl font-bold neon-text">Documentação da API</h1>
        <a
          href={swaggerUiUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-twin-cyan/40 px-4 py-2 text-sm text-twin-cyan transition hover:bg-twin-cyan/10"
        >
          Abrir Swagger em nova aba
        </a>
      </div>

      <div className="glass space-y-4 p-6 text-sm">
        <p>
          <span className="text-twin-muted">API de produção: </span>
          <code className="text-twin-cyan">{productionUrl}</code>
        </p>

        {info?.auth ? (
          <div className="space-y-1">
            <p className="font-medium">Autenticação</p>
            <ul className="list-inside list-disc text-twin-muted">
              <li>
                Login: <code>{info.auth.login}</code>
              </li>
              <li>
                Header: <code>{info.auth.header}</code>
              </li>
              <li>
                Tenant: <code>{info.auth.tenant}</code>
              </li>
              {info.auth.api_key && (
                <li>
                  API Key: <code>{info.auth.api_key}</code>
                </li>
              )}
            </ul>
          </div>
        ) : (
          <p className="text-twin-muted">
            Autenticação:{" "}
            <code className="text-twin-cyan">Authorization: Bearer token</code>{" "}
            +{" "}
            <code className="text-twin-cyan">X-Tenant: organization_uuid</code>
          </p>
        )}

        {error && <p className="text-amber-400">{error}</p>}

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
      </div>

      <div className="glass space-y-4 p-6">
        <h2 className="text-lg font-semibold text-twin-cyan">Início rápido</h2>
        <CurlBlock title="1. Login" code={curlLogin} />
        <CurlBlock title="2. Listar twins" code={curlTwins} />
        <CurlBlock title="3. Sugestão RAG" code={curlSuggest} />
      </div>

      <div className="glass space-y-3 p-6">
        <h2 className="text-lg font-semibold text-twin-cyan">
          Endpoints por área
        </h2>
        <div className="grid gap-2 md:grid-cols-2">
          {tags.map((tag, i) => (
            <EndpointGroup
              key={tag}
              tag={tag}
              endpoints={ENDPOINT_GROUPS[tag] ?? []}
              defaultOpen={i < 2}
            />
          ))}
        </div>
      </div>

      <iframe
        title="OpenAPI Swagger UI"
        src={swaggerUiUrl}
        className="h-[70vh] w-full rounded-lg border border-twin-cyan/20 bg-black/60"
      />
    </div>
  );
}
