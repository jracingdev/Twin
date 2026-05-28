# TWIN — Visão do sistema

TWIN é uma plataforma SaaS multi-tenant que cria um **gêmeo digital comunicativo** a partir de conversas exportadas pelo usuário.

## Componentes

| Serviço | Função |
|---------|--------|
| `apps/api` | Laravel — auth, billing, imports, API pública |
| `apps/ai-engine` | FastAPI — DNA, RAG, Pinecone, modo vendedor |
| `apps/web` | Next.js — dashboard futurista |
| `apps/mobile` | Flutter — import e sugestões |
| `packages/import-parsers` | Parsers WhatsApp, Telegram, email |
| `packages/sdk-ts` | SDK TypeScript |

## Fluxo principal

1. Consentimento LGPD
2. Upload de exportação
3. Parser → MySQL + Pinecone
4. Extração Behavioral DNA
5. Sugestão de respostas via RAG

## Infraestrutura

Deploy inicial em **VPS + Docker Compose**. Ver [vps-quickstart](../deployment/vps-quickstart.md).
