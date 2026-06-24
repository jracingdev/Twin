# TWIN — Roadmap de evolução (produto empresarial)

> Posicionamento comercial: **preservação de conhecimento corporativo** e **continuidade de atendimento** — não "clonagem de pessoas".

## Visão

Plataforma SaaS multi-tenant que captura padrões de comunicação a partir de exportações legítimas (WhatsApp, Telegram, etc.), gera um **perfil comportamental** (DNA) e opera um **gêmeo digital assistido** para atendimento comercial com supervisão humana.

## Estado atual (baseline)

| Capacidade | Maturidade |
|------------|------------|
| Multi-tenancy (MySQL `twin_landlord` + `twin_tenant_*`) | Alta |
| Import + parser + Pinecone RAG | Média-Alta |
| DNA heurístico | Média |
| WhatsApp webhook (texto) + approval/auto | Média-Alta |
| Inbox / Playground / Mobile Flutter | Média |
| LGPD (consent, export, purge twin) | Média |
| Similarity score real | Inexistente |
| Aprendizado contínuo | Inexistente |
| AI multi-provider | Inexistente |
| Coach / Trainer / Replay / Marketplace | Inexistente |

---

## Fase A — Fundação comercial (0–8 semanas)

**Objetivo:** produto vendável para PME com supervisão humana.

| # | Entrega | Esforço |
|---|---------|---------|
| A1 | MySQL produção + `tenants:provision` documentado | Feito |
| A2 | Inbox + conversas com sugestão + canais approval | Feito |
| A3 | Unificar pipeline DNA (um caminho sync/callback) | 3d |
| A4 | `Twin Personality Profile` v2 no payload DNA | 5d |
| A5 | Similarity score real (pós-resposta) | 5d |
| A6 | Feedback aceito → upsert Pinecone | 3d |
| A7 | Enforcement planos (mensagens/mês, seller_mode) | 2d |
| A8 | Purge organização completo + job deletion request | 5d |
| A9 | Segurança webhooks (app_secret obrigatório, sem token em list) | 2d |

**KPI de saída:** taxa de aceite de sugestões > 60% em piloto; tempo médio revisão < 2 min.

---

## Fase B — Twin DNA Engine avançado (8–16 semanas)

**Objetivo:** ficha comportamental rica, não só radar heurístico.

| # | Entrega |
|---|---------|
| B1 | Módulo `twin_dna_engine` — análise linguística + comportamental + psicológica estimada |
| B2 | Latência real de resposta a partir de `messages.sent_at` |
| B3 | Detecção objeções / follow-up / abertura-fechamento |
| B4 | LLM assistido para enriquecer perfil (batch, não tempo real) |
| B5 | API `GET /twins/{id}/personality-profile` |
| B6 | Twin Evolution — diff entre `dna_versions` na timeline |

---

## Fase C — IA híbrida + RAG maduro (12–20 semanas)

| # | Entrega |
|---|---------|
| C1 | Interface `LLMProvider` (OpenAI, Anthropic, Gemini, Ollama) |
| C2 | Config por tenant/plano em `organizations.data` |
| C3 | Wire Redis working memory no RAG |
| C4 | Popular namespace `contacts` e `memory` |
| C5 | Reindex real + incremental (feedback → vetores) |
| C6 | Score de retrieval + rerank opcional |

---

## Fase D — WhatsApp / Telegram produção (paralelo Fase A)

| # | Entrega |
|---|---------|
| D1 | Idempotência webhook (`message_id` Meta) |
| D2 | Modo **Assistente** (só sugere, nunca envia) |
| D3 | Modo **Copiloto** (= approval atual) |
| D4 | Modo **Autônomo** com threshold de confiança |
| D5 | Mídia básica (imagem → OCR ou "não suportado" elegante) |
| D6 | Métricas canal: tempo resposta, volume, aceite |

---

## Fase E — Diferenciais competitivos (20–36 semanas)

| Produto | Descrição |
|---------|-----------|
| **Twin Coach** | Explica por que sugeriu X (cita chunks Pinecone + traits DNA) |
| **Twin Trainer** | Simulações para novos vendedores com scoring |
| **Twin Replay** | Replay de conversas reais usadas no contexto |
| **Twin Evolution** | Gráfico de evolução do perfil ao longo do tempo |
| **Twin Marketplace** | Perfis especializados compartilháveis entre orgs (B2B) |

---

## Fase F — Escala SaaS (contínuo)

- Filas: Redis + workers dedicados (import, channel, dna, suggest)
- Observabilidade: métricas LLM, latência Pinecone, fila depth
- Cache: respostas frequentes por intent (Redis)
- K8s / horizontal scaling AI engine
- Backup automatizado `twin_*` databases
- Rate limiting por tenant

---

## Stack recomendada (produção)

| Camada | Atual | Evolução |
|--------|-------|----------|
| DB central + tenant | MySQL 8 | MySQL 8 (PostgreSQL opcional futuro) |
| Vetores | Pinecone integrated | Manter + FTS híbrido se necessário |
| LLM | OpenAI hardcoded | Provider abstraction |
| Filas | sync/database | Redis + Horizon ou equivalente |
| Cache | Redis parcial | Redis tenant-scoped |

---

## Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| LGPD / imagem "clonagem" | Consentimento explícito; posicionamento "conhecimento corporativo"; purge |
| Alucinação IA | RAG + guardrails + human-in-the-loop default |
| Vazamento cross-tenant | Namespace Pinecone + DB isolado + testes |
| Dependência OpenAI | Multi-provider + fallback |
