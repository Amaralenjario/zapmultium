"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTheme } from "@/components/ThemeProvider";

interface VolumeData {
  label: string;
  enviadas: number;
  recebidas: number;
}

export default function MessageVolumeChart({ data, subtitle }: { data: VolumeData[]; subtitle?: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const t = isDark
    ? { c1: "#6E8CFF", c2: "#3FD68C", grid: "#1F2735", axis: "#697490", surface: "#141A26", bd: "#242C3C", tx: "#E9EDF6" }
    : { c1: "#3A5AF0", c2: "#0E9E5A", grid: "#F1F3F8", axis: "#A5AEC0", surface: "#FFFFFF", bd: "#ECEEF4", tx: "#0E1526" };

  const empty = data.every((d) => d.enviadas === 0 && d.recebidas === 0);

  return (
    <div className="rounded-card border border-bd bg-surface p-6 shadow-card">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold tracking-[-0.01em] text-tx">Volume de mensagens</h3>
          <p className="text-xs text-tx3 mt-0.5">{subtitle || "Enviadas × recebidas"}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: t.c1 }} />
            <span className="text-[11px] text-tx3">Enviadas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: t.c2 }} />
            <span className="text-[11px] text-tx3">Recebidas</span>
          </div>
        </div>
      </div>
      {empty ? (
        <div className="h-56 flex items-center justify-center text-sm text-tx3">Sem mensagens no período</div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="volEnv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={t.c1} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={t.c1} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="volRec" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={t.c2} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={t.c2} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: t.axis, fontSize: 11 }} axisLine={false} tickLine={false} dy={8} />
              <YAxis tick={{ fill: t.axis, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
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
              <Area type="monotone" dataKey="enviadas" stroke={t.c1} strokeWidth={2} fill="url(#volEnv)" name="Enviadas" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: t.c1 }} />
              <Area type="monotone" dataKey="recebidas" stroke={t.c2} strokeWidth={2} fill="url(#volRec)" name="Recebidas" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: t.c2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
