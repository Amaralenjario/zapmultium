-- Fila de fluxos por conversa: adiciona o status 'queued' às execuções.
-- Um fluxo disparado enquanto outro está ativo entra em 'queued' e é promovido
-- automaticamente quando o fluxo atual termina (só 1 fluxo roda por vez).
alter table flow_executions drop constraint if exists flow_executions_status_check;
alter table flow_executions add constraint flow_executions_status_check
  check (status = any (array['pending','running','paused','completed','error','queued']));
