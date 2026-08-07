"use client";

interface SellerRow {
  name: string;
  avatar?: string;
  novas: number;
  enviadas: number;
  recebidas: number;
  vendas: number;
  taxaConversao: number;
}

function initials(name: string) {
  return (name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function SellerPerformanceTable({ data, title }: { data: SellerRow[]; title?: string }) {
  const maxVendas = Math.max(1, ...data.map((r) => r.vendas));
  return (
    <div className="rounded-card border border-bd bg-surface shadow-card overflow-hidden">
      <div className="px-6 pt-5 pb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold tracking-[-0.01em] text-tx">{title || "Performance por vendedor"}</h3>
          <p className="text-xs text-tx3 mt-0.5">Ranking por vendas no período</p>
        </div>
        <span className="text-[11px] font-bold text-tx3 bg-surface2 rounded-full px-2.5 py-1 flex-shrink-0">{data.length} {data.length === 1 ? "vendedor" : "vendedores"}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-[0.06em] text-tx3 border-b border-line">
              <th className="text-center font-bold px-3 py-2.5 w-12">#</th>
              <th className="text-left font-bold px-3 py-2.5">Vendedor</th>
              <th className="text-right font-bold px-3 py-2.5">Novas</th>
              <th className="text-right font-bold px-3 py-2.5">Enviadas</th>
              <th className="text-right font-bold px-3 py-2.5">Recebidas</th>
              <th className="text-right font-bold px-3 py-2.5">Vendas</th>
              <th className="text-right font-bold px-6 py-2.5">Conversão</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-tx3">Sem dados no período</td></tr>
            ) : (
              data.map((r, i) => {
                const rank = i + 1;
                const isTop = rank <= 3 && r.vendas > 0;
                const barPct = Math.round((r.vendas / maxVendas) * 100);
                const taxaCls = r.taxaConversao >= 20
                  ? "bg-success-soft text-success"
                  : r.taxaConversao > 0
                    ? "bg-accentsoft text-accent"
                    : "bg-surface2 text-tx3";
                return (
                  <tr key={r.name + i} className={`border-b border-line last:border-0 transition-colors ${rank === 1 && r.vendas > 0 ? "bg-accentsoft/40" : "hover:bg-rowhover"}`}>
                    <td className="px-3 py-3 text-center">
                      {isTop ? (
                        <span className="text-lg">{MEDALS[rank - 1]}</span>
                      ) : (
                        <span className="text-[13px] font-extrabold text-tx3 tabular-nums">{rank}º</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {r.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.avatar} alt={r.name} className={`w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ${rank === 1 && r.vendas > 0 ? "ring-accent" : "ring-bd"}`} />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-accentsoft flex items-center justify-center flex-shrink-0">
                            <span className="text-[11px] font-bold text-accent">{initials(r.name)}</span>
                          </div>
                        )}
                        <span className="font-semibold text-tx truncate">{r.name}</span>
                      </div>
                    </td>
                    <td className="text-right px-3 py-3 text-tx2 tabular-nums">{r.novas}</td>
                    <td className="text-right px-3 py-3 text-tx2 tabular-nums">{r.enviadas.toLocaleString("pt-BR")}</td>
                    <td className="text-right px-3 py-3 text-tx2 tabular-nums">{r.recebidas.toLocaleString("pt-BR")}</td>
                    <td className="text-right px-3 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <div className="hidden sm:block w-14 h-1.5 rounded-full bg-surface2 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: rank === 1 && r.vendas > 0 ? "linear-gradient(90deg, var(--accent), #7C3AED)" : "var(--accent)" }} />
                        </div>
                        <span className="font-extrabold text-tx tabular-nums min-w-[1.5rem]">{r.vendas}</span>
                      </div>
                    </td>
                    <td className="text-right px-6 py-3">
                      <span className={`inline-flex items-center justify-center min-w-[2.75rem] px-2 py-0.5 rounded-full text-[12px] font-bold tabular-nums ${taxaCls}`}>
                        {r.taxaConversao}%
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
