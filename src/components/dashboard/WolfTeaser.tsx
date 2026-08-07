"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Swords, Crown, HelpCircle, ChevronRight, Flame } from "lucide-react";

interface Wolf { name: string; avatar: string | null; vendas: number; faturamento?: number; }

function initials(name: string) {
  return (name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}
function fmtBRL(n: number) {
  if (n >= 1000) return "R$ " + (n / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "k";
  return "R$ " + Math.round(n).toLocaleString("pt-BR");
}

export default function WolfTeaser() {
  const [wolf, setWolf] = useState<Wolf | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/ranking?range=hoje", { cache: "no-store" });
        const d = await res.json();
        if (alive) { setWolf(d.wolf || null); setLoaded(true); }
      } catch { if (alive) setLoaded(true); }
    };
    load();
    const id = setInterval(load, 20000); // ao vivo
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <Link
      href="/dashboard/ranking"
      className="group relative block overflow-hidden rounded-card p-5 shadow-card transition hover:shadow-glow"
      style={{ background: wolf ? "linear-gradient(135deg, var(--accent) 0%, #7C3AED 100%)" : undefined }}
    >
      {/* fundo do estado "caça" */}
      {!wolf && <div className="absolute inset-0 bg-gradient-to-br from-accentsoft to-transparent" />}
      {wolf && <div className="absolute inset-0 wolf-shimmer pointer-events-none" />}

      <div className="relative flex items-center gap-4">
        {wolf ? (
          <div className="relative wolf-float flex-shrink-0">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-lg">👑</div>
            <div className="rounded-full wolf-aura">
              {wolf.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={wolf.avatar} alt={wolf.name} className="w-14 h-14 rounded-full object-cover" style={{ boxShadow: "0 0 0 3px rgba(255,255,255,0.9)" }} />
              ) : (
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center" style={{ boxShadow: "0 0 0 3px rgba(255,255,255,0.9)" }}>
                  <span className="text-white font-extrabold text-lg">{initials(wolf.name)}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="relative w-14 h-14 rounded-full bg-surface2 border-2 border-dashed border-bd flex items-center justify-center flex-shrink-0">
            <span className="text-2xl wolf-pulse-q select-none">🐺</span>
            <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-accent flex items-center justify-center shadow-glow">
              <HelpCircle className="w-3.5 h-3.5 text-white" strokeWidth={2.6} />
            </div>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] mb-1 ${wolf ? "bg-black/25 text-white" : "bg-accentsoft text-accent"}`}>
            {wolf ? <Crown className="w-3 h-3" strokeWidth={2.6} /> : <Flame className="w-3 h-3 wolf-flame" strokeWidth={2.6} />}
            {wolf ? "Lobo do X1" : "Na caça do Lobo do X1"}
          </div>
          {wolf ? (
            <>
              <p className="text-lg font-extrabold text-white truncate tracking-[-0.02em]">🐺 {wolf.name}</p>
              <p className="text-xs font-bold text-white/80">
                {wolf.vendas} {wolf.vendas === 1 ? "venda hoje" : "vendas hoje"}
                {wolf.faturamento ? ` · ${fmtBRL(wolf.faturamento)}` : ""} · lidera o X1
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-extrabold text-tx tracking-[-0.02em]">O trono está vazio…</p>
              <p className="text-xs font-semibold text-tx2">Quem fechar a 1ª venda vira o Lobo. Veja o ranking ao vivo.</p>
            </>
          )}
        </div>

        <div className={`flex items-center gap-1 text-xs font-bold flex-shrink-0 ${wolf ? "text-white/90" : "text-accent"} ${loaded ? "" : "opacity-0"}`}>
          <Swords className="w-4 h-4" strokeWidth={2.2} />
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition" strokeWidth={2.5} />
        </div>
      </div>
    </Link>
  );
}
