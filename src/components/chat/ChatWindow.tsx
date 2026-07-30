"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import MessageBubble, { formatDateHeader, shouldShowDate, isConsecutive } from "./MessageBubble";
import ChatInput from "./ChatInput";
import Avatar from "./Avatar";
import type { Conversation } from "./ConversationList";

interface Message {
  id: string;
  content: string;
  sender_type: "customer" | "agent" | "system" | "bot";
  content_type: string;
  created_at: string;
  read_at?: string | null;
  conversation_id: string;
}

export default function ChatWindow({
  conversation,
  onClose,
}: {
  conversation: Conversation;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneMap, setPhoneMap] = useState<Record<string, { name: string; color: string }>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLength = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const customer = Array.isArray(conversation.customer)
    ? conversation.customer[0]
    : conversation.customer;

  const phoneNumberId = (conversation as any).metadata?.phone_number_id || "";
  const operation = phoneMap[phoneNumberId];
  const customerPhone = customer?.phone || "";

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });
    setMessages(data || []);
    setLoading(false);
  };

  useEffect(() => {
    setMessages([]);
    setLoading(true);
    prevLength.current = 0;
    fetchMessages();

    supabase
      .from("operations_channels")
      .select("phone_number_id, operation:operation_id(name, color)")
      .eq("is_active", true)
      .not("phone_number_id", "is", null)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, { name: string; color: string }> = {};
          for (const row of data) {
            const op = Array.isArray(row.operation) ? row.operation[0] : row.operation;
            if (row.phone_number_id && op) map[row.phone_number_id] = { name: op.name, color: op.color };
          }
          setPhoneMap(map);
        }
      });

    // Marcar conversa como lida ao entrar
    markAsRead();
  }, [conversation.id]);

  const markAsRead = async () => {
    // Zerar unread_count e marcar como lido
    await supabase.from("conversations").update({ unread_count: 0, last_message_read: true }).eq("id", conversation.id);

    // Marcar mensagens do cliente como lidas
    const { data: unread } = await supabase
      .from("messages")
      .select("id, metadata")
      .eq("conversation_id", conversation.id)
      .eq("sender_type", "customer")
      .is("read_at", null);

    if (unread && unread.length > 0) {
      const now = new Date().toISOString();
      await supabase
        .from("messages")
        .update({ read_at: now })
        .eq("conversation_id", conversation.id)
        .eq("sender_type", "customer")
        .is("read_at", null);

      // Enviar read receipt pra Meta
      if (phoneNumberId) {
        fetch("/api/evohub/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phoneNumberId,
            channelId: conversation.id,
            messageId: unread[unread.length - 1]?.metadata?.wa_message_id,
          }),
        }).catch(() => {});
      }
    }
  };

  useEffect(() => {
    if (loading) return;
    // Scroll instantâneo ao abrir, smooth em novas mensagens
    const isInitial = messages.length > 0 && prevLength.current === 0;
    bottomRef.current?.scrollIntoView({ behavior: isInitial ? "instant" : "smooth" });
    prevLength.current = messages.length;
  }, [messages, loading]);

  // Polling para novas mensagens e atualizações (read_at, etc)
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });
      if (data && data.length > 0) {
        setMessages((prev) => {
          if (data.length === prev.length) {
            // Checar se alguma mensagem teve read_at atualizado
            let changed = false;
            const updated = prev.map((m) => {
              const fresh = data.find((d) => d.id === m.id);
              if (fresh && fresh.read_at !== m.read_at) { changed = true; return fresh; }
              return m;
            });
            return changed ? updated : prev;
          }
          // Mensagens novas
          const freshIds = new Set(data.map((m) => m.id));
          const merged = [...prev.filter((m) => freshIds.has(m.id)), ...data.filter((d) => !prev.some((m) => m.id === d.id))];
          return merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [conversation.id]);

  useEffect(() => {
    const channel = supabase
      .channel("messages-" + conversation.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === (payload.new as Message).id)) return prev;
            return [...prev, payload.new as Message];
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversation.id]);

  const headerBg = operation?.color || "#075e54";

  return (
    <div className="flex flex-col h-full bg-[#efeae2] dark:bg-[#0b141a]">
      <div className="flex items-center gap-3 px-4 py-2.5 text-white flex-shrink-0" style={{ backgroundColor: headerBg }}>
        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <Avatar name={customer?.name} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[15px] truncate">{customer?.name || customer?.phone || "Desconhecido"}</p>
          <p className="text-[12px] text-white/80 truncate">{customerPhone}</p>
        </div>
        <button className="p-2 hover:bg-white/10 rounded-full transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-[3px] border-gray-300 border-t-[#075e54] dark:border-gray-600 dark:border-t-green-400 rounded-full" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full opacity-40">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-3 text-[#8696a0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-[#8696a0] text-sm">Nenhuma mensagem</p>
            </div>
          </div>
        ) : (
          <div className="px-4 py-2">
            <div className="flex justify-center mb-3">
              <span className="text-[11px] bg-white/90 dark:bg-[#182229] text-[#54656f] dark:text-gray-400 px-3 py-1 rounded-lg shadow-sm">
                As mensagens são criptografadas de ponta a ponta
              </span>
            </div>
            {messages.map((msg, i) => {
              const prev = i > 0 ? messages[i - 1] : null;
              const consecutive = isConsecutive(prev, msg);
              const dateLabel = shouldShowDate(prev?.created_at || "", msg.created_at)
                ? formatDateHeader(new Date(msg.created_at))
                : undefined;
              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isFirst={!consecutive}
                  showDate={dateLabel}
                />
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <ChatInput
        conversationId={conversation.id}
        phoneNumberId={phoneNumberId}
        customerPhone={customerPhone}
        onMessageSent={fetchMessages}
      />
    </div>
  );
}
