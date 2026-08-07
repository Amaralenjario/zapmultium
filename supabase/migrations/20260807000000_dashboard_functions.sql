-- Funções de agregação do Dashboard (somente leitura).
-- p_phones NULL/vazio = todos os canais (admin); array = canais permitidos (vendedor).

-- 1) Resumo com todos os KPIs escalares + tempos de resposta, em 1 chamada.
create or replace function dashboard_summary(
  p_start timestamptz,
  p_end timestamptz,
  p_phones text[] default null
)
returns json
language sql
stable
as $$
  with msg as (
    select sender_type, created_at, conversation_id
    from messages
    where created_at >= p_start and created_at <= p_end
      and (p_phones is null or metadata->>'phone_number_id' = any(p_phones))
  ),
  firsts as (
    select conversation_id,
      min(created_at) filter (where sender_type = 'customer') as fc,
      min(created_at) filter (where sender_type = 'agent')    as fa,
      min(created_at) as cs,
      max(created_at) as ce
    from msg group by conversation_id
  )
  select json_build_object(
    'novas_conversas', (select count(*) from conversations
        where created_at >= p_start and created_at <= p_end
        and (p_phones is null or metadata->>'phone_number_id' = any(p_phones))),
    'ativas_agora', (select count(*) from conversations
        where status = 'active'
        and (p_phones is null or metadata->>'phone_number_id' = any(p_phones))),
    'aguardando', (select count(*) from conversations
        where status = 'active' and last_message_sender = 'customer'
        and (p_phones is null or metadata->>'phone_number_id' = any(p_phones))),
    'msgs_enviadas',  (select count(*) from msg where sender_type = 'agent'),
    'msgs_recebidas', (select count(*) from msg where sender_type = 'customer'),
    'fluxos_disparados', (select count(*) from flow_executions
        where started_at >= p_start and started_at <= p_end
        and (p_phones is null or phone_number_id = any(p_phones))),
    'fluxos_concluidos', (select count(*) from flow_executions
        where started_at >= p_start and started_at <= p_end and status = 'completed'
        and (p_phones is null or phone_number_id = any(p_phones))),
    'fluxos_erro', (select count(*) from flow_executions
        where started_at >= p_start and started_at <= p_end and status = 'error'
        and (p_phones is null or phone_number_id = any(p_phones))),
    'tmr_mediana_seg', (select round(percentile_cont(0.5) within group
        (order by extract(epoch from (fa - fc))) filter (where fa > fc)) from firsts),
    'tmr_medio_seg', (select round(avg(extract(epoch from (fa - fc)))
        filter (where fa > fc)) from firsts),
    'duracao_media_seg', (select round(avg(extract(epoch from (ce - cs)))
        filter (where ce > cs)) from firsts),
    'conversas_atendidas', (select count(*) from firsts where fa > fc)
  );
$$;

-- 2) Série temporal de volume (enviadas x recebidas), bucket 'day' ou 'hour'.
create or replace function dashboard_volume(
  p_start timestamptz,
  p_end timestamptz,
  p_phones text[] default null,
  p_bucket text default 'day'
)
returns table(bucket timestamp, enviadas bigint, recebidas bigint)
language sql
stable
as $$
  select date_trunc(p_bucket, created_at at time zone 'America/Sao_Paulo') as bucket,
    count(*) filter (where sender_type = 'agent')    as enviadas,
    count(*) filter (where sender_type = 'customer') as recebidas
  from messages
  where created_at >= p_start and created_at <= p_end
    and (p_phones is null or metadata->>'phone_number_id' = any(p_phones))
  group by 1
  order by 1;
$$;

-- 3) Métricas por canal (phone_number_id) — base da tabela por vendedor e por operação.
create or replace function dashboard_by_channel(
  p_start timestamptz,
  p_end timestamptz,
  p_phones text[] default null
)
returns table(phone text, enviadas bigint, recebidas bigint, novas bigint, ativas bigint, aguardando bigint)
language sql
stable
as $$
  with msgs as (
    select metadata->>'phone_number_id' as phone,
      count(*) filter (where sender_type = 'agent')    as enviadas,
      count(*) filter (where sender_type = 'customer') as recebidas
    from messages
    where created_at >= p_start and created_at <= p_end
      and metadata->>'phone_number_id' is not null
      and (p_phones is null or metadata->>'phone_number_id' = any(p_phones))
    group by 1
  ),
  convs as (
    select metadata->>'phone_number_id' as phone,
      count(*) filter (where created_at >= p_start and created_at <= p_end) as novas,
      count(*) filter (where status = 'active') as ativas,
      count(*) filter (where status = 'active' and last_message_sender = 'customer') as aguardando
    from conversations
    where metadata->>'phone_number_id' is not null
      and (p_phones is null or metadata->>'phone_number_id' = any(p_phones))
    group by 1
  )
  select
    coalesce(m.phone, c.phone) as phone,
    coalesce(m.enviadas, 0), coalesce(m.recebidas, 0),
    coalesce(c.novas, 0), coalesce(c.ativas, 0), coalesce(c.aguardando, 0)
  from msgs m
  full outer join convs c on m.phone = c.phone;
$$;

grant execute on function dashboard_summary(timestamptz, timestamptz, text[]) to authenticated, service_role;
grant execute on function dashboard_volume(timestamptz, timestamptz, text[], text) to authenticated, service_role;
grant execute on function dashboard_by_channel(timestamptz, timestamptz, text[]) to authenticated, service_role;
