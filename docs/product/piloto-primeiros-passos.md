# Primeiros passos — piloto (do zero ao primeiro reply automático)

Objetivo: em um ambiente local ou VPS, clonar o melhor vendedor e receber a **primeira resposta automática** no WhatsApp Business ou Telegram.

## 1. Subir a stack

```powershell
cd d:\twin
.\scripts\local\setup.ps1   # se existir
.\scripts\local\start.ps1
```

Ou manualmente: API (`8080`), AI Engine (`8000`), Web (`3000`), Redis, MySQL.

## 2. Segredos mínimos

Em `apps/api/.env` e `apps/ai-engine/.env`:

- `AI_ENGINE_SECRET` **igual** nos dois
- `QUEUE_CONNECTION=redis`
- `OPENAI_API_KEY` (recomendado para piloto real)
- `PINECONE_API_KEY` (recomendado para RAG)

## 3. Migrar e provisionar

```powershell
cd apps\api
composer install
php artisan migrate --path=database/migrations/landlord --force
php artisan db:seed --force
php artisan tenants:provision --seed
```

## 4. Worker com fila channel

```powershell
cd apps\api
php artisan queue:work redis --queue=default,channel --sleep=3 --tries=3
```

Sem `channel`, o webhook não gera resposta.

## 5. Login e twin

1. Abra o Web → login (demo se seedado).
2. Crie/selecione o twin do melhor vendedor.
3. Ative **Modo vendedor** e salve.

## 6. Importar conversas

1. [/import](/import) → canal WhatsApp/Telegram.
2. Informe o **nome do vendedor** como no export.
3. Envie o arquivo → aguarde DNA.

## 7. Conectar canal (owner/admin)

1. [/settings/channels](/settings/channels).
2. Twin certo → WhatsApp Business **ou** Telegram.
3. Modo **Agente**, limiar 70–75%.
4. Credenciais (Telegram: gere `secret_token`).
5. Copie a URL do webhook.

## 8. Registrar webhook

- **WhatsApp:** Meta → Callback URL + Verify Token.
- **Telegram:** `setWebhook` com `url` + `secret_token`.

Detalhes: [connect-channels-seller.md](./connect-channels-seller.md).

## 9. Mensagem de teste

Envie **texto** ao número Business / bot.

- Score ≥ limiar → reply automático.
- Score &lt; limiar → [/inbox](/inbox) (aprovar e enviar).

## 10. Se não responder

| Sintoma | Checagem |
|---------|----------|
| Webhook 200, silêncio | Worker com fila `channel`? |
| 403 Telegram | `secret_token` no setWebhook = Twin? |
| 403 WhatsApp | `app_secret` e assinatura? |
| Sugestão vazia | AI Engine up? `AI_ENGINE_SECRET`? |
| Tom genérico | `owner_name` no import? seller_mode? Pinecone? |

## 11. Copiloto (opcional)

WhatsApp Web pessoal: extensão em `apps/browser-extension` — só sugestão.

## 12. Produção (VPS)

Checklist em [channels.md](./channels.md) + Supervisor `default,channel` em `infra/aapanel/supervisor-twin.conf.example`.

---

Docs relacionados: [seller-clone-agent.md](./seller-clone-agent.md) · [connect-channels-seller.md](./connect-channels-seller.md) · [channels.md](./channels.md)
