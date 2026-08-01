"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
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
      <div className="rounded-2xl border border-gray-200 dark:border-emerald-950/40 bg-white dark:bg-gray-900 p-6 shadow-sm">
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

  const maxVal = Math.max(...data.map(d => d.total), 1);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-emerald-950/40 bg-white dark:bg-gray-900 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Conversas nos últimos 7 dias</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400/40" />
            <span className="text-[11px] text-gray-400 dark:text-gray-500">Total</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-gray-400 dark:text-gray-500">Ativas</span>
          </div>
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isDark ? "#10b981" : "#10b981"} stopOpacity={0.12} />
                <stop offset="95%" stopColor={isDark ? "#10b981" : "#10b981"} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isDark ? "#34d399" : "#059669"} stopOpacity={0.25} />
                <stop offset="95%" stopColor={isDark ? "#34d399" : "#059669"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1f2937" : "#f3f4f6"} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: isDark ? "#6b7280" : "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} dy={8} />
            <YAxis tick={{ fill: isDark ? "#6b7280" : "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
            <Tooltip
              cursor={{ stroke: isDark ? "#374151" : "#d1d5db", strokeWidth: 1, strokeDasharray: "4 4" }}
              contentStyle={{
                background: isDark ? "#111827" : "#ffffff",
                border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
                borderRadius: "12px",
                fontSize: "12px",
                padding: "8px 12px",
                color: isDark ? "#f3f4f6" : "#111827",
                boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              }}
            />
            <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#colorTotal)" name="Total" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: "#10b981" }} />
            <Area type="monotone" dataKey="active" stroke="#059669" strokeWidth={2} fillOpacity={1} fill="url(#colorActive)" name="Ativas" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: "#059669" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
