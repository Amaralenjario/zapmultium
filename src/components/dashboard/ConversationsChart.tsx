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

  if (data.every((d) => d.total === 0 && d.active === 0)) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-emerald-950/40 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Conversas nos últimos 7 dias</h3>
        <div className="h-48 flex flex-col items-center justify-center text-center">
          <svg className="w-10 h-10 text-gray-300 dark:text-gray-700 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma conversa nos últimos 7 dias</p>
          <p className="text-xs text-gray-400/60 dark:text-gray-600 mt-0.5">Os dados aparecerão aqui conforme as conversas acontecem</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-emerald-950/40 bg-white dark:bg-gray-900 p-6 shadow-sm">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Conversas nos últimos 7 dias</h3>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/30 dark:bg-emerald-500/40" />
          <span className="text-[11px] text-gray-400 dark:text-gray-500">Total</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          <span className="text-[11px] text-gray-400 dark:text-gray-500">Ativas</span>
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={3} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1f2937" : "#f3f4f6"} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: isDark ? "#6b7280" : "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} dy={8} />
            <YAxis tick={{ fill: isDark ? "#6b7280" : "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}
              contentStyle={{
                background: isDark ? "#111827" : "#ffffff",
                border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
                borderRadius: "10px",
                fontSize: "12px",
                padding: "8px 12px",
                color: isDark ? "#f3f4f6" : "#111827",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
            />
            <Bar dataKey="total" fill="rgba(16,185,129,0.3)" radius={[4, 4, 0, 0]} name="Total" />
            <Bar dataKey="active" fill="rgba(16,185,129,0.95)" radius={[4, 4, 0, 0]} name="Ativas" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
