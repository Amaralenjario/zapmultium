"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

const presets = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "15d", label: "15 dias" },
  { key: "30d", label: "30 dias" },
] as const;

export default function DashboardFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("range") || "7d";
  const activeOp = searchParams.get("op") || "";
  const customStart = searchParams.get("start") || "";
  const customEnd = searchParams.get("end") || "";

  const [showCustom, setShowCustom] = useState(active === "custom");
  const [startDate, setStartDate] = useState(customStart);
  const [endDate, setEndDate] = useState(customEnd);
  const [operations, setOperations] = useState<{ name: string; color: string }[]>([]);

  useEffect(() => {
    fetch("/api/operations").then(r => r.json()).then(setOperations).catch(() => {});
  }, []);

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
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-150 ${
              active === p.key && !showCustom
                ? "bg-emerald-500 text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-150 ${
            showCustom
              ? "bg-emerald-500 text-white shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          Personalizado
        </button>
        {showCustom && (
          <div className="flex items-center gap-1.5 ml-1">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-[11px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
            <span className="text-xs text-gray-400">até</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-[11px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
            <button onClick={() => applyFilter("custom", undefined, startDate, endDate)} disabled={!startDate || !endDate} className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-emerald-500 text-white disabled:opacity-40 transition">Aplicar</button>
          </div>
        )}
      </div>
      {operations.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => applyFilter(active, "")}
            className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition ${!activeOp ? "bg-emerald-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}
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
