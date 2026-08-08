import { requireApiKey, jsonResponse } from "@/lib/api-auth";
import { resolvePeriod, multiumClient, avatarOverlay, httpAvatar, norm } from "@/lib/public-metrics";
import { resolveChannelMaps } from "@/lib/attribution";

export const dynamic = "force-dynamic";

// Desempenho por vendedor: cadastro (nome completo, operação, foto, utm, código) +
// vendas/faturamento no período + atendimento (novas/enviadas/recebidas) + conversão.
// A LISTA vem da tabela de vendedores do Multium (TODOS os cadastrados), não do
// atendimento do CRM — assim nenhum vendedor fica de fora e nome/operação/utm são canônicos.
// Query params: period|start|end (janela) e inativos=1 (inclui vendedores inativos).
export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.res;
  const db = auth.db;
  const u = new URL(request.url);
  const p = resolvePeriod(u.searchParams.get("period") || undefined, u.searchParams.get("start") || undefined, u.searchParams.get("end") || undefined);
  const incluirInativos = ["1", "true", "sim"].includes((u.searchParams.get("inativos") || "").toLowerCase());

  const multium = multiumClient();
  if (!multium) return jsonResponse({ error: "Fonte de vendas não configurada" }, 500);

  const [sellersRes, rankRes, overlay, maps, byChanRes] = await Promise.all([
    multium.rpc("x1_sellers"),
    multium.rpc("x1_ranking", { p_start: p.startDate, p_end: p.endDate }),
    avatarOverlay(db),
    resolveChannelMaps(db),
    db.rpc("dashboard_by_channel", { p_start: p.startISO, p_end: p.endISO, p_phones: null }),
  ]);

  // Vendas por utm do vendedor no período.
  const salesByUtm: Record<string, { vendas: number; faturamento: number }> = {};
  for (const r of ((rankRes.data as any[]) || [])) {
    salesByUtm[r.utm] = { vendas: Number(r.vendas) || 0, faturamento: Number(r.faturamento) || 0 };
  }

  // Atendimento por phone_number_id (canal de WhatsApp).
  const attByPhone: Record<string, { novas: number; enviadas: number; recebidas: number }> = {};
  for (const ch of ((byChanRes.data as any[]) || [])) {
    attByPhone[ch.phone] = { novas: Number(ch.novas) || 0, enviadas: Number(ch.enviadas) || 0, recebidas: Number(ch.recebidas) || 0 };
  }
  const { channelToPhone } = maps;

  const vendedores = ((sellersRes.data as any[]) || [])
    .filter((v) => incluirInativos || v.ativo !== false)
    .map((v) => {
      const s = salesByUtm[v.utm] || { vendas: 0, faturamento: 0 };
      // Soma o atendimento de todos os canais ligados ao vendedor (wa_channel_ids -> phone).
      let novas = 0, enviadas = 0, recebidas = 0;
      for (const cid of (v.wa_channel_ids || [])) {
        const a = attByPhone[channelToPhone[cid]];
        if (a) { novas += a.novas; enviadas += a.enviadas; recebidas += a.recebidas; }
      }
      return {
        utm: v.utm,
        codigo: v.codigo || null,
        vendedor: v.nome,
        operacao: v.operacao || null,
        genero: (v.genero || "").toUpperCase() || null,
        avatar: httpAvatar(v.foto_url) || httpAvatar(overlay[norm(v.nome)]),
        ativo: v.ativo !== false,
        novas, enviadas, recebidas,
        vendas: s.vendas,
        faturamento: Number(s.faturamento.toFixed(2)),
        taxa_conversao_pct: novas > 0 ? Math.round((s.vendas / novas) * 100) : 0,
      };
    })
    .sort((a, b) => b.vendas - a.vendas || b.faturamento - a.faturamento || a.vendedor.localeCompare(b.vendedor));

  return jsonResponse({
    periodo: { tipo: p.period, inicio: p.startDate, fim: p.endDate },
    total_vendedores: vendedores.length,
    vendedores,
  });
}
