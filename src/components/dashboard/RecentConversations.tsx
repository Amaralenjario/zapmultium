"use client";

interface RecentItem {
  id: string;
  name: string;
  phone: string;
  status?: string;
  message?: string;
  time: string;
}

const statusColors: Record<string, string> = {
  active: "bg-green-600/20 text-green-400",
  pending: "bg-yellow-600/20 text-yellow-400",
  closed: "bg-gray-600/20 text-gray-400",
  archived: "bg-red-600/20 text-red-400",
};

export default function RecentConversations({ data }: { data: RecentItem[] }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h3 className="text-sm font-medium text-gray-400 mb-4">Conversas recentes</h3>
      {data.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">Nenhuma conversa</p>
      ) : (
        <div className="space-y-3">
          {data.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-green-600/20 flex items-center justify-center text-green-500 font-bold text-xs flex-shrink-0">
                {item.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{item.time}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">{item.message || item.phone}</p>
              </div>
              {item.status && (
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors[item.status] || "bg-gray-600/20 text-gray-400"}`}>
                  {item.status}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
