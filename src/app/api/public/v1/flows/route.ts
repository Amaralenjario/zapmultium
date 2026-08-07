import { requireApiKey, jsonResponse } from "@/lib/api-auth";
import { resolvePeriod } from "@/lib/public-metrics";

export const dynamic = "force-dynamic";

// Fluxos: lista (id, nome, status, gatilho) + resumo de execuções no período por status.
export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.res;
  const db = auth.db;
  const u = new URL(request.url);
  const p = resolvePeriod(u.searchParams.get("period") || undefined, u.searchParams.get("start") || undefined, u.searchParams.get("end") || undefined);

  const STATUSES = ["completed", "error", "paused", "running", "pending", "queued"];
  const [flowsRes, ...countRes] = await Promise.all([
    db.from("flows").select("id, name, status, trigger_type, trigger_value, created_at").order("sort_order", { ascending: true }),
    ...STATUSES.map((s) =>
      db.from("flow_executions").select("id", { count: "exact", head: true }).eq("status", s).gte("started_at", p.startISO).lte("started_at", p.endISO)
    ),
  ]);

  const porStatus: Record<string, number> = {};
  STATUSES.forEach((s, i) => { const c = countRes[i]?.count || 0; if (c) porStatus[s] = c; });
  const totalExec = Object.values(porStatus).reduce((a, b) => a + b, 0);

  return jsonResponse({
    periodo: { tipo: p.period, inicio: p.startDate, fim: p.endDate },
    total_fluxos: (flowsRes.data as any[])?.length || 0,
    execucoes_no_periodo: { total: totalExec, por_status: porStatus },
    fluxos: ((flowsRes.data as any[]) || []).map((f) => ({
      id: f.id, nome: f.name, status: f.status, gatilho: f.trigger_type, gatilho_valor: f.trigger_value, criado_em: f.created_at,
    })),
  });
}
