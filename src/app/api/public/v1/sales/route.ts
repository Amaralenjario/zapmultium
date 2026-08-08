import { requireApiKey, jsonResponse } from "@/lib/api-auth";
import { resolvePeriod, multiumClient, paginate } from "@/lib/public-metrics";

export const dynamic = "force-dynamic";

// Vendas detalhadas (paginadas). Filtros: period, evento (purchase_approved|refund|chargeback|all), utm, limit, offset.
// Cada venda vem com o vendedor resolvido pelo utm (vendedor/vendedor_codigo/operacao_vendedor);
// utm que não é de vendedor (organic/ads/vazio) => vendedor = null (venda sem atribuição).
export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.res;
  const u = new URL(request.url);
  const p = resolvePeriod(u.searchParams.get("period") || undefined, u.searchParams.get("start") || undefined, u.searchParams.get("end") || undefined);
  const { limit, offset } = paginate(u, 100, 500);
  const evento = u.searchParams.get("evento") || "purchase_approved";
  const utm = u.searchParams.get("utm") || null;

  const multium = multiumClient();
  if (!multium) return jsonResponse({ error: "Fonte de vendas não configurada" }, 500);
  const [salesRes, sellersRes] = await Promise.all([
    multium.rpc("x1_sales", { p_start: p.startDate, p_end: p.endDate, p_evento: evento, p_utm: utm, p_limit: limit, p_offset: offset }),
    multium.rpc("x1_sellers"),
  ]);
  if (salesRes.error) return jsonResponse({ error: salesRes.error.message }, 502);
  const r = (salesRes.data as any) || {};

  // Mapa utm -> vendedor (pra atribuir cada venda ao vendedor certo).
  const byUtm: Record<string, { nome: string; codigo: string | null; operacao: string | null }> = {};
  for (const v of ((sellersRes.data as any[]) || [])) {
    if (v.utm) byUtm[String(v.utm).toUpperCase()] = { nome: v.nome, codigo: v.codigo || null, operacao: v.operacao || null };
  }

  const vendas = ((r.vendas as any[]) || []).map((s) => {
    const sel = s.utm ? byUtm[String(s.utm).toUpperCase()] : null;
    return {
      ...s,
      vendedor: sel?.nome || null,
      vendedor_codigo: sel?.codigo || null,
      operacao_vendedor: sel?.operacao || null,
    };
  });

  return jsonResponse({
    periodo: { tipo: p.period, inicio: p.startDate, fim: p.endDate },
    filtro: { evento, utm },
    total: r.total || 0, limit, offset, vendas,
  });
}
