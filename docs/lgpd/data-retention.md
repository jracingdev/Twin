# Retenção de dados

- **Mensagens brutas:** conforme `retention_policies` (padrão 365 dias)
- **Exportações S3:** removidas no purge do Twin
- **Audit logs:** 2 anos (configurável Enterprise)
- **Consent records:** imutáveis — mantidos para comprovação legal

## Exclusão

`DELETE /api/v1/twins/{id}/data` ou purge via dashboard dispara:

1. Pinecone namespaces
2. Arquivos S3
3. Registros MySQL do Twin
