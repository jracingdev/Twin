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

2. O popup detecta automaticamente se há uma aba [twin.app.br](https://twin.app.br) aberta e pode importar o token.

3. Preencha:

   - **URL da API** — padrão `https://api.twin.app.br/api/v1` (local: `http://localhost:8080/api/v1`)

   - **Token** — Bearer do login TWIN (`twin_token` no localStorage do painel web)

   - **ID da organização** — UUID (`twin_organization_id` no painel web)

   - **Twin** — selecione após clicar em *Atualizar lista*

4. Use **Validar conexão** para checar token, organização e twin.

5. Salve.



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

3. Clique em **Sugerir resposta** ou use **Ctrl+Shift+S**:

   - Usa texto **selecionado** na conversa, ou

   - A **última mensagem recebida** (incoming).

4. Revise a sugestão, score e breakdown de similaridade (formalidade, tom, vocabulário, etc.).

5. **Copiar** ou **Inserir no WhatsApp** — você envia manualmente.

6. Opcional: **Aceitar/Rejeitar** registra feedback no TWIN para treino.



---



## Arquitetura



| Arquivo | Função |

|---------|--------|

| `manifest.json` | Permissões MV3, content scripts |

| `background.js` | Chamadas à API TWIN (contorna CORS), validação de auth |

| `content.js` | DOM WhatsApp Web + painel lateral |

| `twin-auth-bridge.js` | Importa token do painel TWIN e notifica a extensão |

| `popup/` | Configurações (API, token, twin) |



As requisições usam `POST /api/v1/suggest` com headers `Authorization: Bearer …` e `X-Tenant: …`, iguais ao painel web.



---



## Seletores DOM (frágeis)



O WhatsApp Web muda o DOM sem aviso. O `content.js` usa **várias estratégias em cascata**:



### Painel principal da conversa



| Seletor | Uso |

|---------|-----|

| `#main` | Container principal (clássico) |

| `[data-testid="conversation-panel-wrapper"]` | Wrapper alternativo |

| `#pane-side ~ div` | Fallback estrutural |



### Última mensagem recebida



1. `.message-in`, `[data-testid="msg-container"].message-in`

2. `[data-icon="tail-in"]` (cauda de bolha incoming)

3. Percorrer `[data-testid="msg-container"]` de trás pra frente, ignorando `.message-out`

4. `[role="row"]` sem marcador de saída



Texto extraído via: `span.selectable-text`, `[data-testid="msg-text"]`, `.copyable-text`.



### Campo de composição



1. `footer div[contenteditable="true"][role="textbox"]`

2. `div[contenteditable="true"][data-tab="10"]`

3. `div[contenteditable="true"][data-lexical-editor="true"]`

4. `aria-label` contendo "mensagem" / "message" / "Type"

5. Último `[contenteditable="true"]` visível no `footer`



Injeção tenta: `execCommand('insertText')` → `beforeinput` + `input` → `innerText` + eventos.



### Texto selecionado



Prioriza seleção dentro de `#main`; fallback para qualquer seleção na página.



---



## Limitações conhecidas



| Limitação | Detalhe |

|-----------|---------|

| DOM instável | WhatsApp Web muda seletores com frequência; pode exigir atualização da extensão |

| Só texto | Mídia, áudio, stickers e reações não são lidos |

| Sem envio automático | Modo copiloto — humano sempre confirma o envio |

| Um twin por configuração | Troque o twin nas opções se necessário |

| CORS | Requisições passam pelo service worker (`host_permissions`); não depende de CORS da API |

| Ícones PNG | `icons/icon.svg` é a fonte; PNGs do manifest são placeholders estáticos |



---



## Solução de problemas



### Badge "Sem token" ou "Token inválido"



- Abra [twin.app.br](https://twin.app.br) logado e clique **Importar do TWIN Web**.

- Ou cole manualmente o token e org ID.

- Clique **Validar conexão** — usa `GET /me` para verificar o Bearer.



### Badge "Twin não selecionado"



- Preencha token e organização, clique **Atualizar lista** e escolha um twin.

- Salve as configurações.



### "Campo de mensagem não encontrado"



- Abra uma conversa individual (não a lista de chats).

- Recarregue o WhatsApp Web e a extensão em `chrome://extensions`.



### "Nenhuma mensagem encontrada"



- Selecione manualmente o texto na conversa, ou

- Certifique-se de haver pelo menos uma mensagem **recebida** (não enviada por você).



### Importar do TWIN Web não funciona



- A aba twin.app.br precisa estar aberta **e logada**.

- Recarregue a aba do painel após instalar/atualizar a extensão (para injetar `twin-auth-bridge.js`).

- Em dev local, use `http://localhost:3000` — está nos `host_permissions`.



### Erro 401 / 403 na sugestão



- **401**: token expirado — faça login no painel e reimporte.

- **403**: org ID incorreto — confira `twin_organization_id` no localStorage.



### Painel Copilot não aparece



- Verifique se a extensão está ativa em `web.whatsapp.com`.

- Abra o DevTools → Console e procure erros do content script.

- Recarregue a extensão e a página.



### Atalho Ctrl+Shift+S não funciona



- O foco deve estar na aba do WhatsApp Web.

- Alguns layouts do Chrome em Windows podem conflitar com atalhos do navegador.



---



## Teste manual



1. API local rodando (`php artisan serve` ou Docker na porta 8080).

2. AI Engine na porta 8000.

3. Twin com DNA treinado.

4. Configure extensão com token/tenant/twin; valide conexão no popup.

5. Abra WhatsApp Web → conversa de teste → **Sugerir resposta** (ou Ctrl+Shift+S).

6. Verifique sugestão, breakdown de similaridade e inserção no campo de composição.

7. Teste **Importar do TWIN Web** com painel aberto em outra aba.



---



## Desenvolvimento



Após alterar arquivos, recarregue a extensão em `chrome://extensions` → **Recarregar**.



Ícone SVG fonte: `icons/icon.svg` (converta para PNG 16/48/128 se atualizar os ícones do manifest).



Documentação completa (extensão + WhatsApp Business API): [docs/product/whatsapp-copilot.md](../../docs/product/whatsapp-copilot.md).

