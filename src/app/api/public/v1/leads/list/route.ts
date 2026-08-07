import { requireApiKey, jsonResponse } from "@/lib/api-auth";
import { resolvePeriod, paginate } from "@/lib/public-metrics";

export const dynamic = "force-dynamic";

// Leads detalhados (paginados). Filtros: period, status, source, limit, offset.
export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.res;
  const db = auth.db;
  const u = new URL(request.url);
  const p = resolvePeriod(u.searchParams.get("period") || undefined, u.searchParams.get("start") || undefined, u.searchParams.get("end") || undefined);
  const { limit, offset } = paginate(u, 50, 200);
  const status = u.searchParams.get("status");
  const source = u.searchParams.get("source");

  let q = db.from("leads")
    .select("id, name, phone, email, source, status, funnel_stage, priority, assigned_to, contacted_at, converted_at, created_at, updated_at", { count: "exact" })
    .gte("created_at", p.startISO).lte("created_at", p.endISO)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (status) q = q.eq("status", status);
  if (source) q = q.eq("source", source);

  const { data, count } = await q;
  const leads = ((data as any[]) || []).map((l) => ({
    id: l.id, nome: l.name, telefone: l.phone, email: l.email, origem: l.source,
    status: l.status, etapa_funil: l.funnel_stage, prioridade: l.priority,
    contatado_em: l.contacted_at, convertido_em: l.converted_at, criado_em: l.created_at, atualizado_em: l.updated_at,
  }));

  return jsonResponse({ periodo: { tipo: p.period, inicio: p.startDate, fim: p.endDate }, total: count || 0, limit, offset, leads });
}
