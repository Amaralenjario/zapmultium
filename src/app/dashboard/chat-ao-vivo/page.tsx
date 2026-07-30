import { createClient } from "@/lib/supabase/server";

export default async function ChatAoVivoPage() {
  const supabase = createClient();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, status, last_message, last_message_at, unread_count, created_at, customer:customer_id(name, phone, avatar_url)")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Chat ao vivo</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Atendimento em tempo real via WhatsApp</p>
      </div>

      {!conversations || conversations.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8">
          <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="text-center">
              <p className="text-lg">Nenhum chat ativo</p>
              <p className="text-sm mt-1">Conecte um número de WhatsApp para começar</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => {
            const customer = Array.isArray(conv.customer)
              ? conv.customer[0]
              : conv.customer;
            return (
              <div
                key={conv.id}
                className="flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-gray-300 dark:hover:border-gray-700 transition cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-600/20 flex items-center justify-center text-green-600 dark:text-green-500 font-bold text-sm">
                  {customer?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{customer?.name || customer?.phone || "Desconhecido"}</p>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {conv.last_message_at
                        ? new Date(conv.last_message_at).toLocaleDateString("pt-BR")
                        : new Date(conv.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{conv.last_message || "Nova conversa"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {conv.unread_count > 0 && (
                    <span className="bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {conv.unread_count}
                    </span>
                  )}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      conv.status === "active"
                        ? "bg-green-100 text-green-600 dark:bg-green-600/20 dark:text-green-400"
                        : conv.status === "pending"
                        ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-600/20 dark:text-yellow-400"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-600/20 dark:text-gray-400"
                    }`}
                  >
                    {conv.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
