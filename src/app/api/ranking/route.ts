import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSb } from "@supabase/supabase-js";
import { resolveChannelMaps } from "@/lib/attribution";

export const dynamic = "force-dynamic";

const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

function brToday(): string {
  try { return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); }
  catch { return new Date(Date.now() - 3 * 3600000).toISOString().split("T")[0]; }
}

// Janela do período selecionado (Hoje/Ontem/7d/Mês/Geral).
function rankingDates(range: string): { start: string; end: string } {
  const today = brToday();
  if (range === "geral") return { start: "2000-01-01", end: today };
  if (range === "hoje") return { start: today, end: today };
  if (range === "ontem") {
    const d = new Date(today + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - 1);
    const y = d.toISOString().slice(0, 10); return { start: y, end: y };
  }
  if (range === "mes") return { start: today.slice(0, 8) + "01", end: today };
  const days: Record<string, number> = { "7d": 6, "30d": 29 };
  const d = new Date(today + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - (days[range] ?? 6));
  return { start: d.toISOString().slice(0, 10), end: today };
}

// Mês passado (calendário) — o Lobo/Rainha é sempre o campeão do mês anterior.
function lastMonthRange(): { start: string; end: string; label: string } {
  const firstThis = new Date(brToday().slice(0, 8) + "01T12:00:00Z");
  const end = new Date(firstThis); end.setUTCDate(0); // último dia do mês anterior
  const endStr = end.toISOString().slice(0, 10);
  const label = end.toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
  return { start: endStr.slice(0, 8) + "01", end: endStr, label };
}

// Ranking de vendas do X1 por operação, com Lobo (homem) / Rainha (mulher) do mês passado.
export async function GET(request: Request) {
  const serverClient = createServerClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: prof } = await serverClient.from("profiles").select("role, full_name").eq("id", user.id).single();
  const isAdmin = prof?.role === "admin" || prof?.role === "supervisor";
  const myName = prof?.full_name || "";

  const mUrl = process.env.MULTIUM_SUPABASE_URL;
  const mKey = process.env.MULTIUM_SUPABASE_ANON_KEY;
  if (!mUrl || !mKey) return NextResponse.json({ error: "Fonte de vendas (Multium) não configurada" }, { status: 500 });

  const range = new URL(request.url).searchParams.get("range") || "hoje";
  if (range === "geral" && !isAdmin) {
    return NextResponse.json({ error: "Apenas administradores podem ver o ranking geral" }, { status: 403 });
  }

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = svcKey ? createSb(process.env.NEXT_PUBLIC_SUPABASE_URL!, svcKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;

  // Fotos do perfil ZapMultium (fallback quando o vendedor não tem foto no banco de vendas).
  const avatarByName: Record<string, string> = {};
  if (admin) {
    try {
      const { data: profs } = await admin.from("profiles").select("full_name, avatar_url").not("avatar_url", "is", null);
      for (const p of (profs as any[]) || []) if (p.full_name && p.avatar_url) avatarByName[norm(p.full_name)] = p.avatar_url;
    } catch {}
  }

  const multium = createSb(mUrl, mKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const period = rankingDates(range);
  const lm = lastMonthRange();
  const [periodRes, champRes] = await Promise.all([
    multium.rpc("x1_ranking", { p_start: period.start, p_end: period.end }),
    multium.rpc("x1_ranking", { p_start: lm.start, p_end: lm.end }),
  ]);
  if (periodRes.error) return NextResponse.json({ error: periodRes.error.message }, { status: 502 });

  const decorate = (r: any) => {
    const vendas = Number(r.vendas) || 0;
    const faturamento = Number(r.faturamento) || 0;
    return {
      utm: r.utm, name: r.nome || r.utm || "Vendedor",
      avatar: r.foto_url || avatarByName[norm(r.nome)] || null,
      expert: r.expert || "Sem operação", genero: (r.genero || "").toUpperCase(),
      vendas, faturamento,
    };
  };
  const periodRows = ((periodRes.data as any[]) || []).map(decorate);
  const champRows = ((champRes.data as any[]) || []).map(decorate);

  // Operações (experts) presentes.
  const experts = Array.from(new Set(periodRows.map((r) => r.expert))).filter(Boolean);

  // Escopo: vendedor vê SÓ a operação dele; admin vê todas.
  let visibleExperts = experts;
  if (!isAdmin) {
    let myExpert: string | null = null;
    if (admin) {
      try {
        const maps = await resolveChannelMaps(admin);
        const phones = maps.sellerToPhones[user.id] || [];
        for (const ph of phones) {
          const opName = maps.phoneToOp[ph]?.name;
          if (!opName) continue;
          const e = experts.find((E) => norm(opName).includes(norm(E)) || norm(E).includes(norm(opName)));
          if (e) { myExpert = e; break; }
        }
      } catch {}
    }
    // Fallback: casa o nome do vendedor com um vendedor do Multium → expert dele.
    if (!myExpert) {
      const hit = periodRows.find((r) => norm(r.name) === norm(myName));
      if (hit) myExpert = hit.expert;
    }
    visibleExperts = myExpert ? [myExpert] : experts; // sem match → mostra tudo (raro)
  }

  const operations = visibleExperts.map((expert) => {
    const rows = periodRows.filter((r) => r.expert === expert)
      .sort((a, b) => b.vendas - a.vendas || b.faturamento - a.faturamento);
    const champCandidates = champRows.filter((r) => r.expert === expert && r.vendas > 0)
      .sort((a, b) => b.vendas - a.vendas || b.faturamento - a.faturamento);
    const champ = champCandidates[0] || null;
    const ranking = rows.map((r, i) => ({ ...r, rank: i + 1, isChampion: !!champ && r.utm === champ.utm }));
    return {
      key: expert,
      // Homem = Lobo, Mulher = Rainha. Sem gênero definido → Lobo (padrão da marca).
      title: champ && champ.genero === "F" ? "rainha" : "lobo",
      champion: champ ? { name: champ.name, avatar: champ.avatar, vendas: champ.vendas, faturamento: champ.faturamento, genero: champ.genero } : null,
      ranking,
      totalVendas: rows.reduce((a, b) => a + b.vendas, 0),
      totalFaturamento: rows.reduce((a, b) => a + b.faturamento, 0),
    };
  });

  return NextResponse.json({
    isAdmin,
    range,
    monthLabel: lm.label,
    updatedAt: new Date().toISOString(),
    operations,
  });
}
