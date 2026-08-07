import { requireApiKey, jsonResponse } from "@/lib/api-auth";
import { resolvePeriod, multiumClient } from "@/lib/public-metrics";

export const dynamic = "force-dynamic";

// Séries temporais. metric=messages (enviadas/recebidas) ou sales (vendas/faturamento por dia).
export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.res;
  const db = auth.db;
  const u = new URL(request.url);
  const p = resolvePeriod(u.searchParams.get("period") || undefined, u.searchParams.get("start") || undefined, u.searchParams.get("end") || undefined);
  const metric = (u.searchParams.get("metric") || "messages").toLowerCase();

  if (metric === "sales" || metric === "vendas") {
    const multium = multiumClient();
    if (!multium) return jsonResponse({ error: "Fonte de vendas não configurada" }, 500);
    const { data } = await multium.rpc("x1_sales_summary", { p_start: p.startDate, p_end: p.endDate });
    return jsonResponse({ metric: "sales", periodo: { tipo: p.period, inicio: p.startDate, fim: p.endDate }, serie: ((data as any) || {}).por_dia || [] });
  }

  const bucket = (u.searchParams.get("bucket") || (p.period === "hoje" || p.period === "ontem" ? "hour" : "day")).toLowerCase();
  const { data } = await db.rpc("dashboard_volume", { p_start: p.startISO, p_end: p.endISO, p_phones: null, p_bucket: bucket === "hour" ? "hour" : "day" });
  const serie = ((data as any[]) || []).map((v) => ({ momento: v.bucket, enviadas: Number(v.enviadas), recebidas: Number(v.recebidas) }));

  return jsonResponse({ metric: "messages", bucket, periodo: { tipo: p.period, inicio: p.startDate, fim: p.endDate }, serie });
}
