"use client";

import { useEffect, useState, useCallback } from "react";
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
  archived?: boolean;
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
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [phoneMap, setPhoneMap] = useState<Record<string, { name: string; color: string }>>({});
  const [activeFlows, setActiveFlows] = useState<Record<string, { count: number; flowNames: string[] }>>({});
  const [sellerPhoneIds, setSellerPhoneIds] = useState<string[] | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "archived">("active");
  const [search, setSearch] = useState("");
  const supabase = createClient();

  const applyFilters = useCallback(() => {
    let filtered = allConversations;

    // Seller channel filter
    if (sellerPhoneIds !== null) {
      filtered = filtered.filter((conv) => {
        const phoneId = (conv as any).metadata?.phone_number_id || "";
        return sellerPhoneIds.length > 0 ? sellerPhoneIds.includes(phoneId) : false;
      });
    }

    // Archived filter
    if (filter === "active") filtered = filtered.filter((c) => !c.archived);
    else if (filter === "archived") filtered = filtered.filter((c) => !!c.archived);

    // Search filter: nome, telefone, última mensagem
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((conv) => {
        const customer = Array.isArray(conv.customer) ? conv.customer[0] : conv.customer;
        const name = (customer?.name || "").toLowerCase();
        const phone = (customer?.phone || "").toLowerCase();
        const msg = (conv.last_message || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || msg.includes(q);
      });
    }

    setConversations(filtered);
  }, [allConversations, sellerPhoneIds, filter, search]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  useEffect(() => {
    const fetchConversations = async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, status, archived, last_message, last_message_at, last_message_sender, last_message_read, unread_count, created_at, metadata, customer:customer_id(name, phone, avatar_url)")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(100);
      setAllConversations(data || []);
    };

    const fetchSellerChannels = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role === "admin" || profile?.role === "supervisor") {
        setSellerPhoneIds(null);
        return;
      }
      const { data: sc } = await supabase.from("seller_channels").select("evohub_channel_id").eq("user_id", user.id);
      if (!sc || sc.length === 0) { setSellerPhoneIds([]); return; }
      const channelIds = sc.map((s) => s.evohub_channel_id);
      const { data: oc } = await supabase.from("operations_channels").select("evohub_channel_id, phone_number_id").eq("is_active", true);
      const phoneIdMap: Record<string, string> = {
        "5145a0c0-a358-43e5-8269-c5ace26ca023": "897878513398151",
        "effa72d1-47f6-445b-acbc-7693ef21ee24": "976034132269824",
        "c5505ddf-f9ef-4837-9337-45ed3de40d6a": "892228177298374",
        "346e4eef-bc78-41ec-a7ae-ec7ec75bf177": "1034222499765101",
        "b1c6879b-e962-4f50-95f7-14f1a04601a5": "1234821229708132",
      };
      for (const row of oc || []) { if (row.phone_number_id) phoneIdMap[row.evohub_channel_id] = row.phone_number_id; }
      setSellerPhoneIds(channelIds.map((cid) => phoneIdMap[cid]).filter(Boolean));
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

    const fetchActiveFlows = async () => {
      try {
        const res = await fetch("/api/flows/active");
        if (!res.ok) return;
        const data = await res.json();
        const map: Record<string, { count: number; flowNames: string[] }> = {};
        for (const item of data) { map[item.conversation_id] = { count: item.count, flowNames: item.flowNames }; }
        setActiveFlows(map);
      } catch {}
    };

    fetchConversations();
    fetchSellerChannels();
    fetchOperations();
    fetchActiveFlows();

    const channel = supabase
      .channel("conversations-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => fetchConversations())
      .subscribe();

    const interval = setInterval(fetchConversations, 3000);
    const flowInterval = setInterval(fetchActiveFlows, 5000);

    return () => { supabase.removeChannel(channel); clearInterval(interval); clearInterval(flowInterval); };
  }, []);

  const toggleArchive = async (convId: string, current: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("conversations").update({ archived: !current }).eq("id", convId);
    setAllConversations((prev) => prev.map((c) => c.id === convId ? { ...c, archived: !current } : c));
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 7) { const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]; return dias[d.getDay()]; }
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#111b21]">
      <div className="p-3 border-b border-gray-100 dark:border-[#222d34] bg-[#f0f2f5] dark:bg-[#202c33]">
        <div className="relative mb-2">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#54656f] dark:text-[#8696a0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar por nome, número ou mensagem..." className="w-full pl-9 pr-4 py-2 rounded-lg bg-white dark:bg-[#2a3942] border-0 text-[14px] text-[#111b21] dark:text-[#e9edef] placeholder:text-[#667781] dark:placeholder:text-[#8696a0] focus:ring-1 focus:ring-green-500 focus:outline-none transition" />
        </div>
        <div className="flex gap-1">
          {(["all", "active", "archived"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 text-[11px] font-medium py-1.5 rounded-lg transition ${
                filter === f
                  ? "bg-emerald-600 text-white"
                  : "text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-white/5"
              }`}
            >
              {f === "all" ? "Todas" : f === "active" ? "Ativas" : "Arquivadas"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-12 text-center text-[#667781] dark:text-[#8696a0] text-sm">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p>{filter === "archived" ? "Nenhuma conversa arquivada" : "Nenhuma conversa"}</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const customer = Array.isArray(conv.customer) ? conv.customer[0] : conv.customer;
            const isSelected = selectedId === conv.id;
            const phoneNumberId = (conv as any).metadata?.phone_number_id || "";
            const operation = phoneMap[phoneNumberId];
            const flowInfo = activeFlows[conv.id];

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 transition text-left border-l-[3px] group ${
                  isSelected
                    ? "bg-[#f0f2f5] dark:bg-[#2a3942]"
                    : "hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]"
                } ${conv.archived ? "opacity-60" : ""}`}
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
                      {flowInfo && (
                        <span className="flex-shrink-0 flex items-center gap-0.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-full pl-1 pr-1.5 py-px" title={`${flowInfo.count} fluxo(s): ${flowInfo.flowNames.join(", ")}`}>
                          <svg className="w-2.5 h-2.5 text-blue-500 animate-pulse" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                          <span className="text-[9px] font-medium text-blue-600 dark:text-blue-400">{flowInfo.count > 1 ? flowInfo.count : ""}</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#667781] dark:text-[#8696a0] flex-shrink-0 ml-2">
                      {formatTime(conv.last_message_at || conv.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
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
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => toggleArchive(conv.id, !!conv.archived, e)} className="opacity-0 group-hover:opacity-100 transition p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title={conv.archived ? "Desarquivar" : "Arquivar"}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={conv.archived ? "M3 4h18M3 8l1.5 13h15L21 8M9 12v6M12 12v6M15 12v6" : "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"} />
                        </svg>
                      </button>
                      {conv.unread_count > 0 ? (
                        <span className="bg-[#25d366] text-white text-[11px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 min-w-[20px] text-center leading-tight">{conv.unread_count}</span>
                      ) : <span />}
                    </div>
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
