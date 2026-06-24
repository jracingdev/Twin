# TWIN Copilot — Extensão WhatsApp Web

Extensão Chrome/Edge (Manifest V3) que integra o **TWIN** ao [WhatsApp Web](https://web.whatsapp.com) em **modo copiloto**: lê a conversa, gera sugestão via API e permite copiar ou inserir no campo de mensagem — **sem envio automático**.

> Esta extensão **não** usa APIs não oficiais do WhatsApp. Apenas leitura/injeção no DOM do navegador.

---

## Instalação (modo desenvolvedor)

1. Abra `chrome://extensions` (Chrome) ou `edge://extensions` (Edge).
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta `apps/browser-extension/` deste repositório.

---

## Configuração

1. Clique no ícone da extensão na barra de ferramentas.
2. Preencha:
   - **URL da API** — padrão `https://api.twin.app.br/api/v1` (local: `http://localhost:8080/api/v1`)
   - **Token** — Bearer do login TWIN (`twin_token` no localStorage do painel web)
   - **ID da organização** — UUID (`twin_organization_id` no painel web)
   - **Twin** — selecione após clicar em *Atualizar lista*
3. Opcional: com o painel [twin.app.br](https://twin.app.br) aberto e logado, use **Importar do TWIN Web**.
4. Salve.

### Onde encontrar token e tenant no painel web

No navegador, com sessão ativa em twin.app.br:

```javascript
localStorage.getItem('twin_token')
localStorage.getItem('twin_organization_id')
```

---

## Uso no WhatsApp Web

1. Acesse [web.whatsapp.com](https://web.whatsapp.com) e abra uma conversa.
2. Um painel **TWIN Copilot** aparece à direita (recolhível).
3. Clique em **Sugerir resposta**:
   - Usa texto **selecionado** na conversa, ou
   - A **última mensagem recebida** (incoming).
4. Revise a sugestão, score e breakdown de similaridade.
5. **Copiar** ou **Inserir no WhatsApp** — você envia manualmente.
6. Opcional: **Aceitar/Rejeitar** registra feedback no TWIN para treino.

---

## Arquitetura

| Arquivo | Função |
|---------|--------|
| `manifest.json` | Permissões MV3, content scripts |
| `background.js` | Chamadas à API TWIN (contorna CORS) |
| `content.js` | DOM WhatsApp Web + painel lateral |
| `twin-auth-bridge.js` | Importa token do painel TWIN |
| `popup/` | Configurações (API, token, twin) |

As requisições usam `POST /api/v1/suggest` com headers `Authorization: Bearer …` e `X-Tenant: …`, iguais ao painel web.

---

## Limitações conhecidas

| Limitação | Detalhe |
|-----------|---------|
| DOM instável | WhatsApp Web muda seletores com frequência; pode exigir atualização da extensão |
| Só texto | Mídia, áudio, stickers e reações não são lidos |
| Sem envio automático | Modo copiloto — humano sempre confirma o envio |
| Um twin por configuração | Troque o twin nas opções se necessário |
| CORS | Requisições passam pelo service worker (`host_permissions`); não depende de CORS da API |

---

## Teste manual

1. API local rodando (`php artisan serve` ou Docker na porta 8080).
2. AI Engine na porta 8000.
3. Twin com DNA treinado.
4. Configure extensão com token/tenant/twin.
5. Abra WhatsApp Web → conversa de teste → **Sugerir resposta**.
6. Verifique sugestão e inserção no campo de composição.

---

## Desenvolvimento

Após alterar arquivos, recarregue a extensão em `chrome://extensions` → **Recarregar**.

Documentação completa (extensão + WhatsApp Business API): [docs/product/whatsapp-copilot.md](../../docs/product/whatsapp-copilot.md).
