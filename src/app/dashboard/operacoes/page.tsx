import { getAllOperations } from "@/lib/operations";

export default async function OperacoesPage() {
  const operations = await getAllOperations();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Operações</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {operations.length} operação ativa
          </p>
        </div>
        <button className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 transition flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova operação
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {operations.map((op) => (
          <div
            key={op.id}
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden hover:shadow-md transition"
            style={{ borderTopColor: op.color, borderTopWidth: "3px" }}
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: op.color }}
                  />
                  <h3 className="font-bold text-gray-900 dark:text-white">{op.name}</h3>
                </div>
                <span className="text-xs font-mono text-gray-400">{op.slug}</span>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-gray-400 uppercase font-medium">Números vinculados</p>
                {op.channels && op.channels.length > 0 ? (
                  <div className="space-y-1.5">
                    {op.channels.map((ch: { id: string; evohub_channel_name: string; phone_number_id: string | null }) => (
                      <div
                        key={ch.id}
                        className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2"
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300">{ch.evohub_channel_name}</span>
                        {ch.phone_number_id ? (
                          <span className="text-[10px] bg-green-100 text-green-600 dark:bg-green-600/20 dark:text-green-400 px-2 py-0.5 rounded-full">
                            Ativo
                          </span>
                        ) : (
                          <span className="text-[10px] bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 px-2 py-0.5 rounded-full">
                            Pendente
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Nenhum número vinculado</p>
                )}
              </div>
            </div>

            <div className="flex border-t border-gray-100 dark:border-gray-800">
              <button className="flex-1 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                Editar
              </button>
              <button className="flex-1 py-2.5 text-xs font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 transition border-l border-gray-100 dark:border-gray-800">
                + Vincular número
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
