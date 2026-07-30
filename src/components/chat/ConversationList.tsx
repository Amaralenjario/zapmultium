"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "./Avatar";

export interface Customer {
  name: string;
  phone: string;
  avatar_url: string | null;
  id?: string;
}

export interface Conversation {
  id: string;
  status: string;
  last_message: string | null;
  last_message_at: string | null;
  last_message_sender?: string | null;
  last_message_read?: boolean | null;
  unread_count: number;
  created_at: string;
  metadata?: Record<string, any>;
  customer: Customer | Customer[];
}

export default function ConversationList({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (conv: Conversation) => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [phoneMap, setPhoneMap] = useState<Record<string, { name: string; color: string }>>({});
  const supabase = createClient();

  useEffect(() => {
    const fetchConversations = async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, status, last_message, last_message_at, last_message_sender, last_message_read, unread_count, created_at, metadata, customer:customer_id(name, phone, avatar_url)")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(50);
      setConversations(data || []);
    };

    const fetchOperations = async () => {
      const { data } = await supabase
        .from("operations_channels")
        .select("phone_number_id, operation:operation_id(name, color)")
        .eq("is_active", true)
        .not("phone_number_id", "is", null);
      if (data) {
        const map: Record<string, { name: string; color: string }> = {};
        for (const row of data) {
          const op = Array.isArray(row.operation) ? row.operation[0] : row.operation;
          if (row.phone_number_id && op) map[row.phone_number_id] = { name: op.name, color: op.color };
        }
        setPhoneMap(map);
      }
    };

    fetchConversations();
    fetchOperations();

    const channel = supabase
      .channel("conversations-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => fetchConversations())
      .subscribe();

    const interval = setInterval(fetchConversations, 3000);

    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, []);

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 7) {
      const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      return dias[d.getDay()];
    }
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#111b21]">
      <div className="p-3 border-b border-gray-100 dark:border-[#222d34] bg-[#f0f2f5] dark:bg-[#202c33] flex items-center gap-3">
        <div className="flex-1 relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#54656f] dark:text-[#8696a0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Pesquisar conversa..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white dark:bg-[#2a3942] border-0 text-[14px] text-[#111b21] dark:text-[#e9edef] placeholder:text-[#667781] dark:placeholder:text-[#8696a0] focus:ring-1 focus:ring-green-500 focus:outline-none transition"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-12 text-center text-[#667781] dark:text-[#8696a0] text-sm">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p>Nenhuma conversa ainda</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const customer = Array.isArray(conv.customer) ? conv.customer[0] : conv.customer;
            const isSelected = selectedId === conv.id;
            const phoneNumberId = (conv as any).metadata?.phone_number_id || "";
            const operation = phoneMap[phoneNumberId];

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 transition text-left border-l-[3px] ${
                  isSelected
                    ? "bg-[#f0f2f5] dark:bg-[#2a3942]"
                    : "hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]"
                }`}
                style={operation ? { borderLeftColor: operation.color } : { borderLeftColor: "transparent" }}
              >
                <Avatar name={customer?.name} size="md" />
                <div className="flex-1 min-w-0 border-b border-gray-100 dark:border-[#222d34] pb-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {operation && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: operation.color }} title={operation.name} />
                      )}
                      <p className="font-normal text-[16px] text-[#111b21] dark:text-[#e9edef] truncate">
                        {customer?.name || customer?.phone || "Desconhecido"}
                      </p>
                    </div>
                    <span className="text-[11px] text-[#667781] dark:text-[#8696a0] flex-shrink-0 ml-2">
                      {formatTime(conv.last_message_at || conv.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <div className="flex items-center gap-1 min-w-0">
                      <p className="text-[13px] text-[#667781] dark:text-[#8696a0] truncate">
                        {conv.last_message_sender === "agent" && <span>Você: </span>}
                        {conv.last_message || ""}
                      </p>
                      {conv.last_message_sender === "agent" && (
                        <svg className={`w-3.5 h-3.5 flex-shrink-0 ${conv.last_message_read ? "text-[#53bdeb]" : "text-[#8696a0]"}`} fill="currentColor" viewBox="0 0 16 11">
                          <path d="M11.071.653a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 00-.336-.153.508.508 0 00-.432.246.458.458 0 00.058.515l2.326 2.424a.56.56 0 00.416.21.55.55 0 00.427-.208l6.502-8.022a.466.466 0 00.078-.493.458.458 0 00-.153-.136Z" />
                          <path d="M14.071.653a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 00-.336-.153.508.508 0 00-.432.246.458.458 0 00.058.515l2.326 2.424a.56.56 0 00.416.21.55.55 0 00.427-.208l6.502-8.022a.466.466 0 00.078-.493.458.458 0 00-.153-.136Z" transform="translate(3,0)" />
                        </svg>
                      )}
                    </div>
                    {conv.unread_count > 0 ? (
                      <span className="bg-[#25d366] text-white text-[11px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2 min-w-[20px] text-center leading-tight">
                        {conv.unread_count}
                      </span>
                    ) : (
                      <span />
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
