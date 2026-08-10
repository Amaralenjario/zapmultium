"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface Seller { rank: number; utm: string; nome: string; avatar: string | null; operacao: string; genero: string; vendas: number; faturamento: number; ticket: number; meta: number; pctMeta: number; }
interface Meta { operacao: string; atual: number; metaExibida: number; n1: number; n2: number; n3: number; pct: number; nivelAtual: number; faltaProxNivel: number; faltaN1: number; faltaN2: number; faltaN3: number; }
interface Venda { id: number; valor: number; produto: string; vendedor: string; operacao: string; avatar: string | null; genero: string; }
interface TVData { now: string; periodo: { tipo: string; inicio: string; fim: string }; stats: { faturamento: number; vendas: number; ticket: number }; lobo: Seller | null; rainha: Seller | null; ultimaVenda: Venda | null; podium: Seller[]; ranking: Seller[]; metasColetivas: Meta[]; }

const RANGES = [{ k: "hoje", l: "HOJE" }, { k: "ontem", l: "ONTEM" }, { k: "7d", l: "7 DIAS" }, { k: "30d", l: "30 DIAS" }];
const GREEN = "#2ee66f";
const fmt = (n: number) => "R$ " + Math.round(n || 0).toLocaleString("pt-BR");
const fmtK = (n: number) => (n || 0).toLocaleString("pt-BR");
const initials = (s: string) => (s || "?").split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();

// Cores do pódio: 1º ouro, 2º prata, 3º rosé.
const PODIUM = [
  { ring: "#FFC93C", glow: "rgba(255,201,60,0.55)", size: 208 },
  { ring: "#9aa6b2", glow: "rgba(154,166,178,0.35)", size: 164 },
  { ring: "#F19AB6", glow: "rgba(241,154,182,0.4)", size: 164 },
];

function Circle({ s, cfg, crown }: { s: Seller; cfg: typeof PODIUM[number]; crown?: boolean }) {
  return (
    <div className="relative flex-shrink-0" style={{ width: cfg.size, height: cfg.size }}>
      {/* 1º lugar: anel dourado girando + brilhinhos */}
      {crown && (
        <>
          <div className="absolute rounded-full tv-spin pointer-events-none" style={{ inset: -12, background: "conic-gradient(from 0deg, #FFC93C, rgba(255,201,60,0) 35%, #FFE08A 55%, rgba(255,201,60,0) 75%, #FFC93C)", WebkitMaskImage: "radial-gradient(closest-side, transparent 79%, black 81%)", maskImage: "radial-gradient(closest-side, transparent 79%, black 81%)" }} />
          <div className="absolute text-2xl tv-sparkle pointer-events-none" style={{ top: 2, right: -14 }}>✨</div>
          <div className="absolute text-xl tv-sparkle pointer-events-none" style={{ bottom: 6, left: -16, animationDelay: "0.5s" }}>✨</div>
        </>
      )}
      {crown && <div className="absolute left-1/2 tv-crown text-7xl z-10" style={{ top: -62 }}>👑</div>}
      <div className={`w-full h-full rounded-full flex items-center justify-center overflow-hidden ${crown ? "tv-premium-glow" : ""}`}
        style={{ background: s.avatar ? "#111" : cfg.ring, border: `5px solid ${cfg.ring}`, boxShadow: crown ? undefined : `0 0 55px 7px ${cfg.glow}` }}>
        {s.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="font-black text-black" style={{ fontSize: cfg.size * 0.34 }}>{initials(s.nome)}</span>
        )}
      </div>
      <div className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center font-black text-black z-10"
        style={{ width: cfg.size * 0.2, height: cfg.size * 0.2, fontSize: cfg.size * 0.11, background: cfg.ring, border: "3px solid #0b0f0d" }}>{s.rank}</div>
    </div>
  );
}

function PodiumCol({ s, idx }: { s: Seller; idx: number }) {
  const cfg = PODIUM[idx];
  const first = idx === 0;
  return (
    <div className="flex flex-col items-center" style={{ marginTop: first ? 0 : 84 }}>
      <Circle s={s} cfg={cfg} crown={first} />
      <p className="mt-5 font-black text-white tracking-tight text-center" style={{ fontSize: first ? 46 : 34, lineHeight: 1.05 }}>{s.nome}</p>
      <p className="font-bold tracking-[0.15em] mt-1" style={{ color: "#8b95a3", fontSize: first ? 15 : 13 }}>{(s.operacao || "").toUpperCase()}</p>
      <p className="font-black mt-2.5" style={{ color: GREEN, fontSize: first ? 44 : 32 }}>{fmt(s.faturamento)}</p>
      <p className="font-semibold mt-1.5" style={{ color: "#9aa6b2", fontSize: first ? 16 : 14 }}>{s.vendas} vendas · TM {fmt(s.ticket)}</p>
      <div className="mt-3.5 rounded-full overflow-hidden" style={{ width: first ? 250 : 200, height: 8, background: "#1b2420" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, s.pctMeta)}%`, background: cfg.ring }} />
      </div>
      <p className="font-bold tracking-wider mt-2" style={{ color: cfg.ring, fontSize: first ? 15 : 13 }}>{s.pctMeta}% DA META</p>
    </div>
  );
}

function HeroX1({ s, tipo }: { s: Seller; tipo: "lobo" | "rainha" }) {
  const accent = tipo === "lobo" ? "#6b9bf0" : "#e28bb4"; // azul-aço / rosé, discreto
  const label = tipo === "lobo" ? "LOBO DO X1" : "RAINHA DO X1";
  return (
    <div className="rounded-xl p-3.5 flex items-center gap-3.5" style={{ background: "#0d1310", border: "1px solid #1c2622" }}>
      <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style={{ border: `2px solid ${accent}`, background: "#1a2420" }}>
        {s.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.avatar} alt="" className="w-full h-full object-cover" />
        ) : <span className="font-black text-[16px]" style={{ color: accent }}>{initials(s.nome)}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-black tracking-[0.18em]" style={{ color: accent, fontSize: 10 }}>{label}</p>
        <p className="font-black text-white text-[17px] truncate leading-tight mt-0.5">{s.nome}</p>
        <p className="font-semibold mt-0.5" style={{ color: "#8b95a3", fontSize: 11 }}>{(s.operacao || "").toUpperCase()} · {fmt(s.faturamento)}</p>
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
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState<TVData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [clock, setClock] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [soundOn, setSoundOn] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [flash, setFlash] = useState(false);
  const [sale, setSale] = useState<Venda | null>(null);
  const firstLoad = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevSaleIdRef = useRef<number | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Toca o som de venda (se o áudio já foi liberado) e faz o painel piscar com os dados da venda.
  const playSale = useCallback((v?: Venda | null) => {
    if (v !== undefined) setSale(v ?? null);
    try {
      const a = audioRef.current;
      if (a) {
        a.volume = 1; a.muted = false; a.currentTime = 0;
        // play() resolve = tocou; rejeita = navegador bloqueou (falta gesto do usuário).
        a.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
      }
    } catch { /* ignore */ }
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 5000);
  }, []);

  const load = useCallback(async () => {
    try {
      const isCustom = range === "custom" && !!customStart && !!customEnd;
      if (range === "custom" && !isCustom) return; // aguarda escolher as duas datas
      const qp = isCustom ? `period=custom&start=${customStart}&end=${customEnd}` : `period=${range}`;
      // Encaminha a chave de API da URL da TV (?api_key=) pro endpoint, se houver.
      const key = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("api_key") : null;
      const res = await fetch(`/api/ranking-tv?${qp}${key ? `&api_key=${encodeURIComponent(key)}` : ""}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || "Erro"); return; }
      // Nova venda? (id da última venda mudou pra um maior desde o último poll do mesmo período)
      const id = d?.ultimaVenda ? Number(d.ultimaVenda.id) : null;
      if (prevSaleIdRef.current !== null && id !== null && id > prevSaleIdRef.current) playSale(d.ultimaVenda);
      prevSaleIdRef.current = id;
      setErr(null); setData(d); firstLoad.current = false;
    } catch { /* mantém */ }
  }, [range, customStart, customEnd, playSale]);

  // Ao trocar de período/datas, reseta o contador pra não disparar "venda" falsa.
  useEffect(() => { prevSaleIdRef.current = null; load(); }, [load]);
  useEffect(() => { const id = setInterval(() => load(), 15000); return () => clearInterval(id); }, [load]);
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

          {/* Lobo / Rainha do X1 (campeões do mês passado) */}
          {(data?.lobo || data?.rainha) && (
            <div className="mt-4 space-y-3">
              {data?.lobo && <HeroX1 s={data.lobo} tipo="lobo" />}
              {data?.rainha && <HeroX1 s={data.rainha} tipo="rainha" />}
            </div>
          )}
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
            <div className="flex items-center gap-1.5 p-1 rounded-xl flex-wrap" style={{ background: "#0d1310", border: "1px solid #172019" }}>
              {RANGES.map((r) => (
                <button key={r.k} onClick={() => { setCustomStart(""); setCustomEnd(""); setRange(r.k); }}
                  className="px-3.5 py-1.5 rounded-lg text-[11px] font-black tracking-wider transition"
                  style={range === r.k ? { background: "#FFC93C", color: "#000" } : { color: "#7a8791" }}>{r.l}</button>
              ))}
              <span className="w-px h-5 mx-0.5" style={{ background: "#233029" }} />
              <div className="flex items-center gap-1">
                <input type="date" value={customStart} max={customEnd || undefined}
                  onChange={(e) => { const v = e.target.value; setCustomStart(v); if (v && customEnd) setRange("custom"); }}
                  className="rounded-lg text-[11px] font-bold px-2 py-1 outline-none"
                  style={{ background: range === "custom" ? "#FFC93C" : "#141c17", color: range === "custom" ? "#000" : "#c8d2cc", colorScheme: range === "custom" ? "light" : "dark", border: "1px solid #233029" }} />
                <span className="text-[11px] font-bold" style={{ color: "#5b6670" }}>–</span>
                <input type="date" value={customEnd} min={customStart || undefined}
                  onChange={(e) => { const v = e.target.value; setCustomEnd(v); if (customStart && v) setRange("custom"); }}
                  className="rounded-lg text-[11px] font-bold px-2 py-1 outline-none"
                  style={{ background: range === "custom" ? "#FFC93C" : "#141c17", color: range === "custom" ? "#000" : "#c8d2cc", colorScheme: range === "custom" ? "light" : "dark", border: "1px solid #233029" }} />
              </div>
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
              {/* pódio */}
              <div className="flex-1 flex items-start justify-center gap-16 mt-12">
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

      {/* som de venda */}
      <audio ref={audioRef} src="/sounds/venda.mp3" preload="auto" />

      {/* flash de nova venda: borda verde + card central com valor, vendedor e operação */}
      {flash && (
        <>
          <div className="fixed inset-0 pointer-events-none z-40 tv-edge-flash" style={{ boxShadow: `inset 0 0 120px 20px ${GREEN}`, border: `4px solid ${GREEN}` }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="tv-sale-pop rounded-3xl px-14 py-10 text-center" style={{ background: "rgba(6,20,12,0.95)", border: `3px solid ${GREEN}`, boxShadow: `0 0 80px 12px rgba(46,230,111,0.55)` }}>
              <div className="flex items-center justify-center gap-3">
                <span className="text-5xl tv-sale-blink">💰</span>
                <p className="font-black tracking-[0.25em]" style={{ color: GREEN, fontSize: 22 }}>NOVA VENDA!</p>
                <span className="text-5xl tv-sale-blink">💰</span>
              </div>
              <p className="font-black text-white my-4 tabular-nums" style={{ fontSize: 76, letterSpacing: "-0.03em", lineHeight: 1 }}>{fmt(sale?.valor || 0)}</p>
              <div className="flex items-center justify-center gap-3">
                <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style={{ border: `3px solid ${GREEN}`, background: "#111" }}>
                  {sale?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sale.avatar} alt="" className="w-full h-full object-cover" />
                  ) : <span className="font-black text-white text-lg">{initials(sale?.vendedor || "?")}</span>}
                </div>
                <div className="text-left">
                  <p className="font-black text-white leading-tight" style={{ fontSize: 30 }}>{sale?.vendedor || "Vendedor"}</p>
                  <p className="font-bold tracking-[0.15em]" style={{ color: GREEN, fontSize: 13 }}>OPERAÇÃO {(sale?.operacao || "—").toUpperCase()}</p>
                </div>
              </div>
              {sale?.produto ? <p className="mt-4 font-semibold text-white/55 text-sm max-w-[420px] mx-auto truncate">{sale.produto}</p> : null}
            </div>
          </div>
        </>
      )}

      {/* botão testar venda / ativar som — replica a última venda real, sem somar em nada */}
      <button
        onClick={() => { setSoundOn(true); playSale(data?.ultimaVenda ?? { id: 0, valor: 297, produto: "Venda de teste", vendedor: "Venda Teste", operacao: "TESTE", avatar: null, genero: "" }); }}
        className="fixed bottom-5 right-6 z-50 flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-black text-sm tracking-wide transition hover:brightness-110"
        style={{ background: GREEN, boxShadow: "0 0 25px rgba(46,230,111,0.5)" }}
        title="Toca o som e libera o áudio da TV (clique 1x pra ativar o som)"
      >
        {soundOn ? (audioBlocked ? "🔇" : "🔊") : "🔈"} Testar venda
      </button>
      {(!soundOn || audioBlocked) && (
        <div className="fixed bottom-5 left-6 z-50 text-[11px] font-bold px-3 py-2 rounded-lg max-w-[320px]" style={{ background: audioBlocked ? "rgba(255,80,80,0.14)" : "rgba(255,201,60,0.12)", color: audioBlocked ? "#ff8a8a" : "#FFC93C", border: `1px solid ${audioBlocked ? "rgba(255,80,80,0.35)" : "rgba(255,201,60,0.3)"}` }}>
          {audioBlocked
            ? "🔇 O navegador bloqueou o som. Clique em “Testar venda” de novo e confira o volume da TV/aba."
            : "🔈 Clique em “Testar venda” uma vez pra ligar o som da TV"}
        </div>
      )}
    </div>
  );
}
