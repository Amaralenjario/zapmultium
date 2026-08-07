-- ⚠️ RODA NO PROJETO **Multium** (ref wvcwrozwnwdlpandwubp), NÃO no crm.
-- Expõe SÓ o ranking agregado de vendas (read-only), pra app consumir com a chave anon
-- sem precisar de service_role (não lê tabelas cruas). SECURITY DEFINER = ignora RLS,
-- mas só devolve o agregado nome/foto/contagem/faturamento por vendedor.

-- Parser de valor do Ticket (texto bagunçado -> numeric). "R$ 1.234,56" -> 1234.56 ; "47.9" -> 47.9
create or replace function x1_parse_ticket(t text) returns numeric
language plpgsql immutable as $$
declare s text;
begin
  if t is null then return 0; end if;
  s := regexp_replace(t, '[^0-9.,-]', '', 'g');  -- mantém dígitos . , -
  if s = '' then return 0; end if;
  if position(',' in s) > 0 and position('.' in s) > 0 then
    s := replace(s, '.', '');    -- '.' = separador de milhar
    s := replace(s, ',', '.');   -- ',' = decimal
  elsif position(',' in s) > 0 then
    s := replace(s, ',', '.');
  end if;
  begin
    return s::numeric;
  exception when others then
    return 0;
  end;
end;
$$;

-- Normaliza a coluna Data (aceita ISO YYYY-MM-DD e BR DD-MM-YYYY; resto -> null)
create or replace function x1_parse_date(t text) returns date
language plpgsql immutable as $$
begin
  if t is null then return null; end if;
  begin
    if t ~ '^\d{4}-\d{2}-\d{2}' then return substring(t from 1 for 10)::date;
    elsif t ~ '^\d{2}-\d{2}-\d{4}$' then return to_date(t, 'DD-MM-YYYY');
    end if;
  exception when others then return null;
  end;
  return null;
end;
$$;

-- Ranking agregado por vendedor no período [p_start, p_end] (datas inclusivas).
-- Venda = linha com Evento purchase_approved (case-insensitive). Refund/chargeback não contam.
create or replace function x1_ranking(p_start date, p_end date)
returns table(
  utm text, nome text, foto_url text, expert text, genero text, meta numeric,
  vendas bigint, faturamento numeric
)
language sql stable security definer set search_path = public as $$
  with sd as (
    select v."UTM" as utm,
           x1_parse_date(v."Data") as dt,
           x1_parse_ticket(v."Ticket") as val
    from vendas v
    where lower(coalesce(v."Evento",'')) = 'purchase_approved'
  ),
  agg as (
    select utm, count(*)::bigint as vendas, coalesce(sum(val),0)::numeric as faturamento
    from sd
    where dt is not null and dt >= p_start and dt <= p_end
    group by utm
  )
  select vd.utm, vd.nome, vd.foto_url, vd.expert, vd.genero, vd.meta,
         coalesce(a.vendas,0)::bigint, coalesce(a.faturamento,0)::numeric
  from vendedores vd
  left join agg a on a.utm = vd.utm
  where vd.ativo
  order by coalesce(a.vendas,0) desc, coalesce(a.faturamento,0) desc, vd.nome;
$$;

grant execute on function x1_parse_ticket(text) to anon, authenticated, service_role;
grant execute on function x1_parse_date(text)  to anon, authenticated, service_role;
grant execute on function x1_ranking(date, date) to anon, authenticated, service_role;
