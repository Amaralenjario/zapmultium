"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface Seller { rank: number; utm: string; nome: string; avatar: string | null; operacao: string; genero: string; vendas: number; faturamento: number; ticket: number; meta: number; pctMeta: number; }
interface Meta { operacao: string; atual: number; metaExibida: number; n1: number; n2: number; n3: number; pct: number; nivelAtual: number; faltaProxNivel: number; faltaN1: number; faltaN2: number; faltaN3: number; }
interface TVData { now: string; periodo: { tipo: string; inicio: string; fim: string }; stats: { faturamento: number; vendas: number; ticket: number }; lobo: Seller | null; rainha: Seller | null; podium: Seller[]; ranking: Seller[]; metasColetivas: Meta[]; }

const RANGES = [{ k: "hoje", l: "HOJE" }, { k: "ontem", l: "ONTEM" }, { k: "7d", l: "7 DIAS" }, { k: "30d", l: "30 DIAS" }];
const GREEN = "#2ee66f";
const fmt = (n: number) => "R$ " + Math.round(n || 0).toLocaleString("pt-BR");
const fmtK = (n: number) => (n || 0).toLocaleString("pt-BR");
const initials = (s: string) => (s || "?").split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();

// Cores do pódio: 1º ouro, 2º prata, 3º rosé.
const PODIUM = [
  { ring: "#FFC93C", glow: "rgba(255,201,60,0.55)", size: 150 },
  { ring: "#9aa6b2", glow: "rgba(154,166,178,0.35)", size: 118 },
  { ring: "#F19AB6", glow: "rgba(241,154,182,0.4)", size: 118 },
];

function Circle({ s, cfg, crown }: { s: Seller; cfg: typeof PODIUM[number]; crown?: boolean }) {
  return (
    <div className="relative flex-shrink-0" style={{ width: cfg.size, height: cfg.size }}>
      {crown && <div className="absolute left-1/2 -translate-x-1/2 text-4xl" style={{ top: -40 }}>👑</div>}
      <div className="w-full h-full rounded-full flex items-center justify-center overflow-hidden"
        style={{ background: s.avatar ? "#111" : cfg.ring, border: `4px solid ${cfg.ring}`, boxShadow: `0 0 45px 6px ${cfg.glow}` }}>
        {s.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="font-black text-black" style={{ fontSize: cfg.size * 0.34 }}>{initials(s.nome)}</span>
        )}
      </div>
      <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full flex items-center justify-center font-black text-black text-lg"
        style={{ background: cfg.ring, border: "3px solid #0b0f0d" }}>{s.rank}</div>
    </div>
  );
}

function PodiumCol({ s, idx }: { s: Seller; idx: number }) {
  const cfg = PODIUM[idx];
  return (
    <div className="flex flex-col items-center" style={{ marginTop: idx === 0 ? 0 : 60 }}>
      <Circle s={s} cfg={cfg} crown={idx === 0} />
      <p className="mt-4 font-black text-white tracking-tight" style={{ fontSize: idx === 0 ? 30 : 22 }}>{s.nome}</p>
      <p className="text-[11px] font-bold tracking-[0.15em] mt-0.5" style={{ color: "#6b7683" }}>{(s.operacao || "").toUpperCase()}</p>
      <p className="font-black mt-2" style={{ color: GREEN, fontSize: idx === 0 ? 30 : 22 }}>{fmt(s.faturamento)}</p>
      <p className="text-[12px] font-semibold mt-1" style={{ color: "#8b95a3" }}>{s.vendas} vendas · TM {fmt(s.ticket)}</p>
      <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ width: idx === 0 ? 190 : 150, background: "#1b2420" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, s.pctMeta)}%`, background: cfg.ring }} />
      </div>
      <p className="text-[11px] font-bold tracking-wider mt-1.5" style={{ color: cfg.ring }}>{s.pctMeta}% DA META</p>
    </div>
  );
}

function HeroX1({ s, tipo }: { s: Seller; tipo: "lobo" | "rainha" }) {
  const cfg = tipo === "lobo"
    ? { grad: "linear-gradient(135deg, #2b6ef0 0%, #7C3AED 100%)", emoji: "🐺", label: "LOBO DO X1" }
    : { grad: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)", emoji: "👑", label: "RAINHA DO X1" };
  return (
    <div className="flex-1 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden" style={{ background: cfg.grad, boxShadow: "0 0 30px rgba(0,0,0,0.4)" }}>
      <div className="absolute -top-8 -right-6 text-7xl opacity-15 select-none">{cfg.emoji}</div>
      <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style={{ border: "3px solid rgba(255,255,255,0.9)", background: "rgba(0,0,0,0.2)" }}>
        {s.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.avatar} alt="" className="w-full h-full object-cover" />
        ) : <span className="text-white font-black text-lg">{initials(s.nome)}</span>}
      </div>
      <div className="min-w-0 flex-1 relative">
        <div className="flex items-center gap-1.5 mb-0.5"><span className="text-lg">{cfg.emoji}</span><span className="text-[10px] font-black tracking-[0.15em] text-white/90">{cfg.label}</span></div>
        <p className="font-black text-white text-[19px] truncate leading-tight">{s.nome}</p>
        <p className="text-[11px] font-bold text-white/75">{(s.operacao || "").toUpperCase()} · {fmt(s.faturamento)} · {s.vendas}V</p>
      </div>
    </div>
  );
}

function MetaCard({ m }: { m: Meta }) {
  const niveis = [{ n: "N1", v: m.n1, f: m.faltaN1 }, { n: "N2", v: m.n2, f: m.faltaN2 }, { n: "N3", v: m.n3, f: m.faltaN3 }];
  return (
    <div className="rounded-xl p-3.5" style={{ background: "#10171400", border: "1px solid #1c2622" }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black tracking-[0.12em]" style={{ color: "#7a8791" }}>{m.operacao.toUpperCase()} · MENSAL</span>
        <span className="text-[12px] font-black" style={{ color: GREEN }}>{m.pct}%</span>
      </div>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span className="text-[20px] font-black text-white">{fmt(m.atual)}</span>
        <span className="text-[11px] font-semibold" style={{ color: "#5b6670" }}>/ {fmt(m.metaExibida)}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: "#1b2420" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, m.pct)}%`, background: `linear-gradient(90deg, ${GREEN}, #3aa0ff)` }} />
      </div>
      <div className="mt-3 space-y-1.5">
        {niveis.map((nv, i) => (
          <div key={nv.n} className="flex items-center justify-between rounded-lg px-2.5 py-1.5"
            style={{ background: m.nivelAtual === i ? "rgba(46,230,111,0.08)" : "#0e1512", border: m.nivelAtual === i ? "1px solid rgba(46,230,111,0.3)" : "1px solid #171f1b" }}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black" style={{ color: m.atual >= nv.v ? GREEN : "#9aa6b2" }}>{nv.n}</span>
              <span className="text-[11px] font-bold text-white">{fmt(nv.v)}</span>
            </div>
            <span className="text-[10px] font-black tracking-wider" style={{ color: m.atual >= nv.v ? GREEN : "#556069" }}>
              {m.atual >= nv.v ? "BATIDO" : `FALTA ${nv.f}%`}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2.5">
        <span className="text-[10px] font-black" style={{ color: GREEN }}>NÍVEL ATUAL: {m.nivelAtual}</span>
        {m.nivelAtual < 3 && <span className="text-[10px] font-semibold" style={{ color: "#7a8791" }}>Faltam <b className="text-white">{fmt(m.faltaProxNivel)}</b> p/ N{m.nivelAtual + 1}</span>}
      </div>
    </div>
  );
}

export default function RankingTVPage() {
  const [range, setRange] = useState("hoje");
  const [data, setData] = useState<TVData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [clock, setClock] = useState("");
  const [dateStr, setDateStr] = useState("");
  const firstLoad = useRef(true);

  const load = useCallback(async (r: string) => {
    try {
      // Encaminha a chave de API da URL da TV (?api_key=) pro endpoint, se houver.
      const key = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("api_key") : null;
      const res = await fetch(`/api/ranking-tv?period=${r}${key ? `&api_key=${encodeURIComponent(key)}` : ""}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || "Erro"); return; }
      setErr(null); setData(d); firstLoad.current = false;
    } catch { /* mantém */ }
  }, []);

  useEffect(() => { load(range); }, [range, load]);
  useEffect(() => { const id = setInterval(() => load(range), 15000); return () => clearInterval(id); }, [range, load]);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }));
      setDateStr(now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" }).toUpperCase());
    };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);

  const podium = data?.podium || [];
  const order = [podium[1], podium[0], podium[2]].filter(Boolean); // 2º, 1º, 3º
  const orderIdx = [1, 0, 2];

  return (
    <div className="fixed inset-0 overflow-hidden font-sans" style={{ background: "radial-gradient(120% 90% at 50% 30%, #0f1a14 0%, #080b09 55%, #060807 100%)", color: "#e6ecea" }}>
      <div className="h-full grid" style={{ gridTemplateColumns: "300px 1fr" }}>

        {/* ── ESQUERDA: metas coletivas ── */}
        <aside className="h-full overflow-y-auto p-4 border-r" style={{ borderColor: "#131b17" }}>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(46,230,111,0.12)" }}>🎯</div>
            <div><p className="font-black text-white text-[15px] leading-none">METAS COLETIVAS</p><p className="text-[10px] font-bold tracking-widest mt-1" style={{ color: "#6b7683" }}>MÊS ATUAL</p></div>
          </div>
          <div className="space-y-3">
            {(data?.metasColetivas || []).map((m) => <MetaCard key={m.operacao} m={m} />)}
          </div>
        </aside>

        {/* ── CENTRO: ranking ── */}
        <main className="h-full overflow-y-auto px-8 py-5 flex flex-col">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: "rgba(255,201,60,0.14)" }}>🏆</div>
              <div>
                <h1 className="font-black italic text-white tracking-tight" style={{ fontSize: 26 }}>RANKING DE OPERAÇÃO</h1>
                <p className="text-[11px] font-bold tracking-[0.2em]" style={{ color: "#6b7683" }}>MULTIUM MONITORING SYSTEM</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-black text-white tabular-nums tracking-widest" style={{ fontSize: 26 }}>{clock}</p>
              <p className="text-[10px] font-bold tracking-widest" style={{ color: "#6b7683" }}>{dateStr}</p>
            </div>
          </div>

          {/* tabs + stats */}
          <div className="flex items-center justify-between mt-5">
            <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "#0d1310", border: "1px solid #172019" }}>
              {RANGES.map((r) => (
                <button key={r.k} onClick={() => setRange(r.k)}
                  className="px-3.5 py-1.5 rounded-lg text-[11px] font-black tracking-wider transition"
                  style={range === r.k ? { background: "#FFC93C", color: "#000" } : { color: "#7a8791" }}>{r.l}</button>
              ))}
            </div>
            <div className="flex items-center gap-6 rounded-xl px-5 py-2.5" style={{ background: "#0d1310", border: "1px solid #172019" }}>
              {[["FATURAMENTO", fmt(data?.stats.faturamento || 0)], ["VENDAS", fmtK(data?.stats.vendas || 0)], ["TICKET", fmt(data?.stats.ticket || 0)]].map(([l, v]) => (
                <div key={l} className="text-center"><p className="text-[9px] font-black tracking-widest" style={{ color: "#5b6670" }}>{l}</p><p className="font-black" style={{ color: GREEN, fontSize: 17 }}>{v}</p></div>
              ))}
            </div>
          </div>

          {err ? (
            <div className="flex-1 flex items-center justify-center text-center">
              <div><p className="text-2xl font-black text-white mb-2">Sessão necessária</p><p style={{ color: "#7a8791" }}>{err}</p><a href="/login" className="inline-block mt-4 px-5 py-2 rounded-lg font-bold text-black" style={{ background: GREEN }}>Entrar</a></div>
            </div>
          ) : (
            <>
              {/* Lobo / Rainha do X1 — competição entre todos */}
              {(data?.lobo || data?.rainha) && (
                <div className="flex gap-4 mt-5">
                  {data?.lobo && <HeroX1 s={data.lobo} tipo="lobo" />}
                  {data?.rainha && <HeroX1 s={data.rainha} tipo="rainha" />}
                </div>
              )}

              {/* pódio */}
              <div className="flex-1 flex items-start justify-center gap-10 mt-8">
                {order.map((s, i) => s && <PodiumCol key={s.utm} s={s} idx={orderIdx[i]} />)}
              </div>

              {/* ranking 4+ */}
              <div className="space-y-2 mt-4 pb-2">
                {(data?.ranking || []).filter((r) => r.faturamento > 0).slice(0, 12).map((s) => (
                  <div key={s.utm} className="flex items-center gap-3 rounded-xl px-4 py-2.5" style={{ background: "#0d1310", border: "1px solid #151d18" }}>
                    <span className="w-6 text-center font-black" style={{ color: "#5b6670" }}>{s.rank}</span>
                    <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: "#1a2420" }}>
                      {s.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.avatar} alt="" className="w-full h-full object-cover" />
                      ) : <span className="text-[11px] font-black" style={{ color: GREEN }}>{initials(s.nome)}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-[14px] truncate">{s.nome}</p>
                      <p className="text-[10px] font-semibold tracking-wider" style={{ color: "#5b6670" }}>{(s.operacao || "").toUpperCase()} · {s.vendas}V</p>
                    </div>
                    <span className="font-black" style={{ color: GREEN, fontSize: 16 }}>{fmt(s.faturamento)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="text-center text-[10px] font-bold tracking-[0.2em] mt-auto pt-3" style={{ color: "#3b4640" }}>
            MULTIUM OS V2.0 — RANKING ENGINE · <span style={{ color: GREEN }}>● SINCRONIZADO</span>
          </p>
        </main>
      </div>
    </div>
  );
}
