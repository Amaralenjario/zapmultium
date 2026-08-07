"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Swords, Crown, ChevronRight } from "lucide-react";

interface Champion { name: string; avatar: string | null; vendas: number; faturamento: number; }

function initials(name: string) { return (name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase(); }
function fmtBRL(n: number) {
  if (n >= 1000) return "R$ " + (n / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "k";
  return "R$ " + Math.round(n).toLocaleString("pt-BR");
}

const THEME = {
  lobo: { grad: "linear-gradient(135deg, var(--accent) 0%, #7C3AED 100%)", emoji: "🐺", label: "Lobo do X1" },
  rainha: { grad: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)", emoji: "👑", label: "Rainha do X1" },
} as const;

export default function WolfTeaser() {
  const [champ, setChamp] = useState<{ title: "lobo" | "rainha"; op: string; champion: Champion } | null>(null);
  const [monthLabel, setMonthLabel] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/ranking?range=hoje", { cache: "no-store" });
        const d = await res.json();
        if (!alive) return;
        setMonthLabel(d.monthLabel || "");
        // pega o campeão com mais vendas entre as operações visíveis
        const withChamp = (d.operations || []).filter((o: any) => o.champion);
        withChamp.sort((a: any, b: any) => b.champion.vendas - a.champion.vendas);
        const top = withChamp[0];
        setChamp(top ? { title: top.title, op: top.key, champion: top.champion } : null);
        setLoaded(true);
      } catch { if (alive) setLoaded(true); }
    };
    load();
    const id = setInterval(load, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const t = champ ? THEME[champ.title] : THEME.lobo;

  return (
    <Link href="/dashboard/ranking" className="group relative block overflow-hidden rounded-card p-5 shadow-card transition hover:shadow-glow"
      style={{ background: champ ? t.grad : undefined }}>
      {!champ && <div className="absolute inset-0 bg-gradient-to-br from-accentsoft to-transparent" />}
      {champ && <div className="absolute inset-0 wolf-shimmer pointer-events-none" />}

      <div className="relative flex items-center gap-4">
        {champ ? (
          <div className="relative wolf-float flex-shrink-0">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-lg">👑</div>
            <div className="rounded-full wolf-aura">
              {champ.champion.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={champ.champion.avatar} alt={champ.champion.name} className="w-14 h-14 rounded-full object-cover" style={{ boxShadow: "0 0 0 3px rgba(255,255,255,0.9)" }} />
              ) : (
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center" style={{ boxShadow: "0 0 0 3px rgba(255,255,255,0.9)" }}>
                  <span className="text-white font-extrabold text-lg">{initials(champ.champion.name)}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="relative w-14 h-14 rounded-full bg-surface2 border-2 border-dashed border-bd flex items-center justify-center flex-shrink-0">
            <span className="text-2xl wolf-pulse-q select-none">🐺</span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] mb-1 ${champ ? "bg-black/25 text-white" : "bg-accentsoft text-accent"}`}>
            <Crown className="w-3 h-3" strokeWidth={2.6} /> {champ ? `${t.label}${champ.op ? " · " + champ.op : ""}` : "X1 · Ranking"}
          </div>
          {champ ? (
            <>
              <p className="text-lg font-extrabold text-white truncate tracking-[-0.02em]">{t.emoji} {champ.champion.name}</p>
              <p className="text-xs font-bold text-white/80">{champ.champion.vendas} vendas · {fmtBRL(champ.champion.faturamento)} em {monthLabel}</p>
            </>
          ) : (
            <>
              <p className="text-base font-extrabold text-tx tracking-[-0.02em]">Veja o ranking do X1</p>
              <p className="text-xs font-semibold text-tx2">Lobo e Rainha de cada operação, vendas ao vivo.</p>
            </>
          )}
        </div>

        <div className={`flex items-center gap-1 text-xs font-bold flex-shrink-0 ${champ ? "text-white/90" : "text-accent"} ${loaded ? "" : "opacity-0"}`}>
          <Swords className="w-4 h-4" strokeWidth={2.2} />
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition" strokeWidth={2.5} />
        </div>
      </div>
    </Link>
  );
}
