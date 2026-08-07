import { requireApiKey, jsonResponse } from "@/lib/api-auth";
import { resolvePeriod, multiumClient } from "@/lib/public-metrics";

export const dynamic = "force-dynamic";

// Resumo de vendas: eventos, faturamento, ticket médio, reembolsos/chargebacks,
// top produtos, por plataforma/campanha/operação, e série por dia.
export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.res;
  const u = new URL(request.url);
  const p = resolvePeriod(u.searchParams.get("period") || undefined, u.searchParams.get("start") || undefined, u.searchParams.get("end") || undefined);

  const multium = multiumClient();
  if (!multium) return jsonResponse({ error: "Fonte de vendas não configurada" }, 500);
  const { data, error } = await multium.rpc("x1_sales_summary", { p_start: p.startDate, p_end: p.endDate });
  if (error) return jsonResponse({ error: error.message }, 502);

  return jsonResponse({ periodo: { tipo: p.period, inicio: p.startDate, fim: p.endDate }, ...(data as any) });
}
