import { createClient as createSb, type SupabaseClient } from "@supabase/supabase-js";
import { resolveChannelMaps } from "@/lib/attribution";

export const norm = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

// Só devolve avatar se for URL http (evita data-URL base64 gigante na resposta da API).
export const httpAvatar = (u?: string | null): string | null => (u && /^https?:\/\//.test(u) ? u : null);

export function brToday(): string {
  try { return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); }
  catch { return new Date(Date.now() - 3 * 3600000).toISOString().split("T")[0]; }
}

export interface Period { period: string; startDate: string; endDate: string; startISO: string; endISO: string; }

export function paginate(u: URL, defLimit = 100, maxLimit = 500) {
  const limit = Math.min(maxLimit, Math.max(1, parseInt(u.searchParams.get("limit") || String(defLimit)) || defLimit));
  const offset = Math.max(0, parseInt(u.searchParams.get("offset") || "0") || 0);
  return { limit, offset };
}

// Aceita: hoje | ontem | 7d | 30d | mes | geral | custom(start,end).
export function resolvePeriod(period?: string, start?: string, end?: string): Period {
  const TZ = "-03:00";
  const today = brToday();
  let sD: string, eD: string, p = period || "hoje";
  const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (isDate(start) && isDate(end)) { sD = start!; eD = end!; p = "custom"; }
  else if (p === "geral") { sD = "2000-01-01"; eD = today; }
  else if (p === "ontem") { const d = new Date(today + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - 1); sD = d.toISOString().slice(0, 10); eD = sD; }
  else if (p === "mes") { sD = today.slice(0, 8) + "01"; eD = today; }
  else if (p === "7d" || p === "30d") { const d = new Date(today + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - (p === "7d" ? 6 : 29)); sD = d.toISOString().slice(0, 10); eD = today; }
  else { sD = today; eD = today; p = "hoje"; }
  return {
    period: p, startDate: sD, endDate: eD,
    startISO: new Date(sD + "T00:00:00" + TZ).toISOString(),
    endISO: new Date(eD + "T23:59:59.999" + TZ).toISOString(),
  };
}

export function lastMonth(): { start: string; end: string; label: string } {
  const firstThis = new Date(brToday().slice(0, 8) + "01T12:00:00Z");
  const end = new Date(firstThis); end.setUTCDate(0);
  const endStr = end.toISOString().slice(0, 10);
  return { start: endStr.slice(0, 8) + "01", end: endStr, label: end.toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" }) };
}

export function multiumClient(): SupabaseClient | null {
  const url = process.env.MULTIUM_SUPABASE_URL, key = process.env.MULTIUM_SUPABASE_ANON_KEY;
  // cache: "no-store" impede o Next.js Data Cache de congelar as respostas das RPCs
  // (vendas ao vivo tem que vir sempre fresco; senão a TV mostra ranking desatualizado).
  return url && key ? createSb(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (input, init) => fetch(input as RequestInfo, { ...init, cache: "no-store" }) },
  }) : null;
}

// Mapa nome-normalizado -> foto do perfil ZapMultium (fallback quando o vendedor não tem foto no banco de vendas).
export async function avatarOverlay(admin: SupabaseClient): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  try {
    const { data } = await admin.from("profiles").select("full_name, avatar_url").not("avatar_url", "is", null);
    for (const p of (data as any[]) || []) if (p.full_name && p.avatar_url) map[norm(p.full_name)] = p.avatar_url;
  } catch { /* ignora */ }
  return map;
}

// Ranking por operação + Lobo/Rainha (campeão do mês passado). Reaproveitado pela API pública e interna.
export async function operationsRanking(admin: SupabaseClient, period: Period) {
  const multium = multiumClient();
  if (!multium) return { monthLabel: "", operations: [] as any[] };
  const lm = lastMonth();
  const overlay = await avatarOverlay(admin);
  const [periodRes, champRes] = await Promise.all([
    multium.rpc("x1_ranking", { p_start: period.startDate, p_end: period.endDate }),
    multium.rpc("x1_ranking", { p_start: lm.start, p_end: lm.end }),
  ]);
  const dec = (r: any) => ({
    utm: r.utm, name: r.nome || r.utm || "Vendedor",
    avatar: httpAvatar(r.foto_url) || httpAvatar(overlay[norm(r.nome)]),
    operation: r.expert || "Sem operação", genero: (r.genero || "").toUpperCase(),
    vendas: Number(r.vendas) || 0, faturamento: Number(r.faturamento) || 0,
  });
  const periodRows = ((periodRes.data as any[]) || []).map(dec);
  const champRows = ((champRes.data as any[]) || []).map(dec);
  const experts = Array.from(new Set(periodRows.map((r) => r.operation))).filter(Boolean);

  const operations = experts.map((op) => {
    const rows = periodRows.filter((r) => r.operation === op).sort((a, b) => b.vendas - a.vendas || b.faturamento - a.faturamento);
    const champ = champRows.filter((r) => r.operation === op && r.vendas > 0).sort((a, b) => b.vendas - a.vendas || b.faturamento - a.faturamento)[0] || null;
    return {
      operation: op,
      title: champ && champ.genero === "F" ? "rainha" : "lobo",
      champion: champ ? { name: champ.name, avatar: champ.avatar, genero: champ.genero, vendas: champ.vendas, faturamento: champ.faturamento, mes: lm.label } : null,
      ranking: rows.map((r, i) => ({ rank: i + 1, ...r })),
      total_vendas: rows.reduce((a, b) => a + b.vendas, 0),
      total_faturamento: rows.reduce((a, b) => a + b.faturamento, 0),
    };
  });
  return { monthLabel: lm.label, operations };
}

// Vendas por vendedor (nome normalizado) no período — para cruzar com atendimento.
export async function vendasByName(startDate: string, endDate: string): Promise<Record<string, { vendas: number; faturamento: number; operation: string; genero: string }>> {
  const multium = multiumClient();
  const out: Record<string, { vendas: number; faturamento: number; operation: string; genero: string }> = {};
  if (!multium) return out;
  const { data } = await multium.rpc("x1_ranking", { p_start: startDate, p_end: endDate });
  for (const r of (data as any[]) || []) {
    out[norm(r.nome)] = { vendas: Number(r.vendas) || 0, faturamento: Number(r.faturamento) || 0, operation: r.expert || "", genero: (r.genero || "").toUpperCase() };
  }
  return out;
}

export { resolveChannelMaps };
