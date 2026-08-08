-- ⚠️ RODA NO PROJETO Multium (wvcwrozwnwdlpandwubp). Funções read-only pra API pública.

-- Vendas detalhadas paginadas + total. p_evento: 'purchase_approved' | 'refund' | 'chargeback' | 'all'.
create or replace function x1_sales(
  p_start date, p_end date,
  p_evento text default 'purchase_approved',
  p_utm text default null,
  p_limit int default 100, p_offset int default 0
) returns json language sql stable security definer set search_path = public as $$
  with base as (
    select v.id,
      v."Produto" as produto, x1_parse_ticket(v."Ticket") as valor, v."Ticket" as valor_texto,
      v."Evento" as evento, x1_parse_date(v."Data") as data, v."UTM" as utm,
      v.nome_expert as operacao, v.tipo_produto, v."Plaforma" as plataforma, v."Campanha" as campanha,
      v."ID de Referência" as referencia, v."Nome" as cliente, v."Email" as email, v."Telefone" as telefone
    from vendas v
    where x1_parse_date(v."Data") is not null
      and x1_parse_date(v."Data") >= p_start and x1_parse_date(v."Data") <= p_end
      and (p_evento = 'all' or lower(coalesce(v."Evento", '')) = lower(p_evento))
      and (p_utm is null or v."UTM" = p_utm)
  )
  select json_build_object(
    'total', (select count(*) from base),
    'limit', greatest(p_limit, 0), 'offset', greatest(p_offset, 0),
    'vendas', (select coalesce(json_agg(row_to_json(x)), '[]'::json) from (
        select * from base order by data desc nulls last, id desc
        limit greatest(p_limit, 0) offset greatest(p_offset, 0)) x)
  );
$$;

-- Resumo de vendas: eventos, faturamento, ticket médio, top produtos/plataforma/campanha/operação, por dia.
create or replace function x1_sales_summary(p_start date, p_end date)
returns json language sql stable security definer set search_path = public as $$
  with base as (
    select x1_parse_date(v."Data") as dt, lower(coalesce(v."Evento", '')) as evento,
      x1_parse_ticket(v."Ticket") as valor, v."Produto" as produto, v."Plaforma" as plataforma,
      v."Campanha" as campanha, v.nome_expert as operacao
    from vendas v
    where x1_parse_date(v."Data") is not null
      and x1_parse_date(v."Data") >= p_start and x1_parse_date(v."Data") <= p_end
  ), aprov as (select * from base where evento = 'purchase_approved')
  select json_build_object(
    'por_evento', (select coalesce(json_object_agg(evento, c), '{}'::json) from (select evento, count(*) c from base group by evento) t),
    'aprovadas', (select count(*) from aprov),
    'reembolsos', (select count(*) from base where evento = 'refund'),
    'chargebacks', (select count(*) from base where evento = 'chargeback'),
    'faturamento', (select coalesce(round(sum(valor), 2), 0) from aprov),
    'ticket_medio', (select coalesce(round(avg(valor), 2), 0) from aprov),
    'top_produtos', (select coalesce(json_agg(row_to_json(t)), '[]'::json) from (select produto, count(*) vendas, round(sum(valor), 2) faturamento from aprov group by produto order by count(*) desc limit 20) t),
    'por_plataforma', (select coalesce(json_agg(row_to_json(t)), '[]'::json) from (select coalesce(nullif(plataforma, ''), 'Não informado') plataforma, count(*) vendas, round(sum(valor), 2) faturamento from aprov group by 1 order by count(*) desc) t),
    'por_campanha', (select coalesce(json_agg(row_to_json(t)), '[]'::json) from (select coalesce(nullif(campanha, ''), 'Não informado') campanha, count(*) vendas, round(sum(valor), 2) faturamento from aprov group by 1 order by count(*) desc limit 20) t),
    'por_operacao', (select coalesce(json_agg(row_to_json(t)), '[]'::json) from (select coalesce(operacao, 'Não informado') operacao, count(*) vendas, round(sum(valor), 2) faturamento from aprov group by 1 order by count(*) desc) t),
    'por_dia', (select coalesce(json_agg(row_to_json(t)), '[]'::json) from (select dt::text dia, count(*) vendas, round(sum(valor), 2) faturamento from aprov group by dt order by dt) t)
  );
$$;

-- Equipe completa (dados dos vendedores, sem segredos como pix/permissoes).
create or replace function x1_team()
returns table(utm text, nome text, operacao text, genero text, foto_url text, meta numeric, telefone text, comissao_pct numeric, ativo boolean)
language sql stable security definer set search_path = public as $$
  select utm, nome, expert, genero, foto_url, meta, telefone, comissao_pct, ativo from vendedores order by nome;
$$;

-- Última venda aprovada do período → alimenta o card "NOVA VENDA" da Ranking TV
-- (valor, vendedor via UTM→vendedores, operação). Ordena por Data desc, id desc.
create or replace function x1_last_sale(p_start date, p_end date)
returns table(id bigint, valor numeric, produto text, utm text, vendedor text, foto_url text, operacao text, genero text, data text)
language sql stable security definer set search_path = public as $$
  select v.id,
    x1_parse_ticket(v."Ticket") as valor,
    v."Produto" as produto,
    v."UTM" as utm,
    vd.nome as vendedor,
    vd.foto_url,
    coalesce(nullif(vd.expert,''), nullif(v.nome_expert,''), 'Nao informado') as operacao,
    vd.genero,
    v."Data" as data
  from vendas v
  left join vendedores vd on vd.utm = v."UTM"
  where lower(coalesce(v."Evento",'')) = 'purchase_approved'
    and x1_parse_date(v."Data") is not null
    and x1_parse_date(v."Data") >= p_start and x1_parse_date(v."Data") <= p_end
  order by x1_parse_date(v."Data") desc, v.id desc
  limit 1;
$$;

grant execute on function x1_sales(date, date, text, text, int, int) to anon, authenticated, service_role;
grant execute on function x1_sales_summary(date, date) to anon, authenticated, service_role;
grant execute on function x1_team() to anon, authenticated, service_role;
grant execute on function x1_last_sale(date, date) to anon, authenticated, service_role;
