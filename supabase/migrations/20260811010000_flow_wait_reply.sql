-- Bloco "Aguardar resposta" (wait_reply) + disparo automático por dia (schedule).
-- Roda no projeto CRM (ryurgbutqcgmicqqvols).

-- 1) Novo status de execução: "awaiting_reply" (fluxo parado esperando o cliente responder).
alter table flow_executions drop constraint if exists flow_executions_status_check;
alter table flow_executions add constraint flow_executions_status_check
  check (status = any (array['pending','running','paused','completed','error','queued','awaiting_reply']));

-- 2) Índice único no execution_key → dedup ATÔMICO do disparo automático
--    (chave determinística sched:<flow>:<conversa>:<dia>, 1x por conversa por dia,
--    à prova de corrida entre vários pollers/navegadores).
create unique index if not exists flow_executions_execution_key_uniq
  on flow_executions(execution_key);

-- Obs: o vínculo do fluxo ao dia usa as colunas existentes:
--   flows.trigger_type = 'schedule'  (valor já permitido pelo flows_trigger_type_check)
--   flows.trigger_value = '{"days":[0..6],"channels":["<phone_number_id>",...]|null}'
