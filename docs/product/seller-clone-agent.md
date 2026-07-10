# Clonar o melhor vendedor → agente live

Playbook do caso de uso principal do TWIN.

## Fluxo

```text
Export do melhor vendedor
  → /import (owner_name + twin)
  → DNA + Pinecone (msgs/seller) + playbooks MySQL
  → Twin: seller_mode + intensidade
  → /settings/channels (WA Business ou Telegram, modo Agente)
  → Worker fila channel
  → Cliente manda texto → clone responde
```

## Passos

1. Crie o twin (nome do vendedor / time).
2. Exporte conversas oficiais (WhatsApp ou Telegram).
3. [/import](/import): canal, twin, **nome do vendedor no export**, arquivo, consentimento.
4. Aguarde status Concluído (DNA automático).
5. Twin → **Modo vendedor** + intensidade 2–4 → Salvar.
6. Opcional: [/playground](/playground) para testar o tom.
7. [/settings/channels](/settings/channels): conectar canal ao twin (owner/admin).
8. Modo **Agente** + limiar ~75% (ou Copiloto + Inbox).
9. Worker: `php artisan queue:work redis --queue=default,channel`.
10. Mensagem de teste → reply automático ou Inbox.

## O que o motor faz

- **DNA** (`writing_style`): formalidade, emojis, gírias, saudações, comprimento.
- **RAG**: exemplos do vendedor (sem filtrar pelo UUID do cliente live).
- **seller_mode**: playbooks + detecção de oportunidade.
- **Intensidade**: temperature + few-shot + pós-processamento de estilo.
- **Canais**: respostas curtas, sem markdown.

## Conexão controlada

Ver [connect-channels-seller.md](./connect-channels-seller.md).

## Limitações

- Sem fine-tune LoRA — LLM + RAG + DNA.
- Sem auto-send em WhatsApp Web pessoal.
- Cap ~2000 msgs/import; DNA nas últimas ~500 do vendedor.
