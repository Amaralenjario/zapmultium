"use client";

interface LeadItem {
  id: string;
  name: string;
  phone: string;
  status: string;
  priority: string;
  time: string;
}

const statusColors: Record<string, string> = {
  new: "bg-blue-600/20 text-blue-400",
  contacted: "bg-yellow-600/20 text-yellow-400",
  qualified: "bg-purple-600/20 text-purple-400",
  converted: "bg-green-600/20 text-green-400",
  lost: "bg-red-600/20 text-red-400",
};

const priorityIcons: Record<string, string> = {
  urgent: "\u{1F534}",
  high: "\u{1F7E0}",
  normal: "\u{1F7E1}",
  low: "\u{1F7E2}",
};

export default function RecentLeads({ data }: { data: LeadItem[] }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h3 className="text-sm font-medium text-gray-400 mb-4">Leads recentes</h3>
      {data.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">Nenhum lead</p>
      ) : (
        <div className="space-y-3">
          {data.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <span className="text-sm">{priorityIcons[item.priority] || "\u{26AB}"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{item.time}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">{item.phone}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors[item.status] || "bg-gray-600/20 text-gray-400"}`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
