"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Swords, Crown, Trophy, TrendingUp, Users, HelpCircle, DollarSign, Building2 } from "lucide-react";

interface RankRow {
  rank: number; utm: string; name: string; avatar: string | null;
  genero: string; vendas: number; faturamento: number; isChampion: boolean;
}
interface Operation {
  key: string;
  title: "lobo" | "rainha";
  champion: { name: string; avatar: string | null; vendas: number; faturamento: number; genero: string } | null;
  ranking: RankRow[];
  totalVendas: number;
  totalFaturamento: number;
}
interface RankData {
  isAdmin: boolean;
  range: string;
  monthLabel: string;
  updatedAt: string;
  operations: Operation[];
}

const BASE_RANGES = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "mes", label: "Mês" },
];
const ADMIN_RANGE = { key: "geral", label: "Geral" };

// Tema por gênero do campeão.
const THEME = {
  lobo: { grad: "linear-gradient(135deg, var(--accent) 0%, #7C3AED 100%)", emoji: "🐺", label: "Lobo do X1", accent: "var(--accent)", spark: "🔥", auraCls: "wolf-aura", sparkCls: "wolf-flame", ring: "rgba(255,255,255,0.9)" },
  rainha: { grad: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)", emoji: "👑", label: "Rainha do X1", accent: "#EC4899", spark: "✨", auraCls: "queen-aura", sparkCls: "queen-sparkle", ring: "rgba(255,255,255,0.95)" },
} as const;

function initials(name: string) { return (name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase(); }
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

function OperationBlock({ op, monthLabel }: { op: Operation; monthLabel: string }) {
  const t = THEME[op.title];
  const champ = op.champion;
  const ranking = op.ranking;
  const maxVendas = Math.max(1, ...ranking.map((r) => r.vendas));
  const reinado = op.title === "rainha" ? "Rainha" : "Lobo";
  const campeaLabel = op.title === "rainha" ? "Campeã" : "Campeão";

  return (
    <div className="mb-8 wolf-rise">
      {/* Campeão(ã) do mês passado */}
      {champ ? (
        <div className="relative overflow-hidden rounded-card p-6 sm:p-8 mb-5" style={{ background: t.grad }}>
          <div className="absolute inset-0 wolf-shimmer pointer-events-none" />
          <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-white/10 wolf-spin-slow" style={{ maskImage: "radial-gradient(closest-side, transparent 60%, black 62%)" }} />
          <div className="relative flex flex-col sm:flex-row items-center gap-6">
            <div className="relative wolf-float">
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-3xl drop-shadow-lg">👑</div>
              <div className={`rounded-full ${t.auraCls}`}>
                <Avatar name={champ.name} url={champ.avatar} size={104} ring={t.ring} />
              </div>
              <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 text-2xl ${t.sparkCls}`}>{t.spark}</div>
            </div>
            <div className="text-center sm:text-left flex-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-black/25 text-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] mb-2">
                <Crown className="w-3.5 h-3.5" strokeWidth={2.5} /> {t.label}
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-[-0.03em] flex items-center gap-2 justify-center sm:justify-start">
                {t.emoji} {champ.name}
              </h2>
              <p className="text-white/75 text-xs font-bold mt-1">{campeaLabel} de {monthLabel} · Operação {op.key}</p>
              <div className="flex items-center gap-4 mt-3 justify-center sm:justify-start">
                <div className="text-white">
                  <span className="text-3xl font-extrabold tabular-nums">{champ.vendas}</span>
                  <span className="text-sm font-bold text-white/80 ml-1.5">{champ.vendas === 1 ? "venda" : "vendas"}</span>
                </div>
                <div className="h-8 w-px bg-white/25" />
                <div className="text-white/95 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" strokeWidth={2.4} />
                  <span className="text-xl font-extrabold tabular-nums">{fmtBRL(champ.faturamento)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-card border border-bd bg-surface p-8 mb-5 text-center">
          <div className="mx-auto w-24 h-24 rounded-full bg-surface2 border-2 border-dashed border-bd flex items-center justify-center mb-3 relative">
            <span className="text-5xl wolf-pulse-q select-none">{t.emoji}</span>
            <div className="absolute -top-1.5 -right-1 w-8 h-8 rounded-full bg-accent flex items-center justify-center shadow-glow"><HelpCircle className="w-4.5 h-4.5 text-white" strokeWidth={2.5} /></div>
          </div>
          <p className="text-lg font-extrabold text-tx">Sem {reinado} do X1 em {monthLabel}</p>
          <p className="text-tx2 text-sm mt-1">Ninguém registrou venda na operação {op.key} no mês passado.</p>
        </div>
      )}

      {/* Ranking do período (dessa operação) */}
      <div className="rounded-card border border-bd bg-surface overflow-hidden">
        <div className="px-5 py-3.5 border-b border-bd flex items-center justify-between">
          <h3 className="text-sm font-bold text-tx flex items-center gap-2"><Trophy className="w-4 h-4" strokeWidth={2.2} style={{ color: t.accent }} /> Operação {op.key}</h3>
          <div className="flex items-center gap-3 text-xs text-tx3 font-semibold">
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" strokeWidth={2} /> {ranking.length}</span>
            <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" strokeWidth={2} /> {op.totalVendas} vendas</span>
            <span className="flex items-center gap-1" style={{ color: t.accent }}><DollarSign className="w-3.5 h-3.5" strokeWidth={2} /> {fmtBRL(op.totalFaturamento)}</span>
          </div>
        </div>
        {ranking.length === 0 ? (
          <div className="p-10 text-center text-tx3"><Users className="w-9 h-9 mx-auto mb-2 opacity-30" strokeWidth={1.5} /><p className="font-semibold text-tx2">Nenhum vendedor</p></div>
        ) : (
          <div className="divide-y divide-line">
            {ranking.map((r, i) => {
              const pct = Math.round((r.vendas / maxVendas) * 100);
              const isTop3 = r.rank <= 3 && r.vendas > 0;
              return (
                <div key={r.utm} className={`flex items-center gap-3 px-4 sm:px-5 py-3 transition ${r.rank === 1 && r.vendas > 0 ? "bg-accentsoft/40" : "hover:bg-rowhover"}`}>
                  <div className="w-8 flex-shrink-0 flex items-center justify-center">
                    {isTop3 ? <span className="text-xl">{["🥇", "🥈", "🥉"][r.rank - 1]}</span> : <span className="text-sm font-extrabold text-tx3 tabular-nums">{r.rank}º</span>}
                  </div>
                  <Avatar name={r.name} url={r.avatar} size={40} ring={r.rank === 1 && r.vendas > 0 ? t.accent : undefined} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-tx truncate">{r.name}</p>
                    <div className="mt-1 h-1.5 rounded-full bg-surface2 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.rank === 1 && r.vendas > 0 ? t.grad : t.accent }} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-extrabold text-tx tabular-nums leading-none">{r.vendas}</div>
                    <div className="text-[10px] font-bold text-tx3 uppercase tracking-wide">{r.vendas === 1 ? "venda" : "vendas"}</div>
                  </div>
                  <div className="hidden sm:flex flex-col items-end w-20 flex-shrink-0">
                    <div className="text-sm font-bold tabular-nums" style={{ color: t.accent }}>{fmtBRL(r.faturamento)}</div>
                    <div className="text-[10px] text-tx3 font-semibold">faturado</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RankingPage() {
  const [range, setRange] = useState("hoje");
  const [data, setData] = useState<RankData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [opIdx, setOpIdx] = useState(0);
  const firstLoad = useRef(true);

  const fetchData = useCallback(async (r: string, silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`/api/ranking?range=${r}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erro");
      setData(d);
    } catch { /* mantém */ } finally { setLoading(false); setRefreshing(false); firstLoad.current = false; }
  }, []);

  useEffect(() => { fetchData(range, !firstLoad.current); }, [range, fetchData]);
  useEffect(() => { const id = setInterval(() => fetchData(range, true), 15000); return () => clearInterval(id); }, [range, fetchData]);

  const isAdmin = data?.isAdmin ?? false;
  const ranges = isAdmin ? [...BASE_RANGES, ADMIN_RANGE] : BASE_RANGES;
  const operations = data?.operations ?? [];
  const multiOp = operations.length > 1;
  const safeIdx = Math.min(opIdx, Math.max(0, operations.length - 1));
  const shown = multiOp ? [operations[safeIdx]].filter(Boolean) : operations;
  const updated = data ? new Date(data.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-card bg-gradient-to-br from-accent to-violet-500 flex items-center justify-center shadow-glow">
            <Swords className="w-6 h-6 text-white" strokeWidth={2.1} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-tx flex items-center gap-2">Ranking <span className="text-tx3 font-bold">·</span> <span className="text-accent">X1</span></h1>
            <p className="text-tx2 text-sm mt-0.5">O campeão de {data?.monthLabel || "…"} reina como Lobo/Rainha 🐺👑</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-success-soft text-success px-3 py-1.5 text-xs font-bold flex-shrink-0">
          <span className="w-2 h-2 rounded-full bg-success wolf-live-dot" /> Ao vivo
        </div>
      </div>

      {/* Filtros de período */}
      <div className="flex items-center gap-1 p-1 rounded-control bg-surface2 border border-bd w-fit mb-4">
        {ranges.map((r) => (
          <button key={r.key} onClick={() => setRange(r.key)}
            className={`px-3.5 py-1.5 rounded-[8px] text-sm font-bold transition ${range === r.key ? "bg-accent text-white shadow-glow" : "text-tx2 hover:text-tx hover:bg-hover"}`}>
            {r.label}
          </button>
        ))}
        {refreshing && <span className="ml-1 text-[11px] text-tx3 font-semibold animate-pulse">atualizando…</span>}
      </div>

      {/* Seletor de operação (admin com várias) */}
      {multiOp && (
        <div className="flex items-center gap-1.5 flex-wrap mb-6">
          {operations.map((op, i) => (
            <button key={op.key} onClick={() => setOpIdx(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-control text-sm font-bold border transition ${i === safeIdx ? "bg-accentsoft text-accent border-accent/40" : "bg-surface text-tx2 border-bd hover:bg-hover"}`}>
              <Building2 className="w-3.5 h-3.5" strokeWidth={2} /> {op.key}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="rounded-card border border-bd bg-surface h-64 animate-pulse" />
      ) : operations.length === 0 ? (
        <div className="rounded-card border border-bd bg-surface p-12 text-center text-tx3">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" strokeWidth={1.5} />
          <p className="font-semibold text-tx2">Nenhuma operação encontrada</p>
        </div>
      ) : (
        <>
          {shown.map((op) => <OperationBlock key={op.key} op={op} monthLabel={data?.monthLabel || ""} />)}
          <p className="text-center text-xs text-tx3 mt-2 flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success wolf-live-dot" />
            Vendas reais · Lobo/Rainha = campeão do mês passado · atualiza sozinho · {updated}
          </p>
        </>
      )}
    </div>
  );
}
