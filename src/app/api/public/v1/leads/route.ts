import { requireApiKey, jsonResponse } from "@/lib/api-auth";
import { resolvePeriod } from "@/lib/public-metrics";

export const dynamic = "force-dynamic";

// Leads: total, novos no período, convertidos, e distribuição por status/coluna do CRM.
export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.res;
  const db = auth.db;
  const u = new URL(request.url);
  const p = resolvePeriod(u.searchParams.get("period") || undefined, u.searchParams.get("start") || undefined, u.searchParams.get("end") || undefined);

  const { data } = await db.rpc("leads_summary", { p_start: p.startISO, p_end: p.endISO });
  const l = (data as any) || {};

  return jsonResponse({
    periodo: { tipo: p.period, inicio: p.startDate, fim: p.endDate },
    total: l.total || 0,
    novos_no_periodo: l.novos_no_periodo || 0,
    convertidos_no_periodo: l.convertidos_no_periodo || 0,
    por_status: l.por_status || {},
  });
}
