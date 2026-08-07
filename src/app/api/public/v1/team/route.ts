import { requireApiKey, jsonResponse } from "@/lib/api-auth";
import { resolvePeriod, multiumClient, avatarOverlay, httpAvatar, norm } from "@/lib/public-metrics";

export const dynamic = "force-dynamic";

// Equipe completa: cada vendedor com operação, gênero, foto, meta, telefone, comissão,
// e as vendas/faturamento no período.
export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.res;
  const u = new URL(request.url);
  const p = resolvePeriod(u.searchParams.get("period") || undefined, u.searchParams.get("start") || undefined, u.searchParams.get("end") || undefined);

  const multium = multiumClient();
  if (!multium) return jsonResponse({ error: "Fonte de vendas não configurada" }, 500);
  const overlay = await avatarOverlay(auth.db);
  const [teamRes, salesRes] = await Promise.all([
    multium.rpc("x1_team"),
    multium.rpc("x1_ranking", { p_start: p.startDate, p_end: p.endDate }),
  ]);
  const salesByUtm: Record<string, { vendas: number; faturamento: number }> = {};
  for (const r of (salesRes.data as any[]) || []) salesByUtm[r.utm] = { vendas: Number(r.vendas) || 0, faturamento: Number(r.faturamento) || 0 };

  const team = ((teamRes.data as any[]) || []).map((v) => {
    const s = salesByUtm[v.utm] || { vendas: 0, faturamento: 0 };
    return {
      utm: v.utm, nome: v.nome, operacao: v.operacao, genero: (v.genero || "").toUpperCase(),
      titulo: (v.genero || "").toUpperCase() === "F" ? "rainha" : "lobo",
      avatar: httpAvatar(v.foto_url) || httpAvatar(overlay[norm(v.nome)]),
      meta: Number(v.meta) || 0, telefone: v.telefone || null,
      comissao_pct: v.comissao_pct != null ? Number(v.comissao_pct) : null, ativo: v.ativo !== false,
      vendas: s.vendas, faturamento: Number(s.faturamento.toFixed(2)),
    };
  }).sort((a, b) => b.vendas - a.vendas);

  return jsonResponse({ periodo: { tipo: p.period, inicio: p.startDate, fim: p.endDate }, total: team.length, equipe: team });
}
