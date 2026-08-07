import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSb } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Janela de datas (só a data, no fuso do Brasil) para o período do ranking.
function rankingDates(range: string): { start: string; end: string } {
  const now = new Date();
  let brToday: string;
  try {
    brToday = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  } catch {
    brToday = new Date(now.getTime() - 3 * 3600000).toISOString().split("T")[0];
  }
  if (range === "geral") return { start: "2000-01-01", end: brToday };
  if (range === "hoje") return { start: brToday, end: brToday };
  if (range === "ontem") {
    const d = new Date(brToday + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    const y = d.toISOString().slice(0, 10);
    return { start: y, end: y };
  }
  if (range === "mes") return { start: brToday.slice(0, 8) + "01", end: brToday };
  const days: Record<string, number> = { "7d": 6, "30d": 29 };
  const back = days[range] ?? 6;
  const d = new Date(brToday + "T00:00:00-03:00");
  d.setUTCDate(d.getUTCDate() - back);
  return { start: d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }), end: brToday };
}

// Ranking de vendas do X1 — dados reais do banco Multium (RPC read-only x1_ranking).
// Visível a TODOS os autenticados (vendedores e admins).
export async function GET(request: Request) {
  const serverClient = createServerClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Papel do usuário — "Geral" é exclusivo de admin/supervisor.
  const { data: prof } = await serverClient.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = prof?.role === "admin" || prof?.role === "supervisor";

  const url = process.env.MULTIUM_SUPABASE_URL;
  const key = process.env.MULTIUM_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Fonte de vendas (Multium) não configurada" }, { status: 500 });
  }

  const range = new URL(request.url).searchParams.get("range") || "hoje";
  // Blindagem server-side: vendedor não vê o total geral, nem batendo direto na API.
  if (range === "geral" && !isAdmin) {
    return NextResponse.json({ error: "Apenas administradores podem ver o ranking geral" }, { status: 403 });
  }
  const { start, end } = rankingDates(range);

  const multium = createSb(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await multium.rpc("x1_ranking", { p_start: start, p_end: end });
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });

  const rows = (data as any[]) || [];
  const list = rows.map((r) => {
    const vendas = Number(r.vendas) || 0;
    const faturamento = Number(r.faturamento) || 0;
    return {
      utm: r.utm,
      name: r.nome || r.utm || "Vendedor",
      avatar: r.foto_url || null,
      expert: r.expert || null,      // operação (Caio / Gustavo / Jessica)
      meta: Number(r.meta) || 0,
      vendas,
      faturamento,
      // Pontuação da gamificação (venda pesa muito + fração do faturamento).
      points: vendas * 100 + Math.round(faturamento / 100),
    };
  });

  // Ordena por vendas, desempata por faturamento.
  list.sort((a, b) => b.vendas - a.vendas || b.faturamento - a.faturamento);

  const ranking = list.map((r, i) => ({ ...r, rank: i + 1, isWolf: i === 0 && r.vendas > 0 }));
  const totalVendas = ranking.reduce((a, b) => a + b.vendas, 0);
  const totalFaturamento = ranking.reduce((a, b) => a + b.faturamento, 0);
  const leader = ranking[0];
  const wolf = leader && leader.vendas > 0
    ? { utm: leader.utm, name: leader.name, avatar: leader.avatar, expert: leader.expert, vendas: leader.vendas, faturamento: leader.faturamento }
    : null;

  return NextResponse.json({
    range,
    isAdmin,
    period: { start, end },
    updatedAt: new Date().toISOString(),
    wolf,
    totalVendas,
    totalFaturamento,
    ranking,
  });
}
