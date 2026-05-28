# ADR 002: Pinecone para vetores, MySQL para relacional

## Decisão

Pinecone integrated index (`multilingual-e5-large`) para RAG; MySQL 8 para dados estruturados e DNA JSON.

## Motivo

Embeddings gerenciados, escala sem operar Qdrant na VPS.
