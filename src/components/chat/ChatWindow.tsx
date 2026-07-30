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
  metadata?: any;
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
  const [replyTo, setReplyTo] = useState<Message | null>(null);
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

  const [showFlowModal, setShowFlowModal] = useState(false);
  const [availableFlows, setAvailableFlows] = useState<any[]>([]);
  const [activeExecution, setActiveExecution] = useState<any>(null);
  const [triggering, setTriggering] = useState(false);
  const [loadingFlows, setLoadingFlows] = useState(false);

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
    await supabase.from("conversations").update({ unread_count: 0, last_message_read: true }).eq("id", conversation.id);

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

      // Enviar read receipt para a última mensagem (marca todas como lidas no WhatsApp)
      const lastMsg = unread[unread.length - 1];
      if (phoneNumberId && lastMsg?.metadata?.wa_message_id) {
        fetch("/api/evohub/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phoneNumberId,
            messageId: lastMsg.metadata.wa_message_id,
          }),
        }).catch(() => {});
      }
    }
  };

  const handleReact = async (msg: Message, emoji: string) => {
    if (!phoneNumberId || !msg.metadata?.wa_message_id) return;
    fetch("/api/evohub/send-reaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumberId, messageId: msg.metadata.wa_message_id, emoji, to: customerPhone }),
    }).catch(() => {});
    const reactions = { ...(msg.metadata?.reactions || {}), "me": emoji };
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, metadata: { ...m.metadata, reactions } } : m));
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

  // Check for active flow executions
  useEffect(() => {
    const checkExecution = async () => {
      try {
        const res = await fetch(`/api/flows/executions?conversation_id=${conversation.id}`);
        const data = await res.json();
        if (data && data.length > 0) {
          const active = data.find((e: any) => ["running", "paused", "pending"].includes(e.status));
          if (active) setActiveExecution(active);
        }
      } catch {}
    };
    checkExecution();
  }, [conversation.id]);

  const handleOpenFlowModal = async () => {
    setLoadingFlows(true);
    setShowFlowModal(true);
    const res = await fetch("/api/flows");
    const data = await res.json();
    setAvailableFlows(data || []);
    setLoadingFlows(false);
  };

  const handleTriggerFlow = async (flow: any) => {
    setTriggering(true);
    try {
      const res = await fetch("/api/flows/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flow_id: flow.id,
          conversation_id: conversation.id,
          customer_phone: customerPhone,
          phone_number_id: phoneNumberId,
        }),
      });
      const result = await res.json();
      if (result.ok) {
        setActiveExecution(result.execution);
        setShowFlowModal(false);
      } else {
        alert(result.error || "Erro ao disparar fluxo");
      }
    } catch {
      alert("Erro ao disparar fluxo");
    }
    setTriggering(false);
  };

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
        <button onClick={handleOpenFlowModal} className="p-2 hover:bg-white/10 rounded-full transition relative" title="Disparar fluxo">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {activeExecution && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
          )}
        </button>
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
              const quotedMsg = msg.metadata?.context?.id ? messages.find(m => m.metadata?.wa_message_id === msg.metadata?.context?.id) : null;
              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isFirst={!consecutive}
                  showDate={dateLabel}
                  quotedContent={quotedMsg?.content}
                  quotedByAgent={quotedMsg?.sender_type === "agent"}
                  onReply={() => setReplyTo(msg)}
                  onReact={(emoji) => handleReact(msg, emoji)}
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
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />

      {activeExecution && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800">
          <svg className="w-3.5 h-3.5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-blue-600 dark:text-blue-400">Fluxo ativo</span>
          <button onClick={() => setActiveExecution(null)} className="ml-auto text-blue-400 hover:text-blue-600">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {showFlowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowFlowModal(false)}>
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Disparar Fluxo</h2>
            {loadingFlows ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-[3px] border-gray-300 border-t-emerald-500 rounded-full" />
              </div>
            ) : availableFlows.length === 0 ? (
              <p className="text-center py-8 text-gray-400 text-sm">Nenhum fluxo disponível</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {availableFlows.map((flow) => (
                  <button
                    key={flow.id}
                    disabled={triggering}
                    onClick={() => handleTriggerFlow(flow)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition text-left disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{flow.name}</p>
                      <p className="text-xs text-gray-400">{flow.config?.steps?.length || 0} etapas</p>
                    </div>
                    <svg className="w-4 h-4 ml-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowFlowModal(false)} className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
