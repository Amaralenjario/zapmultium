"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTheme } from "@/components/ThemeProvider";

interface ConversationData {
  date: string;
  total: number;
  active: number;
}

export default function ConversationsChart({ data }: { data: ConversationData[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Conversas nos últimos 7 dias</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1f2937" : "#e5e7eb"} />
            <XAxis dataKey="date" tick={{ fill: isDark ? "#6b7280" : "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: isDark ? "#6b7280" : "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: isDark ? "#111827" : "#ffffff",
                border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
                borderRadius: "8px",
                color: isDark ? "#f3f4f6" : "#111827",
              }}
            />
            <Bar dataKey="active" fill="#22c55e" radius={[4, 4, 0, 0]} name="Ativas" />
            <Bar dataKey="total" fill={isDark ? "#374151" : "#d1d5db"} radius={[4, 4, 0, 0]} name="Total" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
