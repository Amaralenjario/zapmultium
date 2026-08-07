"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTheme } from "@/components/ThemeProvider";

interface ConversationData {
  date: string;
  total: number;
  active: number;
}

export default function ConversationsChart({ data }: { data: ConversationData[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Paleta do design (tokens) resolvida por tema
  const t = isDark
    ? { c1: "#6E8CFF", c2: "#5877F0", grid: "#1F2735", axis: "#697490", surface: "#141A26", bd: "#242C3C", tx: "#E9EDF6" }
    : { c1: "#3A5AF0", c2: "#2842C4", grid: "#F1F3F8", axis: "#A5AEC0", surface: "#FFFFFF", bd: "#ECEEF4", tx: "#0E1526" };

  if (data.every((d) => d.total === 0 && d.active === 0)) {
    return (
      <div className="rounded-card border border-bd bg-surface p-6 shadow-card">
        <h3 className="text-sm font-bold tracking-[-0.01em] text-tx mb-4">Conversas nos últimos 7 dias</h3>
        <div className="h-48 flex flex-col items-center justify-center text-center">
          <svg className="w-10 h-10 text-tx3/50 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          <p className="text-sm text-tx3">Nenhuma conversa nos últimos 7 dias</p>
          <p className="text-xs text-tx3/70 mt-0.5">Os dados aparecerão aqui conforme as conversas acontecem</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-bd bg-surface p-6 shadow-card">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold tracking-[-0.01em] text-tx">Conversas nos últimos 7 dias</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: t.c1, opacity: 0.4 }} />
            <span className="text-[11px] text-tx3">Total</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: t.c2 }} />
            <span className="text-[11px] text-tx3">Ativas</span>
          </div>
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={t.c1} stopOpacity={0.14} />
                <stop offset="95%" stopColor={t.c1} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={t.c2} stopOpacity={0.25} />
                <stop offset="95%" stopColor={t.c2} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: t.axis, fontSize: 11 }} axisLine={false} tickLine={false} dy={8} />
            <YAxis tick={{ fill: t.axis, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
            <Tooltip
              cursor={{ stroke: t.bd, strokeWidth: 1, strokeDasharray: "4 4" }}
              contentStyle={{
                background: t.surface,
                border: `1px solid ${t.bd}`,
                borderRadius: "12px",
                fontSize: "12px",
                padding: "8px 12px",
                color: t.tx,
                boxShadow: "0 6px 20px rgba(16,24,40,.12)",
              }}
            />
            <Area type="monotone" dataKey="total" stroke={t.c1} strokeWidth={1.5} fillOpacity={1} fill="url(#colorTotal)" name="Total" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: t.c1 }} />
            <Area type="monotone" dataKey="active" stroke={t.c2} strokeWidth={2} fillOpacity={1} fill="url(#colorActive)" name="Ativas" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: t.c2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
