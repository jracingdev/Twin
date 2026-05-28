# Canais de importação (exportações oficiais)

O TWIN treina o DNA comportamental **somente** a partir de ficheiros que o utilizador exporta legalmente das plataformas e envia para importação. Não há sincronização em tempo real, webhooks Meta Cloud API nem TDLib para fins de treino.

## Fontes suportadas

| Canal | Formato | Origem |
|-------|---------|--------|
| `whatsapp` | `.txt` | Exportar conversa no app |
| `telegram` | `result.json` | Telegram Desktop → Exportar dados |
| `instagram` | `.json` / `.zip` | Centro de Contas Meta → Transferir informações |
| `facebook` | `.json` / `.zip` | facebook.com/dyi → Mensagens (JSON) |
| `messenger` | `.json` / `.zip` | Mesmo fluxo Meta, pasta `messages/inbox/` |
| `email` | `.eml`, `.csv` | Exportação manual |
| `zip` | `.zip` | Pacote com vários ficheiros acima |

## Fluxo

1. Utilizador exporta dados na plataforma oficial.
2. Seleciona o canal e o twin na UI (`/import` ou `/import/channels`).
3. API valida consentimento LGPD, grava o ficheiro e enfileira `ProcessImportBatchJob`.
4. Motor de IA (`parse_export`) normaliza para `ParsedMessage` com campo `channel`.
5. Mensagens do utilizador são indexadas no Pinecone e persistidas para treino de DNA.

## ZIP

- Tamanho máximo de upload: 512 MB (API).
- Extração segura: sem path traversal, limite de 500 ficheiros e 100 MB descomprimidos.
- O parâmetro `channel` é obrigatório em uploads ZIP para orientar o parser.

## LGPD

- É necessário `consent_id` válido antes do upload.
- O utilizador deve ser titular ou ter base legal para processar as conversas importadas.
- Dados podem ser eliminados via purge do twin em Configurações → LGPD.

## O que não está incluído

- Meta Cloud API webhooks para treino
- Telegram TDLib / leitura ao vivo de mensagens para DNA
- Ingestão contínua sem exportação explícita do utilizador

A sincronização business em tempo real está prevista como fase futura e **não** alimenta o treino de DNA.

## Referências oficiais

- [WhatsApp — exportar histórico](https://faq.whatsapp.com/general/chats/how-to-export-your-chat-history)
- [Telegram — exportar dados](https://telegram.org/blog/export-and-iphone-import)
- [Meta — transferir informações (Instagram)](https://accountscenter.instagram.com/info_and_permissions/dyi/)
- [Facebook — download dos seus dados](https://www.facebook.com/dyi)
