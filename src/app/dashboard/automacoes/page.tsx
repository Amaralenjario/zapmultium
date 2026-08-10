"use client";

import { useEffect, useMemo, useState } from "react";
import { Zap, Sun, UtensilsCrossed, Clock, Check, Info } from "lucide-react";
import toast from "react-hot-toast";

interface Flow { id: string; name: string; trigger_type: string; trigger_value?: string | null; }
type Channel = { phoneId: string; label: string };

const WEEKDAYS = [
  { n: 0, label: "Dom" }, { n: 1, label: "Seg" }, { n: 2, label: "Ter" }, { n: 3, label: "Qua" },
  { n: 4, label: "Qui" }, { n: 5, label: "Sex" }, { n: 6, label: "Sáb" },
];
const DIAS_LONGO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function daysLabel(days: number[]): string {
  const s = [...days].sort((a, b) => a - b);
  if (s.length === 7) return "todos os dias";
  if (s.length === 5 && s.every((d) => d >= 1 && d <= 5)) return "de segunda a sexta";
  if (s.length === 1) return DIAS_LONGO[s[0]];
  return s.map((d) => WEEKDAYS[d].label).join(", ");
}

function ChannelPicker({ channels, all, setAll, picked, setPicked }: { channels: Channel[]; all: boolean; setAll: (v: boolean) => void; picked: Set<string>; setPicked: (s: Set<string>) => void }) {
  return (
    <div>
      <label className="flex items-center gap-2 cursor-pointer select-none mb-1.5">
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="accent-[color:var(--accent)] w-4 h-4" />
        <span className="text-xs font-bold text-tx2">Todos os canais</span>
      </label>
      {!all && (
        <div className="max-h-32 overflow-y-auto space-y-1 rounded-lg border border-bd p-2">
          {channels.length === 0 && <p className="text-xs text-tx3 py-1">Nenhum canal encontrado</p>}
          {channels.map((c) => {
            const on = picked.has(c.phoneId);
            return (
              <label key={c.phoneId} className="flex items-center gap-2 cursor-pointer select-none px-1 py-1 rounded hover:bg-hover">
                <input type="checkbox" checked={on} onChange={() => { const s = new Set(picked); on ? s.delete(c.phoneId) : s.add(c.phoneId); setPicked(s); }} className="accent-[color:var(--accent)] w-4 h-4" />
                <span className="text-xs font-semibold text-tx truncate">{c.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Interruptor estilo iOS.
function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-7 w-[52px] flex-shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${on ? "bg-accent" : "bg-tx3/35"}`}
    >
      <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-200 ${on ? "translate-x-[23px]" : "translate-x-0.5"}`} />
    </button>
  );
}

function minutesOf(hhmm: string): number { const [h, m] = (hhmm || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); }

// Valida a faixa de almoço (máx 2h). Devolve mensagem de erro ou null.
function lunchProblem(start: string, end: string): string | null {
  if (!start || !end) return "Defina o horário do almoço.";
  const s = minutesOf(start), e = minutesOf(end);
  if (e <= s) return "O fim do almoço tem que ser depois do início.";
  if (e - s > 120) return "Tá almoçando ou tá de férias? 🤨 O almoço pode ser no máximo 2h.";
  return null;
}

function CondPicker({ value, onChange }: { value: string; onChange: (v: "first_message" | "any") => void }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-start gap-2 cursor-pointer select-none">
        <input type="radio" checked={value === "first_message"} onChange={() => onChange("first_message")} className="accent-[color:var(--accent)] w-4 h-4 mt-0.5" />
        <span className="text-[13px] text-tx"><b>Só quando o lead chega pela 1ª vez</b> <span className="text-tx3">(boas-vindas — não dispara pra quem já está em atendimento)</span></span>
      </label>
      <label className="flex items-start gap-2 cursor-pointer select-none">
        <input type="radio" checked={value === "any"} onChange={() => onChange("any")} className="accent-[color:var(--accent)] w-4 h-4 mt-0.5" />
        <span className="text-[13px] text-tx">Toda mensagem de cliente no período</span>
      </label>
    </div>
  );
}

export default function AutomacoesPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Domingo
  const [sunOn, setSunOn] = useState(false);
  const [sunFlow, setSunFlow] = useState("");
  const [sunCond, setSunCond] = useState<"first_message" | "any">("first_message");
  const [sunAllCh, setSunAllCh] = useState(true);
  const [sunCh, setSunCh] = useState<Set<string>>(new Set());
  const [sunSaving, setSunSaving] = useState(false);

  // Almoço
  const [luOn, setLuOn] = useState(false);
  const [luFlow, setLuFlow] = useState("");
  const [luDays, setLuDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [luStart, setLuStart] = useState("12:00");
  const [luEnd, setLuEnd] = useState("13:00");
  const [luCond, setLuCond] = useState<"first_message" | "any">("any");
  const [luAllCh, setLuAllCh] = useState(true);
  const [luCh, setLuCh] = useState<Set<string>>(new Set());
  const [luSaving, setLuSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/flows").then((r) => r.json()).catch(() => []),
      fetch("/api/evohub/channels").then((r) => r.json()).catch(() => ({})),
    ]).then(([fl, chData]) => {
      const list: Flow[] = Array.isArray(fl) ? fl : [];
      setFlows(list);
      const map = chData?.phoneMap || {};
      const chs: Channel[] = [];
      for (const ch of chData?.channels || []) {
        const m = map[ch.id];
        if (m?.phoneId) chs.push({ phoneId: m.phoneId, label: `${ch.name}${m.opName ? ` · ${m.opName}` : ""}` });
      }
      setChannels(chs);

      // Pré-preenche a partir dos fluxos já agendados.
      for (const f of list) {
        if (f.trigger_type !== "schedule" || !f.trigger_value) continue;
        let c: any = {};
        try { c = JSON.parse(f.trigger_value); } catch { continue; }
        const days: number[] = Array.isArray(c.days) ? c.days.map(Number) : [];
        const chans: string[] = Array.isArray(c.channels) ? c.channels.map(String) : [];
        if (c.timeStart && c.timeEnd) {
          // Fluxo do almoço (tem janela de horário)
          setLuOn(true); setLuFlow(f.id);
          setLuDays(new Set(days.length ? days : [1, 2, 3, 4, 5]));
          setLuStart(c.timeStart); setLuEnd(c.timeEnd);
          setLuCond(c.condition === "first_message" ? "first_message" : "any");
          setLuAllCh(chans.length === 0); setLuCh(new Set(chans));
        } else if (days.includes(0)) {
          // Fluxo de domingo
          setSunOn(true); setSunFlow(f.id);
          setSunCond(c.condition === "first_message" ? "first_message" : "any");
          setSunAllCh(chans.length === 0); setSunCh(new Set(chans));
        }
      }
      setLoaded(true);
    });
  }, []);

  const saveSchedule = async (flowId: string, cfg: any | null) => {
    const body = cfg
      ? { trigger_type: "schedule", trigger_value: JSON.stringify(cfg) }
      : { trigger_type: "manual", trigger_value: null };
    const res = await fetch(`/api/flows/${flowId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) setFlows((prev) => prev.map((f) => f.id === flowId ? { ...f, ...body } as Flow : f));
    return res.ok;
  };

  const saveSunday = async () => {
    if (sunOn && !sunFlow) { toast.error("Escolha um fluxo pro domingo"); return; }
    if (sunOn && !sunAllCh && sunCh.size === 0) { toast.error("Escolha um canal ou marque Todos"); return; }
    setSunSaving(true);
    const ok = await saveSchedule(sunFlow, sunOn ? { days: [0], timeStart: null, timeEnd: null, channels: sunAllCh ? null : Array.from(sunCh), condition: sunCond } : null);
    setSunSaving(false);
    toast[ok ? "success" : "error"](ok ? (sunOn ? "Automação de domingo salva!" : "Automação de domingo desligada") : "Erro ao salvar");
  };

  const saveLunch = async () => {
    if (luOn && !luFlow) { toast.error("Escolha um fluxo pro almoço"); return; }
    if (luOn && luDays.size === 0) { toast.error("Escolha ao menos um dia"); return; }
    const prob = luOn ? lunchProblem(luStart, luEnd) : null;
    if (prob) { toast.error(prob); return; }
    if (luOn && !luAllCh && luCh.size === 0) { toast.error("Escolha um canal ou marque Todos"); return; }
    setLuSaving(true);
    const ok = await saveSchedule(luFlow, luOn ? { days: Array.from(luDays).sort(), timeStart: luStart, timeEnd: luEnd, channels: luAllCh ? null : Array.from(luCh), condition: luCond } : null);
    setLuSaving(false);
    toast[ok ? "success" : "error"](ok ? (luOn ? "Automação do almoço salva!" : "Automação do almoço desligada") : "Erro ao salvar");
  };

  const condLabel = (c: string) => c === "first_message" ? "só para leads novos (boas-vindas)" : "em toda mensagem de cliente";

  // Resumo "quando vão funcionar"
  const resumo = useMemo(() => {
    const linhas: string[] = [];
    if (sunOn && sunFlow) linhas.push(`🟢 Domingo: o fluxo dispara aos domingos, o dia todo — ${condLabel(sunCond)}.`);
    if (luOn && luFlow) linhas.push(`🍽️ Almoço: dispara ${daysLabel(Array.from(luDays))}, das ${luStart} às ${luEnd} — ${condLabel(luCond)}.`);
    return linhas;
  }, [sunOn, sunFlow, sunCond, luOn, luFlow, luDays, luStart, luEnd, luCond]);

  const noFlows = loaded && flows.length === 0;
  const luProblem = luOn ? lunchProblem(luStart, luEnd) : null;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-1">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center bg-accentsoft"><Zap className="w-5 h-5 text-accent" strokeWidth={2.2} /></span>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-tx">Automações</h1>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-white bg-gradient-to-r from-accent to-violet-500 rounded-full px-2 py-0.5">Beta</span>
          </div>
          <p className="text-tx2 text-sm mt-0.5">Deixe um fluxo atender sozinho em dias e horários específicos</p>
        </div>
      </div>

      {/* Resumo: quando vão funcionar */}
      <div className="mt-5 rounded-card border border-bd bg-surface p-4">
        <p className="text-xs font-bold text-tx2 flex items-center gap-1.5 mb-2"><Info className="w-3.5 h-3.5 text-accent" strokeWidth={2.2} /> Quando as automações vão funcionar</p>
        {resumo.length === 0 ? (
          <p className="text-[13px] text-tx3">Nenhuma automação ativa ainda. Configure abaixo. 👇</p>
        ) : (
          <ul className="space-y-1">{resumo.map((l, i) => <li key={i} className="text-[13px] text-tx">{l}</li>)}</ul>
        )}
      </div>

      {noFlows && (
        <div className="mt-4 rounded-card border border-amber-300/50 dark:border-amber-800/50 bg-amber-500/5 p-4 text-[13px] text-amber-700 dark:text-amber-400">
          Você ainda não tem fluxos. Crie um fluxo na aba <b>Fluxos</b> primeiro, depois volte aqui pra automatizar.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5 items-start">
      {/* ── Card: Domingo ── */}
      <div className="rounded-card border border-bd bg-surface p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-control flex items-center justify-center" style={{ background: "rgba(245,158,11,0.14)" }}><Sun className="w-[1.15rem] h-[1.15rem] text-amber-500" strokeWidth={2} /></span>
            <div>
              <h2 className="font-bold text-tx text-[15px] leading-none">Fluxo de domingo</h2>
              <p className="text-[11px] text-tx3 mt-1">Atende sozinho aos domingos</p>
            </div>
          </div>
          <Toggle on={sunOn} onChange={setSunOn} disabled={noFlows} />
        </div>
        <div className={sunOn ? "space-y-3.5" : "space-y-3.5 opacity-40 pointer-events-none"}>
          <div>
            <label className="block text-xs font-bold text-tx2 mb-1.5">Fluxo</label>
            <select value={sunFlow} onChange={(e) => setSunFlow(e.target.value)} className="w-full rounded-control border border-bd bg-surface2 px-3 py-2 text-sm text-tx focus:border-accent focus:outline-none">
              <option value="">Selecione um fluxo…</option>
              {flows.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div><p className="text-xs font-bold text-tx2 mb-1.5">Condição</p><CondPicker value={sunCond} onChange={setSunCond} /></div>
          <ChannelPicker channels={channels} all={sunAllCh} setAll={setSunAllCh} picked={sunCh} setPicked={setSunCh} />
        </div>
        <button onClick={saveSunday} disabled={sunSaving || noFlows} className="mt-4 w-full rounded-control bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-accent2 disabled:opacity-50 transition flex items-center justify-center gap-1.5">
          {sunSaving ? "Salvando…" : <><Check className="w-4 h-4" strokeWidth={2.5} /> Salvar automação de domingo</>}
        </button>
      </div>

      {/* ── Card: Almoço ── */}
      <div className="rounded-card border border-bd bg-surface p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-control flex items-center justify-center" style={{ background: "rgba(46,230,111,0.14)" }}><UtensilsCrossed className="w-[1.15rem] h-[1.15rem] text-emerald-500" strokeWidth={2} /></span>
            <div>
              <h2 className="font-bold text-tx text-[15px] leading-none">Fluxo do almoço</h2>
              <p className="text-[11px] text-tx3 mt-1">Atende sozinho no horário de almoço</p>
            </div>
          </div>
          <Toggle on={luOn} onChange={setLuOn} disabled={noFlows} />
        </div>
        <div className={luOn ? "space-y-3.5" : "space-y-3.5 opacity-40 pointer-events-none"}>
          <div>
            <label className="block text-xs font-bold text-tx2 mb-1.5">Fluxo</label>
            <select value={luFlow} onChange={(e) => setLuFlow(e.target.value)} className="w-full rounded-control border border-bd bg-surface2 px-3 py-2 text-sm text-tx focus:border-accent focus:outline-none">
              <option value="">Selecione um fluxo…</option>
              {flows.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs font-bold text-tx2 mb-1.5 flex items-center gap-1"><Clock className="w-3.5 h-3.5" strokeWidth={2} /> Horário do almoço</p>
            <div className="flex items-center gap-2">
              <input type="time" value={luStart} onChange={(e) => setLuStart(e.target.value)} className={`rounded-control border bg-surface2 px-2 py-1.5 text-sm text-tx focus:outline-none ${luProblem ? "border-red-400 focus:border-red-400" : "border-bd focus:border-accent"}`} />
              <span className="text-tx3 text-sm">até</span>
              <input type="time" value={luEnd} onChange={(e) => setLuEnd(e.target.value)} className={`rounded-control border bg-surface2 px-2 py-1.5 text-sm text-tx focus:outline-none ${luProblem ? "border-red-400 focus:border-red-400" : "border-bd focus:border-accent"}`} />
              <span className="text-[11px] text-tx3 font-semibold hidden sm:inline">(máx 2h)</span>
            </div>
            {luProblem && <p className="text-[12px] font-semibold text-red-500 mt-1.5">{luProblem}</p>}
          </div>
          <div>
            <p className="text-xs font-bold text-tx2 mb-1.5">Dias</p>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => (
                <button key={d.n} onClick={() => { const s = new Set(luDays); s.has(d.n) ? s.delete(d.n) : s.add(d.n); setLuDays(s); }} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${luDays.has(d.n) ? "bg-accent text-white shadow-glow" : "bg-surface2 text-tx2 hover:bg-hover"}`}>{d.label}</button>
              ))}
            </div>
          </div>
          <div><p className="text-xs font-bold text-tx2 mb-1.5">Condição</p><CondPicker value={luCond} onChange={setLuCond} /></div>
          <ChannelPicker channels={channels} all={luAllCh} setAll={setLuAllCh} picked={luCh} setPicked={setLuCh} />
        </div>
        <button onClick={saveLunch} disabled={luSaving || noFlows || !!luProblem} className="mt-4 w-full rounded-control bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-accent2 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5">
          {luSaving ? "Salvando…" : <><Check className="w-4 h-4" strokeWidth={2.5} /> Salvar automação do almoço</>}
        </button>
      </div>
      </div>
    </div>
  );
}
