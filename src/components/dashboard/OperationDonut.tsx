"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTheme } from "@/components/ThemeProvider";

interface OpSlice {
  name: string;
  value: number;
  color: string;
}

export default function OperationDonut({ data, total, subtitle }: { data: OpSlice[]; total: number; subtitle?: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const t = isDark
    ? { surface: "#141A26", bd: "#242C3C", tx: "#E9EDF6" }
    : { surface: "#FFFFFF", bd: "#ECEEF4", tx: "#0E1526" };

  const slices = data.filter((d) => d.value > 0);

  return (
    <div className="rounded-card border border-bd bg-surface p-6 shadow-card">
      <h3 className="text-sm font-bold tracking-[-0.01em] text-tx">Conversas por operação</h3>
      <p className="text-xs text-tx3 mt-0.5 mb-4">{subtitle || `${total} no período`}</p>
      {slices.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-tx3">Sem dados no período</div>
      ) : (
        <div className="flex items-center gap-5">
          <div className="w-40 h-40 flex-shrink-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={slices} cx="50%" cy="50%" innerRadius={48} outerRadius={68} dataKey="value" stroke="none" paddingAngle={2}>
                  {slices.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: t.surface,
                    border: `1px solid ${t.bd}`,
                    borderRadius: "10px",
                    fontSize: "12px",
                    padding: "6px 10px",
                    color: t.tx,
                    boxShadow: "0 6px 20px rgba(16,24,40,.12)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-extrabold tracking-[-0.03em] text-tx leading-none">{total}</span>
              <span className="text-[10px] text-tx3 mt-0.5">total</span>
            </div>
          </div>
          <div className="flex-1 space-y-2.5 min-w-0">
            {slices.map((entry) => {
              const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
              return (
                <div key={entry.name} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.color }} />
                    <span className="text-tx2 text-[13px] truncate">{entry.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-bold text-tx text-[13px]">{entry.value}</span>
                    <span className="text-[11px] text-tx3 w-8 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
