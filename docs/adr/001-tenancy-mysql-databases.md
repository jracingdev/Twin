# ADR 001: Tenancy com database MySQL por tenant

## Status

Aceito

## Contexto

TWIN é SaaS multi-tenant com requisitos LGPD de isolamento.

## Decisão

`stancl/tenancy` com database `twin_tenant_{uuid}` por organização e landlord `twin_landlord`.

## Consequências

- Purge = `DROP DATABASE`
- Migrations rodadas por tenant
- Backup por database
