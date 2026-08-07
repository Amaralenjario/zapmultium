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
  new: "bg-accentsoft text-accent",
  contacted: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  qualified: "bg-accentsoft text-accent",
  converted: "bg-success-soft text-success",
  lost: "bg-surface2 text-tx2",
};

const priorityDots: Record<string, string> = {
  urgent: "bg-red-400",
  high: "bg-orange-400",
  normal: "bg-amber-400",
  low: "bg-success",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

export default function RecentLeads({ data }: { data: LeadItem[] }) {
  return (
    <div className="rounded-card border border-bd bg-surface p-6 shadow-card">
      <h3 className="text-sm font-bold tracking-[-0.01em] text-tx mb-4">Leads recentes</h3>
      {data.length === 0 ? (
        <div className="py-10 flex flex-col items-center justify-center text-center">
          <svg className="w-12 h-12 text-tx3/50 mb-3" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
          <p className="text-sm text-tx3">Nenhum lead recente</p>
          <p className="text-xs text-tx3/70 mt-0.5">Quando você tiver leads, eles aparecem aqui</p>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {data.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:bg-rowhover -mx-2 px-2 rounded-lg transition-colors duration-150">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-accentsoft text-accent">
                <span className="text-[11px] font-bold">{getInitials(item.name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-[5px] h-[5px] rounded-full flex-shrink-0 ${priorityDots[item.priority] || "bg-tx3"}`} />
                    <p className="text-sm font-semibold text-tx truncate">{item.name}</p>
                  </div>
                  <span className="text-[11px] text-tx3 flex-shrink-0">{item.time}</span>
                </div>
                <p className="text-xs text-tx3 truncate mt-0.5 ml-[21px]">{item.phone}</p>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${statusColors[item.status] || "bg-surface2 text-tx2"}`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
