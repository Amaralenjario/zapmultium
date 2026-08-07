"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Swords, Crown, Flame, Trophy, TrendingUp, Users, HelpCircle, Sparkles, DollarSign } from "lucide-react";

interface RankRow {
  rank: number;
  utm: string;
  name: string;
  avatar: string | null;
  expert: string | null;
  meta: number;
  vendas: number;
  faturamento: number;
  points: number;
  isWolf: boolean;
}
interface RankData {
  range: string;
  isAdmin: boolean;
  period: { start: string; end: string };
  updatedAt: string;
  wolf: { utm: string; name: string; avatar: string | null; expert: string | null; vendas: number; faturamento: number } | null;
  totalVendas: number;
  totalFaturamento: number;
  ranking: RankRow[];
}

// Vendedores veem Hoje/Ontem/7 dias/Mês. "Geral" é exclusivo de admin.
const BASE_RANGES = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "mes", label: "Mês" },
];
const ADMIN_RANGE = { key: "geral", label: "Geral" };

function initials(name: string) {
  return (name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}
function firstName(name: string) {
  return (name || "").split(" ")[0] || name;
}
function fmtBRL(n: number) {
  if (n >= 1000) return "R$ " + (n / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "k";
  return "R$ " + Math.round(n).toLocaleString("pt-BR");
}

const medalColor = ["#FFD65A", "#C8D2E0", "#E8A15A"];

function Avatar({ name, url, size = 40, ring }: { name: string; url: string | null; size?: number; ring?: string }) {
  const style: React.CSSProperties = { width: size, height: size };
  if (ring) style.boxShadow = `0 0 0 3px ${ring}`;
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} className="rounded-full object-cover flex-shrink-0" style={style} />
  ) : (
    <div className="rounded-full bg-accentsoft flex items-center justify-center flex-shrink-0" style={style}>
      <span className="font-extrabold text-accent" style={{ fontSize: size * 0.36 }}>{initials(name)}</span>
    </div>
  );
}

export default function RankingPage() {
  const [range, setRange] = useState("hoje");
  const [data, setData] = useState<RankData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const firstLoad = useRef(true);

  const fetchData = useCallback(async (r: string, silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`/api/ranking?range=${r}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erro");
      setData(d);
    } catch {
      /* mantém dados anteriores */
    } finally {
      setLoading(false); setRefreshing(false); firstLoad.current = false;
    }
  }, []);

  useEffect(() => { fetchData(range, !firstLoad.current); }, [range, fetchData]);

  useEffect(() => {
    const id = setInterval(() => fetchData(range, true), 15000);
    return () => clearInterval(id);
  }, [range, fetchData]);

  const wolf = data?.wolf || null;
  const ranking = data?.ranking || [];
  const top3 = ranking.slice(0, 3);
  const maxVendas = Math.max(1, ...ranking.map((r) => r.vendas));
  const hasSales = (data?.totalVendas || 0) > 0;
  const updated = data ? new Date(data.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
  const periodoLabel = range === "hoje" ? "hoje" : range === "ontem" ? "ontem" : range === "mes" ? "no mês" : range === "geral" ? "no total" : "no período";
  const isAdmin = data?.isAdmin ?? false;
  const ranges = isAdmin ? [...BASE_RANGES, ADMIN_RANGE] : BASE_RANGES;

  return (
    <div className="max-w-4xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-card bg-gradient-to-br from-accent to-violet-500 flex items-center justify-center shadow-glow">
            <Swords className="w-6 h-6 text-white" strokeWidth={2.1} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-tx flex items-center gap-2">
              Ranking <span className="text-tx3 font-bold">·</span> <span className="text-accent">Lobo do X1</span>
            </h1>
            <p className="text-tx2 text-sm mt-0.5">Quem mais vende assume o trono 🐺</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-success-soft text-success px-3 py-1.5 text-xs font-bold flex-shrink-0">
          <span className="w-2 h-2 rounded-full bg-success wolf-live-dot" />
          Ao vivo
        </div>
      </div>

      {/* Period tabs */}
      <div className="flex items-center gap-1 p-1 rounded-control bg-surface2 border border-bd w-fit mb-6">
        {ranges.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`px-3.5 py-1.5 rounded-[8px] text-sm font-bold transition ${
              range === r.key ? "bg-accent text-white shadow-glow" : "text-tx2 hover:text-tx hover:bg-hover"
            }`}
          >
            {r.label}
          </button>
        ))}
        {refreshing && <span className="ml-1 text-[11px] text-tx3 font-semibold animate-pulse">atualizando…</span>}
      </div>

      {loading ? (
        <div className="rounded-card border border-bd bg-surface h-64 animate-pulse" />
      ) : (
        <>
          {/* HERO: Lobo do X1 ou estado de caça */}
          {wolf ? (
            <div
              className="relative overflow-hidden rounded-card p-6 sm:p-8 mb-6 wolf-rise"
              style={{ background: "linear-gradient(135deg, var(--accent) 0%, #7C3AED 100%)" }}
            >
              <div className="absolute inset-0 wolf-shimmer pointer-events-none" />
              <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-white/10 wolf-spin-slow" style={{ maskImage: "radial-gradient(closest-side, transparent 60%, black 62%)" }} />
              <div className="relative flex flex-col sm:flex-row items-center gap-6">
                <div className="relative wolf-float">
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-3xl drop-shadow-lg">👑</div>
                  <div className="rounded-full wolf-aura">
                    <Avatar name={wolf.name} url={wolf.avatar} size={104} ring="rgba(255,255,255,0.9)" />
                  </div>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-2xl wolf-flame">🔥</div>
                </div>
                <div className="text-center sm:text-left flex-1">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-black/25 text-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] mb-2">
                    <Crown className="w-3.5 h-3.5" strokeWidth={2.5} /> Lobo do X1
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-[-0.03em] flex items-center gap-2 justify-center sm:justify-start">
                    🐺 {wolf.name}
                  </h2>
                  {wolf.expert && <p className="text-white/70 text-xs font-bold mt-0.5">Operação {wolf.expert}</p>}
                  <div className="flex items-center gap-4 mt-3 justify-center sm:justify-start">
                    <div className="text-white">
                      <span className="text-3xl font-extrabold tabular-nums">{wolf.vendas}</span>
                      <span className="text-sm font-bold text-white/80 ml-1.5">{wolf.vendas === 1 ? "venda" : "vendas"}</span>
                    </div>
                    <div className="h-8 w-px bg-white/25" />
                    <div className="text-white/95 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4" strokeWidth={2.4} />
                      <span className="text-xl font-extrabold tabular-nums">{fmtBRL(wolf.faturamento)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-card border border-bd bg-surface p-8 mb-6 text-center wolf-rise">
              <div className="absolute inset-0 bg-gradient-to-br from-accentsoft/60 to-transparent pointer-events-none" />
              <div className="relative">
                <div className="mx-auto w-28 h-28 rounded-full bg-surface2 border-2 border-dashed border-bd flex items-center justify-center mb-4 relative">
                  <span className="text-6xl wolf-pulse-q select-none">🐺</span>
                  <div className="absolute -top-2 -right-1 w-9 h-9 rounded-full bg-accent flex items-center justify-center shadow-glow wolf-float">
                    <HelpCircle className="w-5 h-5 text-white" strokeWidth={2.5} />
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-accentsoft text-accent px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] mb-2">
                  <Flame className="w-3.5 h-3.5 wolf-flame" strokeWidth={2.5} /> Na caça do Lobo do X1
                </div>
                <h2 className="text-2xl font-extrabold text-tx tracking-[-0.02em]">O trono está vazio</h2>
                <p className="text-tx2 text-sm mt-1.5 max-w-md mx-auto">
                  Ninguém fechou venda {periodoLabel} ainda. O <b className="text-accent">primeiro a vender</b> vira o Lobo do X1 e assume o topo. 🔥
                </p>
              </div>
            </div>
          )}

          {/* Pódio (só quando há vendas) */}
          {hasSales && top3.length >= 2 && (
            <div className="grid grid-cols-3 gap-3 mb-6 items-end">
              {[1, 0, 2].map((pos, i) => {
                const r = top3[pos];
                if (!r) return <div key={`podium-${pos}`} />;
                const heights = ["h-20", "h-28", "h-16"];
                const hClass = pos === 0 ? heights[1] : pos === 1 ? heights[0] : heights[2];
                return (
                  <div key={`podium-${pos}`} className="flex flex-col items-center wolf-rise" style={{ animationDelay: `${i * 90}ms` }}>
                    <div className="relative mb-2">
                      <Avatar name={r.name} url={r.avatar} size={pos === 0 ? 68 : 54} ring={r.vendas > 0 ? medalColor[pos] : undefined} />
                      <div className="absolute -bottom-1 -right-1 text-lg">{["🥇", "🥈", "🥉"][pos]}</div>
                    </div>
                    <p className="text-sm font-bold text-tx truncate max-w-[100px] text-center">{firstName(r.name)}</p>
                    <p className="text-xs text-tx3 font-semibold">{r.vendas} {r.vendas === 1 ? "venda" : "vendas"}</p>
                    <p className="text-[11px] text-accent font-bold mb-1.5">{fmtBRL(r.faturamento)}</p>
                    <div className={`w-full ${hClass} rounded-t-control flex items-start justify-center pt-2 font-extrabold text-white`}
                      style={{ background: `linear-gradient(180deg, ${medalColor[pos]}, ${medalColor[pos]}99)` }}>
                      <span className="text-lg drop-shadow">{r.rank}º</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Leaderboard completo */}
          <div className="rounded-card border border-bd bg-surface overflow-hidden">
            <div className="px-5 py-3.5 border-b border-bd flex items-center justify-between">
              <h3 className="text-sm font-bold text-tx flex items-center gap-2"><Trophy className="w-4 h-4 text-accent" strokeWidth={2.2} /> Classificação</h3>
              <div className="flex items-center gap-3 text-xs text-tx3 font-semibold">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" strokeWidth={2} /> {ranking.length}</span>
                <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" strokeWidth={2} /> {data?.totalVendas || 0} vendas</span>
                <span className="flex items-center gap-1 text-accent"><DollarSign className="w-3.5 h-3.5" strokeWidth={2} /> {fmtBRL(data?.totalFaturamento || 0)}</span>
              </div>
            </div>

            {ranking.length === 0 ? (
              <div className="p-12 text-center text-tx3">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" strokeWidth={1.5} />
                <p className="font-semibold text-tx2">Nenhum vendedor encontrado</p>
              </div>
            ) : (
              <div className="divide-y divide-line">
                {ranking.map((r, i) => {
                  const pct = Math.round((r.vendas / maxVendas) * 100);
                  const isTop3 = r.rank <= 3 && r.vendas > 0;
                  return (
                    <div
                      key={r.utm}
                      className={`flex items-center gap-3 px-4 sm:px-5 py-3 wolf-rise transition ${r.isWolf ? "bg-accentsoft/50" : "hover:bg-rowhover"}`}
                      style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}
                    >
                      <div className="w-8 flex-shrink-0 flex items-center justify-center">
                        {isTop3 ? (
                          <span className="text-xl">{["🥇", "🥈", "🥉"][r.rank - 1]}</span>
                        ) : (
                          <span className="text-sm font-extrabold text-tx3 tabular-nums">{r.rank}º</span>
                        )}
                      </div>
                      <Avatar name={r.name} url={r.avatar} size={40} ring={r.isWolf ? "var(--accent)" : undefined} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-tx truncate">{r.name}</p>
                          {r.isWolf && <span className="text-[10px] font-extrabold text-white bg-accent rounded-full px-1.5 py-0.5 flex items-center gap-0.5">🐺 LOBO</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {r.expert && <span className="text-[10px] text-tx3 font-semibold">{r.expert}</span>}
                          <div className="mt-1 h-1.5 rounded-full bg-surface2 overflow-hidden flex-1">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: r.isWolf ? "linear-gradient(90deg, var(--accent), #7C3AED)" : "var(--accent)" }} />
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-lg font-extrabold text-tx tabular-nums leading-none">{r.vendas}</div>
                        <div className="text-[10px] font-bold text-tx3 uppercase tracking-wide">{r.vendas === 1 ? "venda" : "vendas"}</div>
                      </div>
                      <div className="hidden sm:flex flex-col items-end w-20 flex-shrink-0">
                        <div className="text-sm font-bold text-accent tabular-nums">{fmtBRL(r.faturamento)}</div>
                        <div className="text-[10px] text-tx3 font-semibold">faturado</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-center text-xs text-tx3 mt-4 flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success wolf-live-dot" />
            Vendas reais · atualiza automaticamente · última {updated}
          </p>
        </>
      )}
    </div>
  );
}
