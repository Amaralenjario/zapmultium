-- Ranking de vendas ("Lobo do X1").
-- Venda = lead que entra na coluna "Convertidos" (status = 'converted').
-- Atribuição ao vendedor é feita na API (phone_number_id -> seller_channels).

-- 1) Trigger: carimba converted_at quando o lead vira 'converted' (e limpa quando sai).
--    Cobre TODOS os caminhos de escrita (drag no Kanban client, flow-engine, API de tags).
create or replace function leads_stamp_converted()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'converted'
     and (tg_op = 'INSERT' or old.status is distinct from 'converted') then
    new.converted_at := coalesce(new.converted_at, now());
  elsif new.status is distinct from 'converted' then
    new.converted_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_converted on leads;
create trigger trg_leads_converted
  before insert or update on leads
  for each row execute function leads_stamp_converted();

-- 2) Vendas + leads novos por canal (phone_number_id) no período.
--    coalesce(converted_at, updated_at) cobre leads convertidos antes do trigger existir.
create or replace function ranking_by_channel(
  p_start timestamptz,
  p_end timestamptz
)
returns table(phone text, vendas bigint, leads_novos bigint)
language sql
stable
as $$
  select
    metadata->>'phone_number_id' as phone,
    count(*) filter (
      where status = 'converted'
        and coalesce(converted_at, updated_at) >= p_start
        and coalesce(converted_at, updated_at) <= p_end
    ) as vendas,
    count(*) filter (
      where created_at >= p_start and created_at <= p_end
    ) as leads_novos
  from leads
  where metadata->>'phone_number_id' is not null
  group by 1;
$$;

grant execute on function ranking_by_channel(timestamptz, timestamptz) to authenticated, service_role;
