import { createClient } from "@/lib/supabase/server";

export default async function FluxosPage() {
  const supabase = createClient();

  const { data: flows } = await supabase
    .from("flows")
    .select("*")
    .order("updated_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fluxos</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Crie e gerencie fluxos de atendimento automatizado</p>
        </div>
        <button className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition">
          + Novo fluxo
        </button>
      </div>

      {!flows || flows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8">
          <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="text-center">
              <p className="text-lg">Nenhum fluxo criado</p>
              <p className="text-sm mt-1">Crie seu primeiro fluxo de atendimento</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {flows.map((flow) => (
            <div
              key={flow.id}
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 hover:border-gray-300 dark:hover:border-gray-700 transition cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">{flow.name}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    flow.status === "active"
                      ? "bg-green-100 text-green-600 dark:bg-green-600/20 dark:text-green-400"
                      : flow.status === "draft"
                      ? "bg-gray-100 text-gray-500 dark:bg-gray-600/20 dark:text-gray-400"
                      : "bg-yellow-100 text-yellow-600 dark:bg-yellow-600/20 dark:text-yellow-400"
                  }`}
                >
                  {flow.status}
                </span>
              </div>
              {flow.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{flow.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{flow.trigger_type}</span>
                {flow.trigger_value && (
                  <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{flow.trigger_value}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
