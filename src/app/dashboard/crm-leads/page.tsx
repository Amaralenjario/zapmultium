import { createClient } from "@/lib/supabase/server";

const statusColors: Record<string, string> = {
  new: "bg-blue-600/20 text-blue-400",
  contacted: "bg-yellow-600/20 text-yellow-400",
  qualified: "bg-purple-600/20 text-purple-400",
  converted: "bg-green-600/20 text-green-400",
  lost: "bg-red-600/20 text-red-400",
};

const priorityColors: Record<string, string> = {
  low: "text-gray-400",
  normal: "text-blue-400",
  high: "text-yellow-400",
  urgent: "text-red-400",
};

export default async function CrmLeadsPage() {
  const supabase = createClient();

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">CRM Leads</h1>
        <p className="text-gray-400 text-sm">Gerencie seus leads capturados pelo WhatsApp</p>
      </div>

      {!leads || leads.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-8">
          <div className="flex items-center justify-center h-64 text-gray-500 border border-dashed border-gray-700 rounded-lg">
            <div className="text-center">
              <p className="text-lg">Nenhum lead cadastrado</p>
              <p className="text-sm mt-1">Os leads aparecerão aqui conforme forem capturados</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left p-4 font-medium">Nome</th>
                <th className="text-left p-4 font-medium">Telefone</th>
                <th className="text-left p-4 font-medium">Origem</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium">Prioridade</th>
                <th className="text-left p-4 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-gray-800/50 hover:bg-gray-800/50 transition">
                  <td className="p-4 font-medium">{lead.name}</td>
                  <td className="p-4 text-gray-400">{lead.phone}</td>
                  <td className="p-4 text-gray-400">{lead.source}</td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[lead.status] || "bg-gray-600/20 text-gray-400"}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className={`p-4 ${priorityColors[lead.priority] || ""}`}>{lead.priority}</td>
                  <td className="p-4 text-gray-500">
                    {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
