import Avatar from "@/components/chat/Avatar";

const sellers = [
  { id: "1", name: "Carlos Eduardo", email: "carlos@zapmultium.com", role: "Vendedor Sênior", leads: 42, conversions: 18, revenue: "R$ 24.500", status: "active", rating: 4.8 },
  { id: "2", name: "Marina Oliveira", email: "marina@zapmultium.com", role: "Vendedora Pleno", leads: 35, conversions: 12, revenue: "R$ 15.200", status: "active", rating: 4.5 },
  { id: "3", name: "Ricardo Almeida", email: "ricardo@zapmultium.com", role: "Vendedor Júnior", leads: 28, conversions: 9, revenue: "R$ 9.800", status: "active", rating: 4.2 },
  { id: "4", name: "Fernanda Souza", email: "fernanda@zapmultium.com", role: "Vendedora Pleno", leads: 31, conversions: 14, revenue: "R$ 18.600", status: "offline", rating: 4.6 },
  { id: "5", name: "André Moreira", email: "andre@zapmultium.com", role: "Vendedor Sênior", leads: 56, conversions: 27, revenue: "R$ 38.900", status: "active", rating: 4.9 },
  { id: "6", name: "Patricia Castro", email: "patricia@zapmultium.com", role: "Vendedora Júnior", leads: 19, conversions: 6, revenue: "R$ 5.400", status: "offline", rating: 3.9 },
];

export default function VendedoresPage() {
  const activeSellers = sellers.filter((s) => s.status === "active").length;
  const totalRevenue = sellers.reduce((sum, s) => sum + parseInt(s.revenue.replace(/\D/g, "")), 0);
  const totalLeads = sellers.reduce((sum, s) => sum + s.leads, 0);
  const totalConversions = sellers.reduce((sum, s) => sum + s.conversions, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vendedores</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Gerencie sua equipe de vendas
          </p>
        </div>
        <button className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 transition flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo vendedor
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatBox label="Ativos" value={activeSellers} sub={`de ${sellers.length}`} color="green" />
        <StatBox label="Leads captados" value={totalLeads} sub="total" color="blue" />
        <StatBox label="Conversões" value={totalConversions} sub={`${Math.round((totalConversions / totalLeads) * 100)}% taxa`} color="purple" />
        <StatBox label="Receita" value={`R$ ${(totalRevenue / 1000).toFixed(0)}k`} sub="total" color="yellow" />
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
              <th className="text-left p-4 font-medium text-gray-500 dark:text-gray-400">Vendedor</th>
              <th className="text-left p-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
              <th className="text-left p-4 font-medium text-gray-500 dark:text-gray-400">Leads</th>
              <th className="text-left p-4 font-medium text-gray-500 dark:text-gray-400">Conversões</th>
              <th className="text-left p-4 font-medium text-gray-500 dark:text-gray-400">Receita</th>
              <th className="text-left p-4 font-medium text-gray-500 dark:text-gray-400">Avaliação</th>
              <th className="text-right p-4 font-medium text-gray-500 dark:text-gray-400">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sellers.map((seller) => (
              <tr
                key={seller.id}
                className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={seller.name} size="sm" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{seller.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{seller.role}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                      seller.status === "active"
                        ? "text-green-600 dark:text-green-400"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        seller.status === "active" ? "bg-green-500" : "bg-gray-400"
                      }`}
                    />
                    {seller.status === "active" ? "Online" : "Offline"}
                  </span>
                </td>
                <td className="p-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{seller.leads}</p>
                    <div className="w-24 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(seller.leads / 56) * 100}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{seller.conversions}</p>
                    <div className="w-24 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${(seller.conversions / 27) * 100}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <p className="font-semibold text-gray-900 dark:text-white">{seller.revenue}</p>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-gray-900 dark:text-white">{seller.rating}</span>
                    <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number | string;
  sub: string;
  color: "green" | "blue" | "purple" | "yellow";
}) {
  const colors = {
    green: "from-green-50 to-white dark:from-green-600/20 dark:to-green-600/5 border-green-200 dark:border-green-600/30",
    blue: "from-blue-50 to-white dark:from-blue-600/20 dark:to-blue-600/5 border-blue-200 dark:border-blue-600/30",
    purple: "from-purple-50 to-white dark:from-purple-600/20 dark:to-purple-600/5 border-purple-200 dark:border-purple-600/30",
    yellow: "from-yellow-50 to-white dark:from-yellow-600/20 dark:to-yellow-600/5 border-yellow-200 dark:border-yellow-600/30",
  };

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 ${colors[color]}`}>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">{sub}</p>
    </div>
  );
}
