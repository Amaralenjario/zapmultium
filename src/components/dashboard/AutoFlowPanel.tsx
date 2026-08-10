"use client";

import { useEffect, useMemo, useState } from "react";
import { Zap, CalendarClock, Clock, Check } from "lucide-react";
import toast from "react-hot-toast";

interface Flow { id: string; name: string; trigger_type: string; trigger_value?: string | null; }

const WEEKDAYS = [
  { n: 0, label: "Dom" }, { n: 1, label: "Seg" }, { n: 2, label: "Ter" }, { n: 3, label: "Qua" },
  { n: 4, label: "Qui" }, { n: 5, label: "Sex" }, { n: 6, label: "Sáb" },
];

function summarize(tv?: string | null): string | null {
  if (!tv) return null;
  try {
    const c = JSON.parse(tv);
    const days: number[] = Array.isArray(c.days) ? c.days : [];
    const d = days.length === 7 ? "todo dia" : days.length ? days.map((x) => WEEKDAYS[x]?.label).join("/") : "sem dia";
    const h = c.timeStart && c.timeEnd ? ` · ${c.timeStart}–${c.timeEnd}` : "";
    const cond = c.condition === "first_message" ? " · boas-vindas" : "";
    return `${d}${h}${cond}`;
  } catch { return null; }
}

export default function AutoFlowPanel() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [channels, setChannels] = useState<{ phoneId: string; label: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [days, setDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [useTime, setUseTime] = useState(false);
  const [timeStart, setTimeStart] = useState("12:00");
  const [timeEnd, setTimeEnd] = useState("13:00");
  const [allChannels, setAllChannels] = useState(true);
  const [pickedChannels, setPickedChannels] = useState<Set<string>>(new Set());
  const [condition, setCondition] = useState<"first_message" | "any">("any");

  const load = () => fetch("/api/flows").then((r) => r.json()).then((d) => Array.isArray(d) && setFlows(d)).catch(() => {});
  useEffect(() => {
    load();
    fetch("/api/evohub/channels").then((r) => r.json()).then((d) => {
      const map = d.phoneMap || {};
      const list: { phoneId: string; label: string }[] = [];
      for (const ch of d.channels || []) {
        const m = map[ch.id];
        if (m?.phoneId) list.push({ phoneId: m.phoneId, label: `${ch.name}${m.opName ? ` · ${m.opName}` : ""}` });
      }
      setChannels(list);
    }).catch(() => {});
  }, []);

  const selected = flows.find((f) => f.id === selectedId) || null;
  const scheduled = useMemo(() => flows.filter((f) => f.trigger_type === "schedule"), [flows]);

  // Carrega a config do fluxo selecionado no formulário.
  useEffect(() => {
    if (!selected) return;
    let c: any = {};
    try { c = selected.trigger_value ? JSON.parse(selected.trigger_value) : {}; } catch { /* ignore */ }
    setEnabled(selected.trigger_type === "schedule");
    setDays(new Set(Array.isArray(c.days) && c.days.length ? c.days.map(Number) : [1, 2, 3, 4, 5]));
    const hasTime = !!(c.timeStart && c.timeEnd);
    setUseTime(hasTime);
    setTimeStart(c.timeStart || "12:00");
    setTimeEnd(c.timeEnd || "13:00");
    const chans: string[] = Array.isArray(c.channels) ? c.channels.map(String) : [];
    setAllChannels(chans.length === 0);
    setPickedChannels(new Set(chans));
    setCondition(c.condition === "first_message" ? "first_message" : "any");
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!selected) return;
    if (enabled && days.size === 0) { toast.error("Escolha ao menos um dia"); return; }
    if (enabled && !allChannels && pickedChannels.size === 0) { toast.error("Escolha um canal ou marque Todos"); return; }
    if (enabled && useTime && timeStart >= timeEnd && !(timeStart > timeEnd)) { /* permite cruzar meia-noite */ }
    setSaving(true);
    const body = enabled
      ? {
          trigger_type: "schedule",
          trigger_value: JSON.stringify({
            days: Array.from(days).sort(),
            timeStart: useTime ? timeStart : null,
            timeEnd: useTime ? timeEnd : null,
            channels: allChannels ? null : Array.from(pickedChannels),
            condition,
          }),
        }
      : { trigger_type: "manual", trigger_value: null };
    const res = await fetch(`/api/flows/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { toast.error("Erro ao salvar"); return; }
    setFlows((prev) => prev.map((f) => f.id === selected.id ? { ...f, ...body } as Flow : f));
    toast.success(enabled ? "Automação salva!" : "Automação desligada");
  };

  const toggleDay = (n: number) => { const s = new Set(days); s.has(n) ? s.delete(n) : s.add(n); setDays(s); };

  return (
    <div className="rounded-card border border-bd bg-surface p-5">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="w-8 h-8 rounded-control flex items-center justify-center bg-accentsoft"><Zap className="w-4 h-4 text-accent" strokeWidth={2.2} /></span>
        <div>
          <h3 className="font-bold text-tx text-[15px] leading-none">Atendimento automático</h3>
          <p className="text-[11px] text-tx3 mt-1">Dispare um fluxo sozinho por dia, horário e canal — ex.: boas-vindas no almoço</p>
        </div>
      </div>

      {/* fluxos já automáticos */}
      {scheduled.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {scheduled.map((f) => (
            <button key={f.id} onClick={() => setSelectedId(f.id)} className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-accentsoft text-accent hover:brightness-95 transition">
              <CalendarClock className="w-3 h-3" strokeWidth={2.2} /> {f.name}
              <span className="font-semibold text-accent/70">· {summarize(f.trigger_value)}</span>
            </button>
          ))}
        </div>
      )}

      {/* seletor de fluxo */}
      <div className="mt-4">
        <label className="block text-xs font-bold text-tx2 mb-1.5">Fluxo</label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full rounded-control border border-bd bg-surface2 px-3 py-2 text-sm text-tx focus:border-accent focus:outline-none">
          <option value="">Selecione um fluxo para automatizar…</option>
          {flows.map((f) => <option key={f.id} value={f.id}>{f.name}{f.trigger_type === "schedule" ? " (automático)" : ""}</option>)}
        </select>
      </div>

      {selected && (
        <div className="mt-4 space-y-4">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-[color:var(--accent)] w-4 h-4" />
            <span className="text-sm font-bold text-tx">Disparar automaticamente</span>
          </label>

          <div className={enabled ? "space-y-4" : "space-y-4 opacity-40 pointer-events-none"}>
            {/* dias */}
            <div>
              <p className="text-xs font-bold text-tx2 mb-1.5">Dias</p>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => (
                  <button key={d.n} onClick={() => toggleDay(d.n)} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${days.has(d.n) ? "bg-accent text-white shadow-glow" : "bg-surface2 text-tx2 hover:bg-hover"}`}>{d.label}</button>
                ))}
              </div>
            </div>

            {/* horário */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer select-none mb-1.5">
                <input type="checkbox" checked={useTime} onChange={(e) => setUseTime(e.target.checked)} className="accent-[color:var(--accent)] w-4 h-4" />
                <span className="text-xs font-bold text-tx2 flex items-center gap-1"><Clock className="w-3.5 h-3.5" strokeWidth={2} /> Só em uma faixa de horário</span>
              </label>
              {useTime && (
                <div className="flex items-center gap-2 pl-6">
                  <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className="rounded-control border border-bd bg-surface2 px-2 py-1.5 text-sm text-tx focus:border-accent focus:outline-none" />
                  <span className="text-tx3 text-sm">até</span>
                  <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className="rounded-control border border-bd bg-surface2 px-2 py-1.5 text-sm text-tx focus:border-accent focus:outline-none" />
                </div>
              )}
            </div>

            {/* condição */}
            <div>
              <p className="text-xs font-bold text-tx2 mb-1.5">Condição</p>
              <div className="space-y-1.5">
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input type="radio" name="cond" checked={condition === "first_message"} onChange={() => setCondition("first_message")} className="accent-[color:var(--accent)] w-4 h-4 mt-0.5" />
                  <span className="text-[13px] text-tx"><b>Só quando o lead chega pela 1ª vez</b> <span className="text-tx3">(boas-vindas — não dispara pra quem já está em atendimento)</span></span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input type="radio" name="cond" checked={condition === "any"} onChange={() => setCondition("any")} className="accent-[color:var(--accent)] w-4 h-4 mt-0.5" />
                  <span className="text-[13px] text-tx">Toda mensagem de cliente no período</span>
                </label>
              </div>
            </div>

            {/* canais */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer select-none mb-1.5">
                <input type="checkbox" checked={allChannels} onChange={(e) => setAllChannels(e.target.checked)} className="accent-[color:var(--accent)] w-4 h-4" />
                <span className="text-xs font-bold text-tx2">Todos os canais</span>
              </label>
              {!allChannels && (
                <div className="max-h-32 overflow-y-auto space-y-1 rounded-lg border border-bd p-2">
                  {channels.length === 0 && <p className="text-xs text-tx3 py-1">Nenhum canal encontrado</p>}
                  {channels.map((c) => {
                    const on = pickedChannels.has(c.phoneId);
                    return (
                      <label key={c.phoneId} className="flex items-center gap-2 cursor-pointer select-none px-1 py-1 rounded hover:bg-hover">
                        <input type="checkbox" checked={on} onChange={() => { const s = new Set(pickedChannels); on ? s.delete(c.phoneId) : s.add(c.phoneId); setPickedChannels(s); }} className="accent-[color:var(--accent)] w-4 h-4" />
                        <span className="text-xs font-semibold text-tx truncate">{c.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <button onClick={save} disabled={saving} className="w-full rounded-control bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-accent2 disabled:opacity-50 transition flex items-center justify-center gap-1.5">
            {saving ? "Salvando…" : <><Check className="w-4 h-4" strokeWidth={2.5} /> Salvar automação</>}
          </button>
        </div>
      )}
    </div>
  );
}
