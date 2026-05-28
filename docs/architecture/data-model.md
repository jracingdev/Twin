# Modelo de dados

## Landlord (`twin_landlord`)

- organizations, users, organization_users
- plans, subscriptions, api_keys
- audit_logs, consent_records, data_deletion_requests

## Tenant (`twin_tenant_{uuid}`)

- twins, contacts, conversations, messages
- behavioral_dna, dna_versions
- memory_entities, memory_edges
- import_batches, training_jobs, response_suggestions
- seller_playbooks

## Índices críticos

`(twin_id, conversation_id, sent_at)` em messages.
