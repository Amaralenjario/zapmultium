# Integração de Mensagens — ZapMultium ⇄ EvoHub ⇄ WhatsApp

Documento de referência pra **outro sistema** entender como o ZapMultium **envia** e
**recebe** cada tipo de mensagem de WhatsApp. Toda a comunicação passa pela **EvoHub**,
que é um **proxy da WhatsApp Cloud API da Meta** — ou seja, **o formato dos payloads é o
da Meta Cloud API**, só que autenticando na EvoHub.

---

## 1. Arquitetura em uma imagem

```
                 ENVIAR (outbound)                         RECEBER (inbound)
  ┌────────────┐   POST /messages    ┌─────────┐          ┌─────────┐  webhook   ┌──────────────────────┐
  │  ZapMultium│ ──────────────────▶ │ EvoHub  │ ───────▶ │  Meta   │ ─────────▶ │ Edge Function        │
  │ (Next.js)  │   Bearer <token>    │ (proxy) │          │WhatsApp │            │ evohub-webhook (Deno)│
  └────────────┘                     └─────────┘          └─────────┘            └──────────┬───────────┘
        ▲                                                                                   │ grava
        │  realtime (Supabase) + poll                                                       ▼
        └───────────────────────────────────────────────────────────────────────  Postgres (messages)
```

- **Enviar:** o sistema faz `POST` na EvoHub, ela repassa pra Meta.
- **Receber:** a Meta manda o evento pra EvoHub, a EvoHub reposta (webhook) pra a **Supabase
  Edge Function** `evohub-webhook`, que grava na tabela `messages`. **A ingestão real NÃO é
  uma rota Next.js — é a Edge Function.**

---

## 2. URLs e autenticação

| O quê | Valor |
|---|---|
| **API da EvoHub** (enviar/listar) | `https://api.evohub.ai` |
| **Webhook** (EvoHub → nós) | `https://ryurgbutqcgmicqqvols.supabase.co/functions/v1/evohub-webhook` |
| **Link de conexão** (QR/conectar número) | `https://app.evohub.evolutionfoundation.com.br/connect/{channel_token}` |

Autenticação em **duas camadas**:

1. **API key da conta EvoHub** (`evh_pk_...`) → usada só pra **gerenciar canais** (listar/criar) e
   **descobrir o token do canal**:
   ```
   GET https://api.evohub.ai/api/v1/channels          (lista os canais da conta)
   GET https://api.evohub.ai/api/v1/channels/{id}      (detalhe → campo .token)
   Header: Authorization: Bearer <API_KEY_DA_CONTA>
   ```
2. **Token do canal** (`.token` do canal, muda quando reconecta) → usado pra **enviar mensagem**
   e **subir mídia** daquele número:
   ```
   Header: Authorization: Bearer <CHANNEL_TOKEN>
   ```

> ⚠️ O token do canal **rotaciona** (reconectar o número gera token novo). Sempre resolva o token
> fresco a partir do `GET /channels/{id}` (com cache curto). Nunca chumbe token no código.

**Identificadores:**
- `phone_number_id` — o ID do número na Meta (ex.: `976034132269824`). Vai na **URL** de envio.
- `channel_id` (EvoHub, UUID) — identifica o canal na EvoHub; serve pra pegar o token.
- `to` — telefone do cliente em formato internacional só dígitos (ex.: `5511980349233`).

---

## 3. ENVIAR mensagens (outbound)

**Endpoint único** (formato Meta Cloud API):

```
POST https://api.evohub.ai/meta/v23.0/{phone_number_id}/messages
Authorization: Bearer <CHANNEL_TOKEN>
Content-Type: application/json
```

O corpo muda por tipo. Em **todos**: `messaging_product: "whatsapp"` + `to` + `type`.

### 3.1 Texto
```json
{ "messaging_product": "whatsapp", "to": "5511980349233", "type": "text",
  "text": { "body": "Olá! Tudo bem?" } }
```

### 3.2 Imagem  (aceita legenda)
```json
{ "messaging_product": "whatsapp", "to": "5511980349233", "type": "image",
  "image": { "link": "https://.../foto.jpg", "caption": "Olha essa" } }
```

### 3.3 Vídeo  (aceita legenda)
```json
{ "messaging_product": "whatsapp", "to": "5511980349233", "type": "video",
  "video": { "link": "https://.../video.mp4", "caption": "..." } }
```

### 3.4 Documento  (aceita legenda + filename)
```json
{ "messaging_product": "whatsapp", "to": "5511980349233", "type": "document",
  "document": { "link": "https://.../catalogo.pdf", "filename": "catalogo.pdf", "caption": "..." } }
```

### 3.5 Sticker
```json
{ "messaging_product": "whatsapp", "to": "5511980349233", "type": "sticker",
  "sticker": { "link": "https://.../fig.webp" } }
```

### 3.6 Áudio (mensagem de voz)  — 2 passos
O áudio nativo (aparecer como "voz") precisa de `media_id`. Fluxo:

**Passo 1 — subir a mídia** (recomendado converter pra **OGG/Opus** antes):
```
POST https://api.evohub.ai/meta/v23.0/{phone_number_id}/media
Authorization: Bearer <CHANNEL_TOKEN>
Content-Type: multipart/form-data
  file: <binário .ogg>   (Blob type "audio/ogg", filename "audio.ogg")
  type: audio/ogg
  messaging_product: whatsapp
→ resposta: { "id": "<MEDIA_ID>" }
```
**Passo 2 — enviar como voz:**
```json
{ "messaging_product": "whatsapp", "to": "5511980349233", "type": "audio",
  "audio": { "id": "<MEDIA_ID>", "voice": true } }
```
> Fallback (se não conseguir `media_id`): `"audio": { "link": "https://.../audio.ogg", "voice": true }`.
> **Nunca** mande áudio como `document`.

### 3.7 Responder/citar uma mensagem (reply)
Some `context` em qualquer envio, apontando pro `wa_message_id` da mensagem citada:
```json
{ "messaging_product": "whatsapp", "to": "...", "type": "text",
  "text": { "body": "isso!" }, "context": { "message_id": "wamid.HBg..." } }
```

### 3.8 Reação (emoji)
```json
{ "messaging_product": "whatsapp", "recipient_type": "individual", "to": "...",
  "type": "reaction", "reaction": { "message_id": "wamid.HBg...", "emoji": "❤️" } }
```
> Para **remover** a reação, mande `"emoji": ""`.

### 3.9 Marcar como lida (read receipt)  — o "visto azul" do atendente
```json
{ "messaging_product": "whatsapp", "status": "read", "message_id": "wamid.HBg..." }
```

### Resposta de sucesso (todos os envios)
```json
{ "messages": [ { "id": "wamid.HBg..." } ] }
```
Guarde esse `id` (`wa_message_id`) — é a chave pra casar status (entregue/lida) e dedup depois.

---

## 4. RECEBER mensagens (inbound)

A EvoHub faz `POST` no **webhook** com o **payload da Meta**. Estrutura:

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "<waba_id>",
    "changes": [{
      "field": "messages",
      "value": {
        "metadata": { "phone_number_id": "976034132269824" },
        "contacts": [{ "wa_id": "5511980349233", "profile": { "name": "ClosetOlim" } }],
        "messages": [ { /* ...ver por tipo abaixo... */ } ],
        "statuses": [ { /* ...read receipts / falhas... */ } ]
      }
    }]
  }]
}
```

**Regras de leitura:**
- Só processe `change.field === "messages"`.
- `value.messages[]` = mensagens **recebidas** do cliente.
- `value.statuses[]` = status das mensagens que **você enviou** (entregue/lida/falha).
- O telefone do cliente = `messages[0].from` (ou `contacts[0].wa_id`).
- Cada mensagem tem `id` (= `wa_message_id`, único — use pra **dedup**) e `timestamp` (Unix segundos).
- **Verificação do webhook** (Meta handshake): `GET` com `hub.mode=subscribe` + `hub.verify_token` →
  responder o `hub.challenge` se o token bater.

### 4.1 Campo por tipo de mensagem recebida

| `type` | Onde está o conteúdo | Vira no sistema |
|---|---|---|
| `text` | `msg.text.body` | texto |
| `image` | `msg.image.id` (media) + `msg.image.caption` | "🖼 Imagem" / caption, `content_type=image` |
| `video` | `msg.video.id` + `msg.video.caption` | vídeo |
| `audio` | `msg.audio.id` | "🎤 Áudio", `content_type=audio` |
| `document` | `msg.document.id` + `msg.document.filename` | nome do arquivo |
| `sticker` | `msg.sticker.id` | sticker |
| `location` | `msg.location` (lat/long) | "📍 Localização" |
| `button` | `msg.button.text` | texto do botão |
| `interactive` | `msg.interactive.button_reply.title` **ou** `.list_reply.title` | opção escolhida |
| `reaction` | `msg.reaction.message_id` + `msg.reaction.emoji` | **atualiza** a msg reagida (ver 4.2) |
| `contacts` | `msg.contacts` | "👤 Contato" |

Exemplo de **texto recebido**:
```json
{ "id": "wamid.HBgNNTUxMTk4MDM0OTIzMxUC...", "from": "5511980349233",
  "timestamp": "1755036868", "type": "text",
  "text": { "body": "Tenho dúvida, o mapa é só pra roupas?" } }
```

Baixar a **mídia** recebida (image/audio/video/document): use o `id` da mídia →
`GET https://api.evohub.ai/meta/v23.0/{media_id}` com o token do canal (retorna a URL/binário).

### 4.2 Reação recebida (IMPORTANTE p/ quem lê o banco)
Reação **não vira uma linha nova** em `messages`. Ela **atualiza** a mensagem-alvo:
```json
{ "type": "reaction", "reaction": { "message_id": "wamid.<alvo>", "emoji": "❤️" } }
```
→ o sistema acha a msg com `wa_message_id == message_id` e grava
`metadata.reactions[<telefone>] = "❤️"` (emoji `""` remove). **Por isso, ao comparar "o que a
Meta entregou" × "linhas em messages", reações aparecem como se tivessem sumido — mas é o
comportamento correto.**

### 4.3 Status recebido (das SUAS mensagens)
```json
{ "id": "wamid.<da sua msg>", "status": "read",   "timestamp": "1755..." }   // cliente leu
{ "id": "wamid.<da sua msg>", "status": "failed", "errors": [ { "code": 131047, "title": "..." } ] }
```
- `read` → grava `read_at` na sua mensagem (dois tiques azuis).
- `failed` → marca a mensagem como falha com o motivo.

---

## 5. Como o dado fica no banco (tabela `messages`)

Campos relevantes pra outro sistema **ler**:

| Coluna | Descrição |
|---|---|
| `conversation_id` | conversa (1 ativa por cliente **por número**) |
| `sender_type` | `customer` (recebida) \| `agent` (enviada) \| `bot` (fluxo) \| `system` (nota interna) |
| `content` | texto ou rótulo da mídia |
| `content_type` | `text` \| `image` \| `video` \| `audio` \| `document` \| `sticker` \| `location` |
| `metadata.wa_message_id` | id da Meta (**dedup** e casar status) |
| `metadata.phone_number_id` | canal que recebeu/enviou |
| `metadata.media_id` / `caption` / `context` / `reactions` | mídia, legenda, citação, reações |
| `read_at` | quando o cliente leu a sua mensagem |
| `created_at` | horário (recebida = `msg.timestamp` da Meta) |

**Tempo-real:** as tabelas `messages` e `conversations` estão publicadas no
`supabase_realtime` → dá pra assinar `postgres_changes` (INSERT/UPDATE) e receber na hora
(a RLS exige usuário **authenticated**).

---

## 6. Confiabilidade — o que outro sistema precisa respeitar

- **Idempotência (dedup):** sempre chave por `wa_message_id`. A EvoHub **reenvia o webhook até
  3x** — trate reentrega como no-op (não duplique).
- **Retry de envio SEM duplicar:** só repita o envio quando tiver **certeza de que NÃO entregou**:
  - Meta rejeitou explícito: `131000` (Something went wrong), `2`, `1`, `368`, `131056`, `190`/`UNAUTHORIZED`.
  - EvoHub não conectou na Meta: erro com `dial tcp` / DNS / `ECONNREFUSED` / `ENOTFOUND`.
  - **Timeout de leitura / 5xx genérico / exceção ambígua → NÃO repita** (a msg pode ter ido).
  - No `UNAUTHORIZED`/`190`, **renove o token do canal** antes de repetir.
- **Erros PERMANENTES (não adianta repetir):** `131047` (janela 24h fechada), `131026` (número
  inválido/indisponível), `100` (parâmetros inválidos), `131051` (tipo não suportado).
- **Janela de 24h:** fora da janela de atendimento só passa **template aprovado** (erro `131047`).
- **Nunca dropar em silêncio:** todo insert de mensagem deve ter retry + log; a "caixa-preta"
  `webhook_inbound_log` registra tudo que a EvoHub entregou (com `msg_type`) pra auditar perda.

---

## 7. Resumo dos endpoints

| Ação | Método/URL | Auth |
|---|---|---|
| Listar canais | `GET /api/v1/channels` | API key da conta |
| Detalhe do canal (pega token) | `GET /api/v1/channels/{id}` | API key da conta |
| **Enviar** (qualquer tipo) | `POST /meta/v23.0/{phone_number_id}/messages` | token do canal |
| **Subir mídia** (áudio) | `POST /meta/v23.0/{phone_number_id}/media` | token do canal |
| **Baixar mídia** recebida | `GET /meta/v23.0/{media_id}` | token do canal |
| **Receber** (webhook, EvoHub → você) | `POST <sua_url>/evohub-webhook` | — (valida `hub.verify_token`) |

Base da API = `https://api.evohub.ai`. Versão Meta usada = `v23.0`.
