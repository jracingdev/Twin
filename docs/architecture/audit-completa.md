# Auditoria técnica — TWIN Platform

Data de referência: junho 2026 (atualizado jul/2026 — sessão de hardening P0/P1/P2).  
Escopo: `apps/api`, `apps/ai-engine`, `apps/web`, `apps/mobile`, `packages`, `docs`.

## 1. Arquitetura atual

```
Exportação (WhatsApp/Telegram/…)
    → Import API → Parser → MySQL tenant + Pinecone msgs/seller
    → ExtractDnaJob → behavioral_dna (JSON)
    → Sugestão: RAG (Pinecone) + DNA + LLM → response_suggestions

Canal tempo real (WhatsApp API):
    → Webhook → ChannelGateway → ProcessChannelMessageJob
    → assistant: sugestão interna | copilot: approval inbox | auto: SendChannelMessageJob
```

**Landlord DB:** organizations, users, plans, channel_credentials, consent, audit.  
**Tenant DB:** twins, messages, DNA, suggestions, playbooks.

## 2. Gaps críticos — status (jul/2026)

| # | Gap | Status |
|---|-----|--------|
| 1 | `similarity_score` e `score: 0.85` fixos | Aberto (produto) |
| 2 | DNA heurístico com valores hardcoded | Aberto (produto) |
| 3 | Pipeline DNA/import duplicado | Aberto |
| 4 | Feedback aceito não atualiza Pinecone | Aberto |
| 5 | `reindex` / `incremental` são stubs | Aberto |
| 6 | `PurgeOrganizationJob` incompleto | Aberto (purge twin melhorado) |
| 7 | OpenAI acoplado em `rag_engine.py` | Aberto |
| 8 | WhatsApp `verifySignature` passa sem app_secret | **Corrigido** — fail-closed |
| 9 | Cap 2000 msgs/import sem aviso | **Corrigido** — `warning` + `truncated` no response |
| 10 | Horizon no Docker sem pacote composer | **Corrigido** — `queue:work` no Compose |

### Correções desta sessão (P0 / P1 / P2)

| Área | Correção |
|------|----------|
| LGPD | `ProcessDataDeletionRequestJob` só marca `acknowledged` (revisão admin ≤30 dias); **não** dispara `PurgeOrganizationJob` |
| Stripe | Webhook fail-closed: production sem secret → 503; secret ou production → exige assinatura |
| Filas | Compose usa `php artisan queue:work redis --queue=default,channel` (serviço `queue-worker`) |
| RBAC | `role:owner` / `role:owner,admin` em billing checkout/portal, purge twin, API keys, channel credentials CUD, LGPD deletion, webhook settings |
| Canais | WhatsApp/Slack/Discord: sem secret/key → `verifySignature` = false; Telegram valida `X-Telegram-Bot-Api-Secret-Token` se `secret_token` nas credentials |
| Rate limit | `throttle:10,1` login; `5,1` register/forgot/reset; `60,1` Stripe; `120,1` channel webhooks |
| SSRF | `WebhookDispatcher::assertSafeUrl` bloqueia privados/localhost/link-local/metadata; usado em dispatch + settings test/update |
| AI CORS | Sem `CORS_ORIGINS` → sem middleware `*`; origins via env; nginx `/ai/` documentado como interno |
| Modos | `assistant` = pending sem `platform_meta` / sem botão enviar canal; `copilot` = `requires_approval: true` |
| Purge twin | Limpa suggestions, DNA, memory entities/edges, conversations, playbooks, training jobs |

## 3. Segurança

**Implementado:** Sanctum, 2FA, encrypt credentials, internal secret, consent obrigatório, tenant isolation, purge twin ampliado, RBAC em rotas sensíveis, webhooks fail-closed, SSRF blocklist, Stripe fail-closed, rate limits auth/webhooks, CORS AI restrito.

**Ainda aberto (fora desta rodada):** auth web httpOnly cookies, middleware `api.key` nas rotas de produto, purge org completo + DPIA, k8s/terraform.

## 4. Performance

- Import síncrono até 300s
- RAG: 1 query Pinecone + 1 LLM por suggest (sem cache)
- Queue default `sync` em dev; Compose usa Redis + `queue:work`

## 5. Código duplicado

- Listas de canais em 4+ arquivos
- Channel sender factory em 2 jobs
- DNA extraction: ExtractDnaJob + Celery + callback

## 6. Schema

`memory_entities` / `memory_edges` em uso via API e purge.

## 7. Maturidade por fase do prompt estratégico

| Fase prompt | Status |
|-------------|--------|
| 1 Auditoria | Este documento |
| 2 DNA Engine | Parcial (heurística v1) |
| 3 Personality Profile | Parcial (payload v1, schema v2 proposto) |
| 4 Memória vetorial | Pinecone ok; L1/L3 SQL parcial |
| 5 WhatsApp | Webhook texto + assistant/copilot/auto |
| 6 IA híbrida | Não |
| 7 Treino contínuo | Não |
| 8 Supervisão 3 modos | **3 de 3** (assistant / copilot / auto) |
| 9 Painel métricas | Parcial |
| 10 Similarity score | Não real |
| 11 LGPD | Pedido de exclusão acknowledged (sem purge imediato); export ok |
| 12 Escala SaaS | Design ok; ops com queue:work |
| 13 Diferenciais | Não |

Ver roadmap: `docs/product/roadmap-evolucao.md`.
