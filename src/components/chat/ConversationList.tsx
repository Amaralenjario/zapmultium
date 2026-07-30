"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
  unread_count: number;
  created_at: string;
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
  const supabase = createClient();

  useEffect(() => {
    const fetchConversations = async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, status, last_message, last_message_at, unread_count, created_at, customer:customer_id(name, phone, avatar_url)")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(50);
      setConversations(data || []);
    };

    fetchConversations();

    const channel = supabase
      .channel("conversations-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => fetchConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Pesquisar conversa..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none transition"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
            Nenhuma conversa
          </div>
        ) : (
          conversations.map((conv) => {
            const customer = Array.isArray(conv.customer) ? conv.customer[0] : conv.customer;
            const isSelected = selectedId === conv.id;

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition text-left border-b border-gray-100 dark:border-gray-800/50 ${
                  isSelected ? "bg-gray-100 dark:bg-gray-800" : ""
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-600/20 flex items-center justify-center text-green-600 dark:text-green-400 font-bold flex-shrink-0">
                  {customer?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                      {customer?.name || customer?.phone || "Desconhecido"}
                    </p>
                    <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 ml-2">
                      {formatTime(conv.last_message_at || conv.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {conv.last_message || "Nova conversa"}
                    </p>
                    {conv.unread_count > 0 && (
                      <span className="bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2 min-w-[20px] text-center">
                        {conv.unread_count}
                      </span>
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
