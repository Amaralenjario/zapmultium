-- Fixar lead no topo (até 10, limite aplicado no cliente) e marcar p/ remarketing.
-- Ambos são ORTOGONAIS a stage/status/archived. pinned_at = fixado; remarketing_at =
-- marcado pra remarketing depois (outra cor, "parece fixado mas é outra coisa").
alter table conversations add column if not exists pinned_at timestamptz;
alter table conversations add column if not exists remarketing_at timestamptz;

create index if not exists idx_conv_pinned on conversations(pinned_at) where pinned_at is not null;
create index if not exists idx_conv_remarketing on conversations(remarketing_at) where remarketing_at is not null;
