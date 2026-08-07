-- CRM compartilhado: consolida todas as colunas custom sob o ADMIN (dono do board do time).
-- Antes, cada usuário tinha suas próprias colunas → etiquetas apontavam pra colunas que os
-- outros não viam. Agora o board (colunas) é único: o do admin, com todas as colunas.
do $$
declare admin_id uuid;
begin
  select id into admin_id from profiles where role = 'admin' order by created_at limit 1;
  if admin_id is null then return; end if;

  -- Copia colunas custom distintas (por key) para o admin, se ele ainda não tiver.
  insert into crm_columns (user_id, key, label, color, position, created_at)
  select admin_id, c.key, c.label, c.color, c.position, c.created_at
  from (select distinct on (key) key, label, color, position, created_at
        from crm_columns where key like 'custom_%' order by key, created_at) c
  where not exists (select 1 from crm_columns a where a.user_id = admin_id and a.key = c.key);

  -- Renumera o board do admin: padrões primeiro, depois as custom por data de criação.
  with ordered as (
    select id, (row_number() over (order by
        case key when 'new' then 0 when 'contacted' then 1 when 'qualified' then 2 when 'converted' then 3 when 'lost' then 4 else 100 end,
        created_at) - 1) as pos
    from crm_columns where user_id = admin_id
  )
  update crm_columns col set position = o.pos from ordered o where col.id = o.id;
end $$;
