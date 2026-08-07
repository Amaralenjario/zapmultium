"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const presets = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "15d", label: "15 dias" },
  { key: "30d", label: "30 dias" },
] as const;

// operations vem do servidor JÁ FILTRADO por permissão (o vendedor só recebe as dele)
export default function DashboardFilter({ operations = [] }: { operations?: { name: string; color: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("range") || "hoje";
  const activeOp = searchParams.get("op") || "";
  const customStart = searchParams.get("start") || "";
  const customEnd = searchParams.get("end") || "";

  const [showCustom, setShowCustom] = useState(active === "custom");
  const [startDate, setStartDate] = useState(customStart);
  const [endDate, setEndDate] = useState(customEnd);

  const applyFilter = (range: string, op?: string, start?: string, end?: string) => {
    const params = new URLSearchParams();
    params.set("range", range);
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    const currentOp = op !== undefined ? op : activeOp;
    if (currentOp) params.set("op", currentOp);
    router.push(`/dashboard?${params.toString()}`);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => { setShowCustom(false); applyFilter(p.key); }}
            className={`text-xs font-semibold px-3 py-1.5 rounded-control transition-all duration-150 ${
              active === p.key && !showCustom
                ? "bg-accent text-white shadow-glow"
                : "text-tx2 hover:bg-hover hover:text-tx"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-control transition-all duration-150 ${
            showCustom
              ? "bg-accent text-white shadow-glow"
              : "text-tx2 hover:bg-hover hover:text-tx"
          }`}
        >
          Personalizado
        </button>
        {showCustom && (
          <div className="flex items-center gap-1.5 ml-1">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-[11px] rounded-control border border-bd bg-surface2 px-2.5 py-1.5 text-tx focus:ring-1 focus:ring-accent focus:border-accent outline-none" />
            <span className="text-xs text-tx3">até</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-[11px] rounded-control border border-bd bg-surface2 px-2.5 py-1.5 text-tx focus:ring-1 focus:ring-accent focus:border-accent outline-none" />
            <button onClick={() => applyFilter("custom", undefined, startDate, endDate)} disabled={!startDate || !endDate} className="text-[11px] font-semibold px-3 py-1.5 rounded-control bg-accent text-white disabled:opacity-40 transition">Aplicar</button>
          </div>
        )}
      </div>
      {operations.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => applyFilter(active, "")}
            className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition ${!activeOp ? "bg-accent text-white" : "bg-surface2 text-tx2 hover:bg-hover"}`}
          >
            Todas operações
          </button>
          {operations.map(op => (
            <button
              key={op.name}
              onClick={() => applyFilter(active, activeOp === op.name ? "" : op.name)}
              className="text-[11px] px-2.5 py-1 rounded-full font-medium transition flex items-center gap-1"
              style={{
                backgroundColor: activeOp === op.name ? op.color : op.color + "15",
                color: activeOp === op.name ? "#fff" : op.color,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: op.color }} />
              {op.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
