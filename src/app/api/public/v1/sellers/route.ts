import { requireApiKey, jsonResponse } from "@/lib/api-auth";
import { resolvePeriod, vendasByName, norm, httpAvatar } from "@/lib/public-metrics";
import { resolveChannelMaps } from "@/lib/attribution";

export const dynamic = "force-dynamic";

// Desempenho por vendedor: atendimento (novas/enviadas/recebidas) + vendas + faturamento + conversão.
export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.res;
  const db = auth.db;
  const u = new URL(request.url);
  const p = resolvePeriod(u.searchParams.get("period") || undefined, u.searchParams.get("start") || undefined, u.searchParams.get("end") || undefined);

  const { phoneToSeller } = await resolveChannelMaps(db);
  const [byChanRes, vmap] = await Promise.all([
    db.rpc("dashboard_by_channel", { p_start: p.startISO, p_end: p.endISO, p_phones: null }),
    vendasByName(p.startDate, p.endDate),
  ]);

  // Agrega atendimento por vendedor (só canais ligados a um vendedor).
  const bySeller: Record<string, { novas: number; enviadas: number; recebidas: number }> = {};
  for (const ch of ((byChanRes.data as any[]) || [])) {
    const uid = phoneToSeller[ch.phone];
    if (!uid) continue;
    const b = (bySeller[uid] = bySeller[uid] || { novas: 0, enviadas: 0, recebidas: 0 });
    b.novas += Number(ch.novas); b.enviadas += Number(ch.enviadas); b.recebidas += Number(ch.recebidas);
  }

  const userIds = Object.keys(bySeller);
  const names: Record<string, string> = {}, roles: Record<string, string> = {}, avatars: Record<string, string> = {};
  if (userIds.length) {
    const { data: profs } = await db.from("profiles").select("id, full_name, email, avatar_url, role").in("id", userIds);
    for (const pr of (profs as any[]) || []) {
      names[pr.id] = pr.full_name || pr.email || pr.id;
      roles[pr.id] = pr.role || "";
      if (pr.avatar_url) avatars[pr.id] = pr.avatar_url;
    }
  }

  const vendedores = Object.entries(bySeller)
    .filter(([uid]) => roles[uid] !== "admin" && roles[uid] !== "supervisor")
    .map(([uid, v]) => {
      const nm = names[uid] || "Vendedor";
      const sale = vmap[norm(nm)];
      const vendas = sale?.vendas || 0;
      return {
        vendedor: nm, operacao: sale?.operation || null, avatar: httpAvatar(avatars[uid]),
        novas: v.novas, enviadas: v.enviadas, recebidas: v.recebidas,
        vendas, faturamento: Number((sale?.faturamento || 0).toFixed(2)),
        taxa_conversao_pct: v.novas > 0 ? Math.round((vendas / v.novas) * 100) : 0,
      };
    })
    .sort((a, b) => b.vendas - a.vendas || (b.enviadas + b.recebidas) - (a.enviadas + a.recebidas));

  return jsonResponse({
    periodo: { tipo: p.period, inicio: p.startDate, fim: p.endDate },
    total_vendedores: vendedores.length,
    vendedores,
  });
}
