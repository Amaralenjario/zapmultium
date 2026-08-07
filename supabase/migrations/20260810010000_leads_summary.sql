-- Resumo de leads para a API pública (total, novos no período, convertidos, por status).
create or replace function leads_summary(p_start timestamptz, p_end timestamptz)
returns json language sql stable as $$
  select json_build_object(
    'total', (select count(*) from leads),
    'novos_no_periodo', (select count(*) from leads where created_at >= p_start and created_at <= p_end),
    'convertidos_no_periodo', (select count(*) from leads
        where status = 'converted' and coalesce(converted_at, updated_at) >= p_start and coalesce(converted_at, updated_at) <= p_end),
    'por_status', (select coalesce(json_object_agg(st, c), '{}'::json)
        from (select coalesce(nullif(status,''),'sem_status') st, count(*) c from leads group by 1) t)
  );
$$;
grant execute on function leads_summary(timestamptz, timestamptz) to authenticated, service_role;
