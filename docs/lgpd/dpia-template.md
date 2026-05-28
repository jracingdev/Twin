# DPIA — TWIN Platform (template)

## Finalidade

Treinar gêmeo digital comunicativo a partir de exportações fornecidas pelo titular.

## Base legal

Consentimento explícito (Art. 7º, I, LGPD).

## Dados tratados

Mensagens, metadados de conversa, perfil comportamental derivado.

## Medidas

- Isolamento por tenant (database MySQL)
- Criptografia em trânsito (TLS) e repouso (S3, encrypted casts)
- Exclusão via `purge_tenant`
- Auditoria em `audit_logs`

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Vazamento | MFA, API keys com hash |
| Alucinação IA | RAG + guardrails |
| Retenção excessiva | Políticas configuráveis |
