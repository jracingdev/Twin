# Auditoria técnica — TWIN Platform

Data de referência: junho 2026. Escopo: `apps/api`, `apps/ai-engine`, `apps/web`, `apps/mobile`, `packages`, `docs`.

## 1. Arquitetura atual

```
Exportação (WhatsApp/Telegram/…)
    → Import API → Parser → MySQL tenant + Pinecone msgs/seller
    → ExtractDnaJob → behavioral_dna (JSON)
    → Sugestão: RAG (Pinecone) + DNA + LLM → response_suggestions

Canal tempo real (WhatsApp API):
    → Webhook → ChannelGateway → ProcessChannelMessageJob
    → approval: Inbox | auto: SendChannelMessageJob
```

**Landlord DB:** organizations, users, plans, channel_credentials, consent, audit.  
**Tenant DB:** twins, messages, DNA, suggestions, playbooks.

## 2. Gaps críticos (corrigir primeiro)

| # | Gap | Impacto |
|---|-----|---------|
| 1 | `similarity_score` e `score: 0.85` fixos | Métricas enganosas para vendas |
| 2 | DNA heurístico com valores hardcoded (empatia 55, latência 8 min) | Perfil impreciso |
| 3 | Pipeline DNA/import duplicado (sync + callback) | Dados inconsistentes |
| 4 | Feedback aceito não atualiza Pinecone | Sem aprendizado |
| 5 | `reindex` / `incremental` são stubs | Treino contínuo inexistente |
| 6 | `PurgeOrganizationJob` incompleto | Risco LGPD |
| 7 | OpenAI acoplado em `rag_engine.py` | Sem multi-modelo |
| 8 | WhatsApp `verifySignature` passa sem app_secret | Segurança |
| 9 | Cap 2000 msgs/import sem aviso | Perda silenciosa de dados |
| 10 | Horizon no Docker sem pacote composer | Filas quebradas em prod |

## 3. Segurança

**Implementado:** Sanctum, 2FA, encrypt credentials, internal secret, consent obrigatório, tenant isolation, purge twin.

**Falta:** purge org completo, processar `data_deletion_requests`, audit em suggest/channel/login, rate limit webhooks, CORS restrito no AI engine, validar consent por organization_id.

## 4. Performance

- Import síncrono até 300s
- RAG: 1 query Pinecone + 1 LLM por suggest (sem cache)
- Queue default `sync` em dev

## 5. Código duplicado

- Listas de canais em 4+ arquivos
- Channel sender factory em 2 jobs
- DNA extraction: ExtractDnaJob + Celery + callback

## 6. Schema órfão

Tabelas sem models/uso: `memory_entities`, `memory_edges`.

## 7. Maturidade por fase do prompt estratégico

| Fase prompt | Status |
|-------------|--------|
| 1 Auditoria | Este documento |
| 2 DNA Engine | Parcial (heurística v1) |
| 3 Personality Profile | Parcial (payload v1, schema v2 proposto) |
| 4 Memória vetorial | Pinecone ok; L1/L3 SQL não |
| 5 WhatsApp | Webhook texto + approval/auto |
| 6 IA híbrida | Não |
| 7 Treino contínuo | Não |
| 8 Supervisão 3 modos | 2 de 3 (approval ≈ copiloto, auto) |
| 9 Painel métricas | Parcial |
| 10 Similarity score | Não real |
| 11 LGPD | Parcial |
| 12 Escala SaaS | Design ok; ops incompleto |
| 13 Diferenciais | Não |

Ver roadmap: `docs/product/roadmap-evolucao.md`.
