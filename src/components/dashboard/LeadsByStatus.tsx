"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTheme } from "@/components/ThemeProvider";

const LABELS: Record<string, string> = {
  new: "Novos",
  contacted: "Contatados",
  qualified: "Qualificados",
  converted: "Convertidos",
  lost: "Perdidos",
};

export default function LeadsByStatus({ data }: { data: { status: string; count: number }[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const COLORS: Record<string, string> = isDark
    ? { new: "#6E8CFF", contacted: "#4257A8", qualified: "#2B3557", converted: "#3FD68C", lost: "#697490" }
    : { new: "#3A5AF0", contacted: "#7D97F8", qualified: "#C9D3F8", converted: "#0E9E5A", lost: "#A5AEC0" };

  const t = isDark
    ? { surface: "#141A26", bd: "#242C3C", tx: "#E9EDF6" }
    : { surface: "#FFFFFF", bd: "#ECEEF4", tx: "#0E1526" };

  const chartData = data.map((d) => ({
    name: LABELS[d.status] || d.status,
    value: d.count,
    color: COLORS[d.status] || (isDark ? "#697490" : "#A5AEC0"),
  }));

  if (chartData.every((d) => d.value === 0)) {
    return (
      <div className="rounded-card border border-bd bg-surface p-6 shadow-card">
        <h3 className="text-sm font-bold tracking-[-0.01em] text-tx mb-4">Leads por status</h3>
        <div className="h-48 flex flex-col items-center justify-center text-center">
          <svg className="w-10 h-10 text-tx3/50 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
          <p className="text-sm text-tx3">Nenhum lead ainda</p>
          <p className="text-xs text-tx3/70 mt-0.5">Quando você tiver leads, eles aparecem aqui</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-bd bg-surface p-6 shadow-card">
      <h3 className="text-sm font-bold tracking-[-0.01em] text-tx mb-4">Leads por status</h3>
      <div className="flex items-center gap-4">
        <div className="w-40 h-40 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={42} outerRadius={64} dataKey="value" stroke="none">
                {chartData.map((entry, i) => (
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
        </div>
        <div className="flex-1 space-y-2.5">
          {chartData.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
                <span className="text-tx2 text-[13px]">{entry.name}</span>
              </div>
              <span className="font-bold text-tx text-[13px]">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
