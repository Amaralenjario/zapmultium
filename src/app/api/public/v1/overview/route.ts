import { requireApiKey, jsonResponse } from "@/lib/api-auth";
import { resolvePeriod, vendasByName } from "@/lib/public-metrics";

export const dynamic = "force-dynamic";

// Visão geral: leads, vendas, conversas, mensagens, tempo de resposta, fluxos — por período.
export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.res;
  const db = auth.db;
  const u = new URL(request.url);
  const p = resolvePeriod(u.searchParams.get("period") || undefined, u.searchParams.get("start") || undefined, u.searchParams.get("end") || undefined);

  const [sumRes, leadsRes, vmap] = await Promise.all([
    db.rpc("dashboard_summary", { p_start: p.startISO, p_end: p.endISO, p_phones: null }),
    db.rpc("leads_summary", { p_start: p.startISO, p_end: p.endISO }),
    vendasByName(p.startDate, p.endDate),
  ]);
  const s = (sumRes.data as any) || {};
  const l = (leadsRes.data as any) || {};
  let vendas = 0, faturamento = 0;
  for (const k in vmap) { vendas += vmap[k].vendas; faturamento += vmap[k].faturamento; }

  return jsonResponse({
    periodo: { tipo: p.period, inicio: p.startDate, fim: p.endDate },
    leads: { total: l.total || 0, novos_no_periodo: l.novos_no_periodo || 0, convertidos_no_periodo: l.convertidos_no_periodo || 0 },
    vendas: { total: vendas, faturamento: Number(faturamento.toFixed(2)) },
    conversas: {
      novas: s.novas_conversas || 0, ativas_agora: s.ativas_agora || 0,
      aguardando_resposta: s.aguardando || 0, atendidas: s.conversas_atendidas || 0,
    },
    mensagens: { enviadas: s.msgs_enviadas || 0, recebidas: s.msgs_recebidas || 0 },
    tempo_resposta: { mediana_seg: s.tmr_mediana_seg ?? null, medio_seg: s.tmr_medio_seg ?? null },
    duracao_media_conversa_seg: s.duracao_media_seg ?? null,
    fluxos: { disparados: s.fluxos_disparados || 0, concluidos: s.fluxos_concluidos || 0, erros: s.fluxos_erro || 0 },
  });
}
