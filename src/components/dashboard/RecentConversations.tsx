"use client";

import Avatar from "@/components/chat/Avatar";

interface RecentItem {
  id: string;
  name: string;
  phone: string;
  status?: string;
  message?: string;
  time: string;
}

const statusColors: Record<string, string> = {
  active: "bg-success-soft text-success",
  pending: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  closed: "bg-surface2 text-tx2",
  archived: "bg-red-500/10 text-red-500 dark:bg-red-500/15 dark:text-red-400",
};

export default function RecentConversations({ data, title, emptyText }: { data: RecentItem[]; title?: string; emptyText?: string }) {
  return (
    <div className="rounded-card border border-bd bg-surface p-6 shadow-card">
      <h3 className="text-sm font-bold tracking-[-0.01em] text-tx mb-4">{title || "Conversas recentes"}</h3>
      {data.length === 0 ? (
        <div className="py-10 flex flex-col items-center justify-center text-center">
          <svg className="w-12 h-12 text-tx3/50 mb-3" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3a49.5 49.5 0 01-4.02-.163 2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951" />
          </svg>
          <p className="text-sm text-tx3">{emptyText || "Nenhuma conversa recente"}</p>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {data.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:bg-rowhover -mx-2 px-2 rounded-lg transition-colors duration-150">
              <Avatar name={item.name} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-tx truncate">{item.name}</p>
                  <span className="text-[11px] text-tx3 flex-shrink-0">{item.time}</span>
                </div>
                <p className="text-xs text-tx3 truncate mt-0.5">{item.message || item.phone}</p>
              </div>
              {item.status && (
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${statusColors[item.status] || "bg-surface2 text-tx2"}`}>
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
