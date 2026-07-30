import { createClient } from "@/lib/supabase/server";
import Avatar from "@/components/chat/Avatar";

interface Seller {
  id: string;
  nome: string;
  instancia_evolution: string;
  created_at: string;
}

export default async function VendedoresPage() {
  const supabase = createClient();

  const { data: sellers } = await supabase
    .from("vendedores")
    .select("*")
    .order("created_at", { ascending: true });

  const { data: currentUser } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", currentUser.user?.id)
    .single();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vendedores</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {sellers?.length || 0} vendedor{sellers?.length === 1 ? "" : "es"} cadastrado{sellers?.length === 1 ? "" : "s"}
          </p>
        </div>
        <button className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 transition flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo vendedor
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
              <th className="text-left p-4 font-medium text-gray-500 dark:text-gray-400">Vendedor</th>
              <th className="text-left p-4 font-medium text-gray-500 dark:text-gray-400">Instância WhatsApp</th>
              <th className="text-left p-4 font-medium text-gray-500 dark:text-gray-400">EvoHub</th>
              <th className="text-left p-4 font-medium text-gray-500 dark:text-gray-400">Cadastrado em</th>
              <th className="text-right p-4 font-medium text-gray-500 dark:text-gray-400">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(sellers || []).map((seller: Seller) => (
              <tr
                key={seller.id}
                className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={seller.nome} size="sm" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{seller.nome}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{seller.id.substring(0, 8)}...</p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    {seller.instancia_evolution || "Não definida"}
                  </span>
                </td>
                <td className="p-4">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-600/20 dark:text-purple-400 font-medium">
                    EvoHub
                  </span>
                </td>
                <td className="p-4 text-gray-400 dark:text-gray-500">
                  {new Date(seller.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="p-4 text-right">
                  <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {profile?.role === "admin" && (
        <div className="mt-6 rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            Como admin, você vê todos os vendedores. Operadores veem apenas seus próprios canais.
          </p>
        </div>
      )}
    </div>
  );
}
