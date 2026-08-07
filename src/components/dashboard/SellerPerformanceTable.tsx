"use client";

interface SellerRow {
  name: string;
  avatar?: string;
  novas: number;
  enviadas: number;
  recebidas: number;
  ativas: number;
  aguardando: number;
}

function initials(name: string) {
  return (name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function SellerPerformanceTable({ data, title }: { data: SellerRow[]; title?: string }) {
  return (
    <div className="rounded-card border border-bd bg-surface shadow-card overflow-hidden">
      <div className="px-6 pt-5 pb-3">
        <h3 className="text-sm font-bold tracking-[-0.01em] text-tx">{title || "Performance por vendedor"}</h3>
        <p className="text-xs text-tx3 mt-0.5">Atendimento e volume por operador no período</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-[0.06em] text-tx3 border-b border-line">
              <th className="text-left font-bold px-6 py-2.5">Vendedor</th>
              <th className="text-right font-bold px-3 py-2.5">Novas</th>
              <th className="text-right font-bold px-3 py-2.5">Enviadas</th>
              <th className="text-right font-bold px-3 py-2.5">Recebidas</th>
              <th className="text-right font-bold px-3 py-2.5">Ativas</th>
              <th className="text-right font-bold px-6 py-2.5">Fila</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-tx3">Sem dados no período</td></tr>
            ) : (
              data.map((r) => {
                const filaHigh = r.ativas > 0 && r.aguardando / r.ativas >= 0.5;
                return (
                  <tr key={r.name} className="border-b border-line last:border-0 hover:bg-rowhover transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {r.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.avatar}
                            alt={r.name}
                            className="w-7 h-7 rounded-full object-cover flex-shrink-0 ring-1 ring-bd"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-accentsoft flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-accent">{initials(r.name)}</span>
                          </div>
                        )}
                        <span className="font-semibold text-tx truncate">{r.name}</span>
                      </div>
                    </td>
                    <td className="text-right px-3 py-3 font-bold text-tx tabular-nums">{r.novas}</td>
                    <td className="text-right px-3 py-3 text-tx2 tabular-nums">{r.enviadas.toLocaleString("pt-BR")}</td>
                    <td className="text-right px-3 py-3 text-tx2 tabular-nums">{r.recebidas.toLocaleString("pt-BR")}</td>
                    <td className="text-right px-3 py-3 text-tx2 tabular-nums">{r.ativas}</td>
                    <td className="text-right px-6 py-3">
                      <span
                        className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-[12px] font-bold tabular-nums ${
                          filaHigh ? "bg-amber-500/12 text-amber-600 dark:text-amber-400" : "bg-surface2 text-tx2"
                        }`}
                      >
                        {r.aguardando}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
