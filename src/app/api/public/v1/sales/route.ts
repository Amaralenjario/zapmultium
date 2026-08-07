import { requireApiKey, jsonResponse } from "@/lib/api-auth";
import { resolvePeriod, multiumClient, paginate } from "@/lib/public-metrics";

export const dynamic = "force-dynamic";

// Vendas detalhadas (paginadas). Filtros: period, evento (purchase_approved|refund|chargeback|all), utm, limit, offset.
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
  const { data, error } = await multium.rpc("x1_sales", { p_start: p.startDate, p_end: p.endDate, p_evento: evento, p_utm: utm, p_limit: limit, p_offset: offset });
  if (error) return jsonResponse({ error: error.message }, 502);
  const r = (data as any) || {};

  return jsonResponse({
    periodo: { tipo: p.period, inicio: p.startDate, fim: p.endDate },
    filtro: { evento, utm },
    total: r.total || 0, limit, offset, vendas: r.vendas || [],
  });
}
