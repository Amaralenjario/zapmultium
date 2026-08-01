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
  new: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  contacted: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  qualified: "bg-emerald-400/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  converted: "bg-emerald-600/15 text-emerald-600 dark:bg-emerald-600/20 dark:text-emerald-400",
  lost: "bg-gray-500/10 text-gray-500 dark:bg-gray-500/15 dark:text-gray-400",
};

const priorityDots: Record<string, string> = {
  urgent: "bg-red-400",
  high: "bg-orange-400",
  normal: "bg-amber-400",
  low: "bg-emerald-400",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

const initialsColors = [
  "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
  "bg-emerald-600/15 text-emerald-700 dark:bg-emerald-600/20 dark:text-emerald-300",
  "bg-teal-500/15 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400",
  "bg-green-500/15 text-green-600 dark:bg-green-500/20 dark:text-green-400",
];

function getInitialsColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return initialsColors[Math.abs(hash) % initialsColors.length];
}

export default function RecentLeads({ data }: { data: LeadItem[] }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-emerald-950/40 bg-white dark:bg-gray-900 p-6 shadow-sm">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Leads recentes</h3>
      {data.length === 0 ? (
        <div className="py-10 flex flex-col items-center justify-center text-center">
          <svg className="w-12 h-12 text-gray-200 dark:text-gray-800 mb-3" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
          <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum lead recente</p>
          <p className="text-xs text-gray-400/60 dark:text-gray-600 mt-0.5">Quando você tiver leads, eles aparecem aqui</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {data.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:bg-gray-50 dark:hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors duration-150">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getInitialsColor(item.name)}`}>
                <span className="text-[11px] font-semibold">{getInitials(item.name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-[5px] h-[5px] rounded-full flex-shrink-0 ${priorityDots[item.priority] || "bg-gray-400"}`} />
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                  </div>
                  <span className="text-[11px] text-gray-400 dark:text-gray-600 flex-shrink-0">{item.time}</span>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5 ml-[21px]">{item.phone}</p>
              </div>
              <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${statusColors[item.status] || "bg-gray-500/10 text-gray-500"}`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
