import { requireApiKey, jsonResponse } from "@/lib/api-auth";
import { resolvePeriod, operationsRanking } from "@/lib/public-metrics";

export const dynamic = "force-dynamic";

// Ranking de vendas por operação + Lobo/Rainha do X1 (campeão do mês passado).
export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.res;
  const u = new URL(request.url);
  const p = resolvePeriod(u.searchParams.get("period") || undefined, u.searchParams.get("start") || undefined, u.searchParams.get("end") || undefined);

  const { monthLabel, operations } = await operationsRanking(auth.db, p);
  const opFilter = (u.searchParams.get("operation") || u.searchParams.get("operacao") || "").toLowerCase().trim();
  const filtered = opFilter ? operations.filter((o) => o.operation.toLowerCase() === opFilter) : operations;

  return jsonResponse({
    periodo: { tipo: p.period, inicio: p.startDate, fim: p.endDate },
    mes_do_campeao: monthLabel,
    operacoes: filtered,
  });
}
