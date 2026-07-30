import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import Avatar from "./Avatar";
import type { Conversation } from "./ConversationList";

interface Message {
  id: string;
  content: string;
  sender_type: "customer" | "agent" | "system" | "bot";
  content_type: string;
  created_at: string;
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
            if (row.phone_number_id && op) {
              map[row.phone_number_id] = { name: op.name, color: op.color };
            }
          }
          setPhoneMap(map);
        }
      });
  }, [conversation.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel("messages-" + conversation.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message])
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversation.id]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3 bg-[#075e54] text-white">
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <Avatar name={customer?.name} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{customer?.name || customer?.phone || "Desconhecido"}</p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-white/70">{conversation.status === "active" ? "Online" : conversation.status}</p>
            {operation && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: operation.color }}>
                {operation.name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-[#e5ddd5] dark:bg-[#1a1a1a]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-[#075e54] border-t-transparent rounded-full" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
            Nenhuma mensagem ainda
          </div>
        ) : (
          <div>
            <div className="flex justify-center mb-4">
              <span className="text-xs bg-white/80 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 px-3 py-1 rounded-full shadow-sm">
                Início da conversa
              </span>
            </div>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
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
