# ZapMultium — Responsabilidades das Telas

Documentação para o time. Projeto Next.js (App Router) — CRM/atendimento WhatsApp. Páginas em `src/app/**/page.tsx`.

## Convenções de acesso e proteção de rota
- Autenticação por Supabase (banco **crm** = `ryurgbutqcgmicqqvols`). O middleware (`src/lib/supabase/middleware.ts`) protege tudo sob `/dashboard`: sem usuário → redireciona para `/login`.
- Rotas **admin-only** (`/dashboard/whatsapps`, `/dashboard/operacoes`, `/dashboard/vendedores`) exigem `profiles.role` = `admin` **ou** `supervisor`; senão redireciona para `/dashboard`.
- No menu (`src/components/Sidebar.tsx`), itens `adminOnly` só aparecem depois de confirmado o papel admin/supervisor (evita "flash"). Papéis: `admin`/`supervisor` (visão total), `operator`/`seller` (vendedor, escopo restrito aos canais dele via `seller_channels`).
- Dois bancos: **crm** (conversas, mensagens, leads, fluxos, operações) e **Multium** (vendas — RPCs `x1_ranking` etc., lido via `MULTIUM_SUPABASE_URL`).

---

## 1. `/` — Raiz
- **Público:** todos (Server Component). Roteador de entrada: logado → `/dashboard`; deslogado → `/login`. Sem UI.

## 2. `/login` e `/register`
- **Público:** todos. Telas de marca envolvendo os formulários de login/cadastro (`LoginForm`/`RegisterForm`, auth Supabase).

---

## 3. `/dashboard` — Dashboard principal
- **Público:** todos os logados (Server Component com escopo por papel). Admin/supervisor veem tudo (ou filtrado por operação); vendedor vê só os KPIs dos seus canais.
- **Ações:** filtro de período (`DashboardFilter`: hoje/ontem/7d/15d/30d/custom + operação); 8 KPIs (conversas novas, aguardando, ativas, tempo de resposta, msgs recebidas/enviadas, fluxos disparados, duração média); gráfico de volume, donut por operação, tabela de performance por vendedor (**só admin**), listas "Aguardando resposta" e "Conversas recentes", teaser do Lobo do X1.
- **Dados:** RPCs crm `dashboard_summary`, `dashboard_by_channel`, `dashboard_volume`; tabelas `operations_channels`, `seller_channels`, `conversations`, `profiles`; Multium `x1_ranking` (vendas reais).
- **Componentes:** `MetricCard`, `MessageVolumeChart`, `OperationDonut`, `SellerPerformanceTable`, `RecentConversations`, `DashboardFilter`, `WolfTeaser`.

## 4. `/dashboard/chat-ao-vivo` — Chat ao vivo
- **Público:** todos (vendedor vê só conversas dos canais dele). Duas colunas: lista à esquerda + janela de chat à direita (responsivo: no mobile esconde a lista quando há conversa aberta).
- **`ConversationList`:** lista/filtra/busca conversas com **escopo de vendedor na query** (filtra por `metadata->>phone_number_id`). Filtros Todas/Não lidas/Ativas/Arquivadas + operação + etiqueta; busca via `/api/conversations/search`; badge de fluxo ativo (`/api/flows/active`); realtime + polling 3s; arquivar inline.
- **`ChatWindow`:** carrega `messages` (realtime + polling 2s), auto-scroll, marca lidas (`/api/evohub/mark-read`), contador da **janela de 24h**, etiquetar lead (`/api/crm/leads/[leadId]`), arquivar, reações (`/api/evohub/send-reaction`), responder/citar. Usa `MessageBubble`, `ChatInput`, `FlowBar`, `QuickLinksBar`.

## 5. `/dashboard/crm-leads` — CRM / Kanban de leads
- **Público:** todos (vendedor vê só leads dos canais dele). Renderiza `<CrmKanban/>`.
- **Ações:** colunas (criar/excluir custom/reordenar); etiquetas (CRUD, vincular a coluna); cards de lead (arrastar entre colunas muda `status`; arrastar etiqueta leva os leads dela junto). Mostra `customers` (contatos ainda não virados lead) junto dos `leads` reais — ao mover/etiquetar cria o lead.
- **Dados:** `leads`, `lead_tags`→`crm_tags`, `customers`, `conversations`, `operations_channels`, `seller_channels`; APIs `/api/crm/columns`, `/api/crm/columns/[id]`, `/api/crm/tags`. Auto-refresh 8s.

## 6. `/dashboard/fluxos` — Fluxos / funis ⭐ parte mais complexa
- **Público:** todos os logados. Gerência de fluxos automatizados + logs de execução.
- **Ações:** abas "Fluxos" (grid) e "Execuções" (logs, filtro por status, auto-refresh 3s). Criar (abre `FlowBuilder`), renomear inline, duplicar, excluir (individual/massa), importar por código `FLOWV1`, em massa (`/api/flows/bulk-import`), do ZapVoice (`.json`, `/api/flows/import-zv`), exportar `FLOWV1`, buscar, badge "Auto · dias" (agendados).
- **Dados/APIs:** `/api/flows` (GET/POST), `/api/flows/[id]` (PUT salva/renomeia/agenda, DELETE), `/api/flows/logs`. Auto-save silencioso do builder (PUT `config = { steps, edges }`).

### `FlowBuilder` — editor visual (ReactFlow)
- Blocos (`NODE_CONFIGS`): `start`, `message`, `image`/`video`/`audio` (upload no bucket `flow-media` + legenda), `wait` (N seg), `wait_reply` (aguardar resposta do cliente — salva em variável, timeout opcional, 2 saídas: respondeu/sem resposta), `condition` (variável×valor, saídas verdadeiro/falso), `add_tag`/`remove_tag` (etiqueta do CRM via `TagEditor`).
- Recursos: auto-save a cada 1,8s, desfazer (Ctrl/Cmd+Z, 10 passos), duplicar/excluir nó, arestas deletáveis, exportar FLOWV1, layout automático. **Mobile:** blocos adicionados por toque (bottom-sheet "+ Bloco") além de arrastar; barra de topo compacta; controles de zoom.

### `FlowScheduler` — motor de polling (headless, no layout)
- Montado em `DashboardLayoutClient`. Dois timers: **1s** `GET /api/flows/advance` (avança waits + retoma "aguardando resposta"); **15s** `GET /api/flows/auto-scan` (dispara fluxos agendados por dia/horário para leads novos).

### `FlowBar` — barra de fluxos no chat
- Chips de fluxos (`/api/flows`) para **disparo manual** na conversa; busca; reordenação (`/api/flows/reorder`); confirma e chama `POST /api/flows/trigger`; **progresso ao vivo** (`/api/flows/progress`, polling 3s) com etapa atual/próxima, contagem de waits e cancelar (`/api/flows/cancel`).

### `src/lib/flow-engine.ts` — motor de execução (server) ⭐
- Executa os fluxos com service role e `cache: "no-store"`.
- `startFlow(...)`: inicia fluxo numa conversa; não duplica; **1 fluxo ativo por conversa** (outro entra em `queued`).
- `processFlowStep(id)`: processa nós em sequência (até 200) com lock atômico (`paused/pending → running`). `message`→envia WhatsApp; mídia→pipeline; `wait`→agenda `next_step_at`; `wait_reply`→`awaiting_reply` + `__await` no context; `condition`→saída true/false; `add_tag`/`remove_tag`→`applyTag` (find-or-create lead, grava `lead_tags` + status).
- `advanceExpiredExecutions()`: retoma waits vencidos + `advanceAwaitingReplies()` (segue "reply" se cliente respondeu, ou "timeout"). Salva a resposta na variável.
- **Tabelas:** `flows`, `flow_executions`, `flow_execution_logs`, `messages`, `conversations`, `leads`, `lead_tags`, `crm_tags`.

## 7. `/dashboard/automacoes` — Automações (Novo/Beta)
- **Público:** todos. Agendar um fluxo existente em cenários prontos: **Domingo** e **Almoço** (dispara sozinho só para leads novos — `condition: first_message`).
- **Ações:** card Domingo (liga/desliga, fluxo, canais → `days:[0]`); card Almoço (fluxo, janela de horário máx 2h, dias seg-sáb sem domingo, canais). Toggle iOS, seletor de canais **obrigatório** (fail-closed), resumo "quando vão funcionar".
- **Dados/APIs:** `GET /api/flows`, `GET /api/evohub/channels`, `PUT /api/flows/[id]` (grava `trigger_type=schedule`/`trigger_value`). Disparo real no `/api/flows/auto-scan`.

## 8. `/dashboard/ranking` — Ranking de vendedores
- **Público:** todos (admin ganha "Geral" + multi-operação). Ranking gamificado por operação, com **Lobo/Rainha do X1** (campeão do mês passado; Lobo=homem, Rainha=mulher).
- **Ações:** filtros de período; seletor de operação; atualização a cada 15s; barras de progresso, medalhas top-3, faturamento.
- **Dados:** `GET /api/ranking?range=` (agrega vendas do Multium por operação/gênero).

## 9. `/dashboard/meu-numero` — Meu WhatsApp
- **Público:** todos. Visualização (só leitura) do número + perfil comercial do WhatsApp Business (foto, sobre, descrição, endereço, e-mail, sites, categoria). Edição só no app WhatsApp Business.
- **Dados:** `GET /api/whatsapp-profile?phoneId=`.

## 10. `/dashboard/perfil` — Meu perfil
- **Público:** todos. Editar nome e foto. Upload avatar (`/api/sellers/upload-avatar`), salvar (`PUT /api/profile`). Email/role só leitura. Dispara `profile-updated` (atualiza o Sidebar sem recarregar).

---

## Administração (admin/supervisor)

## 11. `/dashboard/whatsapps` — Canais WhatsApp
- **Admin/supervisor.** Gerencia instâncias/canais EvoHub agrupados por operação.
- **Ações:** conectar WhatsApp (`CreateChannelModal`), status (Conectado/Pendente/Conectando/Banido/Desconectado), foto de perfil do número, telefone, copiar/abrir link de conexão, trocar operação (`OperationPickerModal`), excluir.
- **Dados:** `@/lib/evohub` (`listChannelsForUser`, `enrichChannelsWithPhoneNumbers`); `/api/evohub/channels`, `/api/operations`, `/api/evohub/delete-channel`, `/api/operations/[id]/channels`.

## 12. `/dashboard/operacoes` — Operações
- **Admin/supervisor.** CRUD de operações (cor, slug, canais vinculados). `CreateOperationModal`/`EditOperationModal`; `/api/operations`, `/api/operations/[id]`.

## 13. `/dashboard/operacoes/api` — API / chaves
- **Admin/supervisor.** Gerencia **chaves de API** (`/api/api-keys`) e serve como **documentação viva** da API pública REST (`/api/public/v1/*`: operations, overview, leads, sellers, ranking, team, sales, sales/summary, conversations, tags, channels, flows, timeseries). Autenticação `Authorization: Bearer` / `x-api-key` / `?api_key=`.

## 14. `/dashboard/vendedores` — Vendedores
- **Admin/supervisor.** CRUD de vendedores/usuários + **vínculo de canal** a cada um (grava em `seller_channels`). `CreateSellerModal`/`EditSellerModal`; `/api/sellers`, `/api/sellers/[id]`, `/api/evohub/channels`.

---

## 15. `/ranking-tv` — TV de ranking (tela cheia)
- **Fora de `/dashboard`;** autentica por sessão OU `?api_key=` na URL (pra abrir em telão sem login). Painel "TV" de vendas em tempo real: pódio 1º/2º/3º, ranking, metas coletivas, Lobo/Rainha do X1, e **alerta sonoro/visual de nova venda** (som + flash com valor/vendedor/operação). Filtros por período + **intervalo de datas custom**; atualiza a cada 15s.
- **Dados:** `GET /api/ranking-tv?period=&start=&end=[&api_key=]` (agrega vendas/metas do Multium; faturamento e vendas já **líquidos** = reembolso/chargeback descontados).

---

## Componentes reutilizáveis importantes

**Layout:** `Sidebar` (menu, papel, logout, tema), `DashboardLayoutClient` (shell + `FlowScheduler` + `GlobalAudioProvider`), `ThemeProvider`/`ThemeToggle`.

**Chat:** `ConversationList`, `ChatWindow`, `ChatInput` (texto em fila background, emoji, figurinhas, mensagens rápidas, anexos), `MessageBubble`, `FlowBar`, `QuickLinksBar`, `QuickMessagesPanel`, `StickersPanel`, `AudioPlayer`, `DocumentPreview`, `Avatar`.

**CRM:** `CrmKanban` (quadro completo).

**Fluxos:** `FlowBuilder` (editor), `FlowScheduler` (poller).

**Dashboard:** `MetricCard`, `MessageVolumeChart`, `OperationDonut`, `SellerPerformanceTable`, `RecentConversations`, `DashboardFilter`, `WolfTeaser`.

**Áudio:** `audio/GlobalAudioProvider` (um `<audio>` no layout + barra flutuante; áudio continua tocando ao trocar de conversa/página).

**Modais admin:** `whatsapp/*`, `operations/*`, `sellers/*`.

---

## Notas gerais
- **Escopo do vendedor** é consistente (dashboard/chat/CRM): resolve `seller_channels` → `phone_number_id` e filtra por `metadata->>phone_number_id`.
- **Fluxos:** 1 execução ativa por conversa + fila; disparo manual ignora janela de dia/horário, automático respeita (auto-scan, fail-closed).
- **Duas fontes de venda:** métricas de atendimento vêm do **crm** (`dashboard_*`); vendas/ranking/TV vêm do **Multium** (`x1_ranking`).
