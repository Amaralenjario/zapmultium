"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTheme } from "@/components/ThemeProvider";

const COLORS: Record<string, string> = {
  new: "#10b981",
  contacted: "#34d399",
  qualified: "#6ee7b7",
  converted: "#059669",
  lost: "#374151",
};

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

  const chartData = data.map((d) => ({
    name: LABELS[d.status] || d.status,
    value: d.count,
    color: COLORS[d.status] || "#6b7280",
  }));

  if (chartData.every((d) => d.value === 0)) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-emerald-950/40 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Leads por status</h3>
        <div className="h-48 flex flex-col items-center justify-center text-center">
          <svg className="w-10 h-10 text-gray-300 dark:text-gray-700 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
          <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum lead ainda</p>
          <p className="text-xs text-gray-400/60 dark:text-gray-600 mt-0.5">Quando você tiver leads, eles aparecem aqui</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-emerald-950/40 bg-white dark:bg-gray-900 p-6 shadow-sm">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Leads por status</h3>
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
                  background: isDark ? "#111827" : "#ffffff",
                  border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
                  borderRadius: "10px",
                  fontSize: "12px",
                  padding: "6px 10px",
                  color: isDark ? "#f3f4f6" : "#111827",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
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
                <span className="text-gray-500 dark:text-gray-400 text-[13px]">{entry.name}</span>
              </div>
              <span className="font-semibold text-gray-800 dark:text-gray-200 text-[13px]">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
