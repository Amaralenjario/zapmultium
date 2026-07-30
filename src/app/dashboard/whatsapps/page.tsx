export default function WhatsappsPage() {
  const devices = [
    {
      id: "1",
      name: "Atendimento Principal",
      number: "+55 11 99999-0001",
      status: "connected",
      lastActive: "Agora",
      messages: 1248,
    },
    {
      id: "2",
      name: "Suporte Técnico",
      number: "+55 11 99999-0002",
      status: "connected",
      lastActive: "5min",
      messages: 537,
    },
    {
      id: "3",
      name: "Vendas",
      number: "+55 11 99999-0003",
      status: "disconnected",
      lastActive: "2h",
      messages: 3421,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">WhatsApps</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Gerencie suas conexões do WhatsApp
          </p>
        </div>
        <button className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 transition flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Conectar WhatsApp
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map((device) => (
          <div
            key={device.id}
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden hover:shadow-md transition"
          >
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    device.status === "connected"
                      ? "bg-green-100 dark:bg-green-600/20"
                      : "bg-gray-100 dark:bg-gray-800"
                  }`}>
                    <svg className={`w-6 h-6 ${
                      device.status === "connected"
                        ? "text-green-600 dark:text-green-400"
                        : "text-gray-400 dark:text-gray-500"
                    }`} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{device.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{device.number}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${
                    device.status === "connected" ? "bg-green-500" : "bg-red-500"
                  }`} />
                  <span className={`text-xs font-medium ${
                    device.status === "connected" ? "text-green-600 dark:text-green-400" : "text-red-500"
                  }`}>
                    {device.status === "connected" ? "Conectado" : "Desconectado"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Mensagens</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{device.messages.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Última atividade</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{device.lastActive}</p>
                </div>
              </div>
            </div>

            <div className="flex border-t border-gray-100 dark:border-gray-800">
              <button className="flex-1 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                Configurações
              </button>
              <button className={`flex-1 py-2.5 text-xs font-medium transition border-l border-gray-100 dark:border-gray-800 ${
                device.status === "connected"
                  ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  : "text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
              }`}>
                {device.status === "connected" ? "Desconectar" : "Reconectar"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
