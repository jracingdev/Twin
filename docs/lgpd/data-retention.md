# Retenção de dados

- **Mensagens brutas:** conforme `retention_policies` (padrão 365 dias)
- **Sugestões:** mesmo prazo quando `auto_purge` está ativo
- **Exportações (disk):** removidas no purge do Twin / organização
- **Audit logs:** 2 anos (configurável Enterprise); apagados no purge completo da org
- **Consent records:** imutáveis durante a vida da org — mantidos para comprovação legal; removidos apenas no purge da organização

## Auto-purge agendado

Comando Artisan: `php artisan lgpd:apply-retention`

- Agenda diária em `routes/console.php` (`03:15`)
- Percorre organizações (tenant), lê `RetentionPolicy` com `auto_purge = true`
- Apaga em chunks mensagens com `sent_at` anterior ao cutoff e sugestões com `created_at` anterior ao cutoff
- Flags: `--org=` (UUID), `--dry-run`

Sem `auto_purge`, a política só informa o prazo — exclusão manual via purge de Twin/org.

## Exportação LGPD (titular)

`POST /api/v1/lgpd/exports` → `ProcessExportRequestJob`:

- Gera ZIP em storage (`exports/{org}/{id}.zip`) com:
  - `manifest.json`, `twins.json`, `contacts.jsonl`, `conversations.jsonl`, `messages.jsonl`, `suggestions.jsonl`, `consents.json`
- Mensagens e demais coleções grandes via cursor/`chunkById` (sem limite artificial de 500)
- Metadados de sugestões/mensagens sanitizados (sem tokens/secrets)
- Download: `GET /api/v1/lgpd/exports/{id}/download`

## Exclusão de Twin

`DELETE /api/v1/twins/{id}/data` ou purge via dashboard dispara:

1. Pinecone / AI engine (`purgeTenant`)
2. Arquivos S3/disk do Twin (`imports/{twinId}`)
3. Registros MySQL do Twin (suggestions, DNA, memory, conversations, playbooks, training)

## Exclusão de organização

`PurgeOrganizationJob` (admin/manual — **não** disparado automaticamente por pedido de exclusão LGPD):

1. Purge AI engine por twin
2. Storage tenant + `exports/{org}` + `imports/{twin}`
3. Channel credentials, API keys e audit logs da org; detach de `organization_users`
4. `Organization::delete()` → evento tenancy `TenantDeleted` → `DeleteDatabase` (banco tenant)

Pedido de exclusão (`ProcessDataDeletionRequestJob`) apenas marca `acknowledged` para revisão admin (≤30 dias).
