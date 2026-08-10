import { requireApiKeyOrSession } from "@/lib/tv-auth";
import { jsonResponse } from "@/lib/api-auth";
import { resolvePeriod, multiumClient, avatarOverlay, httpAvatar, norm, brToday, lastMonth } from "@/lib/public-metrics";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// Dados da Ranking TV: pódio por faturamento, ranking, metas coletivas por operação e stats.
export async function GET(request: Request) {
  const auth = await requireApiKeyOrSession(request);
  if (!auth.ok) return auth.res;

  const u = new URL(request.url);
  const p = resolvePeriod(u.searchParams.get("period") || undefined, u.searchParams.get("start") || undefined, u.searchParams.get("end") || undefined);
  const multium = multiumClient();
  if (!multium) return jsonResponse({ error: "Fonte de vendas não configurada" }, 500);

  const monthStart = brToday().slice(0, 8) + "01";
  const lm = lastMonth();
  const overlay = await avatarOverlay(auth.db);
  const [periodRes, monthRes, metasRes, summaryRes, champRes, lastRes] = await Promise.all([
    multium.rpc("x1_ranking", { p_start: p.startDate, p_end: p.endDate }),
    multium.rpc("x1_ranking", { p_start: monthStart, p_end: brToday() }),
    multium.rpc("x1_metas"),
    multium.rpc("x1_sales_summary", { p_start: p.startDate, p_end: p.endDate }),
    multium.rpc("x1_ranking", { p_start: lm.start, p_end: lm.end }), // mês passado → Lobo/Rainha
    multium.rpc("x1_last_sale", { p_start: p.startDate, p_end: p.endDate }), // última venda → card "NOVA VENDA"
  ]);

  const dec = (r: any) => {
    const vendas = Number(r.vendas) || 0, faturamento = Number(r.faturamento) || 0, meta = Number(r.meta) || 0;
    return {
      utm: r.utm, nome: r.nome || r.utm || "Vendedor",
      avatar: httpAvatar(r.foto_url) || httpAvatar(overlay[norm(r.nome)]),
      operacao: r.expert || "—", genero: (r.genero || "").toUpperCase(),
      vendas, faturamento, ticket: vendas > 0 ? Math.round(faturamento / vendas) : 0,
      meta, pctMeta: meta > 0 ? Math.round((faturamento / meta) * 100) : 0,
    };
  };
  const rows = ((periodRes.data as any[]) || []).map(dec).sort((a, b) => b.faturamento - a.faturamento || b.vendas - a.vendas);
  const ranked = rows.map((r, i) => ({ rank: i + 1, ...r }));

  // Faturamento do mês por operação = soma SÓ das vendas com UTM de vendedor (x1_ranking por operação).
  // Vendas sem UTM (organic/ads) NÃO contam pra meta coletiva.
  const monthByOp: Record<string, number> = {};
  for (const r of (monthRes.data as any[]) || []) {
    const op = r.expert || "—";
    monthByOp[op] = (monthByOp[op] || 0) + (Number(r.faturamento) || 0);
  }

  const metasColetivas = ((metasRes.data as any[]) || []).filter((m) => Number(m.n3) > 0).map((m) => {
    const atual = Math.round(monthByOp[m.operacao] || 0);
    const n1 = Number(m.n1) || 0, n2 = Number(m.n2) || 0, n3 = Number(m.n3) || 0;
    const nivelAtual = atual >= n3 ? 3 : atual >= n2 ? 2 : atual >= n1 ? 1 : 0;
    const prox = nivelAtual === 0 ? n1 : nivelAtual === 1 ? n2 : nivelAtual === 2 ? n3 : n3;
    const faltaPct = (n: number) => (n > 0 ? Math.max(0, Math.round(((n - atual) / n) * 100)) : 0);
    return {
      operacao: m.operacao, atual, metaExibida: n3, n1, n2, n3,
      pct: n3 > 0 ? Math.round((atual / n3) * 100) : 0,
      nivelAtual, faltaProxNivel: Math.max(0, prox - atual),
      faltaN1: faltaPct(n1), faltaN2: faltaPct(n2), faltaN3: faltaPct(n3),
    };
  });

  const s = (summaryRes.data as any) || {};

  // Lobo/Rainha do X1 = quem mais faturou no MÊS PASSADO — SÓ das operações Caio e Jéssica
  // (Gustavo fica de fora do X1).
  const OPS_X1 = new Set(["caio", "jessica"]);
  const champRows = ((champRes.data as any[]) || []).map(dec)
    .filter((r) => OPS_X1.has(norm(r.operacao)))
    .sort((a, b) => b.faturamento - a.faturamento);
  const lobo = champRows.find((r) => r.genero === "M" && r.faturamento > 0) || null;
  const rainha = champRows.find((r) => r.genero === "F" && r.faturamento > 0) || null;

  // Última venda do período → alimenta o card "NOVA VENDA" (valor, vendedor, operação).
  const lsRow = ((lastRes.data as any[]) || [])[0] || null;
  const ultimaVenda = lsRow
    ? {
        id: Number(lsRow.id) || 0,
        valor: Math.round(Number(lsRow.valor) || 0),
        produto: lsRow.produto || "",
        vendedor: lsRow.vendedor || lsRow.utm || "Sem vendedor",
        operacao: lsRow.operacao || "—",
        avatar: httpAvatar(lsRow.foto_url) || httpAvatar(overlay[norm(lsRow.vendedor)]),
        genero: (lsRow.genero || "").toUpperCase(),
      }
    : null;

  return jsonResponse({
    now: new Date().toISOString(),
    periodo: { tipo: p.period, inicio: p.startDate, fim: p.endDate },
    // vendas e faturamento JÁ vêm líquidos (reembolso/chargeback descontados) do x1_sales_summary.
    stats: { faturamento: Math.round(Number(s.faturamento) || 0), vendas: Number(s.vendas_liquidas ?? s.aprovadas) || 0, ticket: Math.round(Number(s.ticket_medio) || 0) },
    lobo, rainha,
    ultimaVenda,
    podium: ranked.slice(0, 3),
    ranking: ranked.slice(3),
    metasColetivas,
  });
}
