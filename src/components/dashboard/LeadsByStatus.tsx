"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS: Record<string, string> = {
  new: "#3b82f6",
  contacted: "#eab308",
  qualified: "#a855f7",
  converted: "#22c55e",
  lost: "#ef4444",
};

const LABELS: Record<string, string> = {
  new: "Novos",
  contacted: "Contatados",
  qualified: "Qualificados",
  converted: "Convertidos",
  lost: "Perdidos",
};

export default function LeadsByStatus({ data }: { data: { status: string; count: number }[] }) {
  const chartData = data.map((d) => ({
    name: LABELS[d.status] || d.status,
    value: d.count,
    color: COLORS[d.status] || "#6b7280",
  }));

  if (chartData.every((d) => d.value === 0)) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Leads por status</h3>
        <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
          Nenhum lead ainda
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h3 className="text-sm font-medium text-gray-400 mb-4">Leads por status</h3>
      <div className="flex items-center gap-4">
        <div className="w-40 h-40 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" stroke="none">
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: "8px", color: "#f3f4f6" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {chartData.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
                <span className="text-gray-400">{entry.name}</span>
              </div>
              <span className="font-medium">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
