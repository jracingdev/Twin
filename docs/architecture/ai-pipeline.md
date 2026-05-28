# Pipeline de IA

## Ingestão

`POST /ai/ingest/batch` → parser → upsert Pinecone (`msgs`, `seller`).

## DNA comportamental

`POST /ai/dna/extract` → estatísticas lexicais + estrutura JSON versionada.

## Resposta (RAG)

1. Memória working (Redis)
2. Retrieval Pinecone (msgs, memory, contacts)
3. Prompt com DNA + intensidade (1–4)
4. LLM OpenAI ou fallback
5. Pós-processamento estilístico

## Modo vendedor

Playbooks em namespace `seller` — motopeças, autopeças, ERP.

## Pinecone

Índice: `twin-integrated`  
Namespaces: `t_{tenant}_tw_{twin}_{msgs|memory|seller|contacts}`
