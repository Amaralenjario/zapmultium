-- Etapa de atendimento na conversa (chat ao vivo): 3 blocos no lugar do filtro antigo.
-- 'waiting' = Aguardando atendimento | 'attending' = Atendendo | 'resolved' = Resolvido.
-- É ORTOGONAL a `status` (que continua 'active' e é usado pela ingestão/regra de conversa
-- ativa) e a `archived`. Não mexe em nenhum dos dois.
alter table conversations add column if not exists stage text not null default 'waiting';

-- Índice pra montar os blocos rápido (ignora arquivadas, que ficam num bloco à parte).
create index if not exists idx_conv_stage on conversations(stage) where archived = false;
