create or replace function x1_metas()
returns table(operacao text, ativo boolean, meta_mensal numeric, n1 numeric, n2 numeric, n3 numeric, foto_url text)
language sql stable security definer set search_path = public as $$
  select nome, ativo, meta_mensal, meta_nivel1, meta_nivel2, meta_nivel3, foto_url from experts where ativo order by nome;
$$;
grant execute on function x1_metas() to anon, authenticated, service_role;
create or replace function x1_op_revenue(p_start date, p_end date)
returns table(operacao text, faturamento numeric, vendas bigint)
language sql stable security definer set search_path = public as $$
  select nome_expert, coalesce(round(sum(x1_parse_ticket("Ticket"))),0)::numeric, count(*)::bigint
  from vendas
  where lower(coalesce("Evento",'')) = 'purchase_approved'
    and x1_parse_date("Data") is not null
    and x1_parse_date("Data") >= p_start and x1_parse_date("Data") <= p_end
  group by nome_expert;
$$;
grant execute on function x1_op_revenue(date, date) to anon, authenticated, service_role;
