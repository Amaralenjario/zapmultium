"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import MessageBubble, { formatDateHeader, shouldShowDate, isConsecutive } from "./MessageBubble";
import ChatInput from "./ChatInput";
import FlowBar from "./FlowBar";
import QuickLinksBar from "./QuickLinksBar";
import Avatar from "./Avatar";
import type { Conversation } from "./ConversationList";
import toast from "react-hot-toast";

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

interface CrmTag { id: string; name: string; color: string; column_key: string; }

export default function ChatWindow({ conversation, onClose }: { conversation: Conversation; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneMap, setPhoneMap] = useState<Record<string, { name: string; color: string }>>({});
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [archived, setArchived] = useState(!!(conversation as any).archived);
  const [showTagModal, setShowTagModal] = useState(false);
  const [crmTags, setCrmTags] = useState<CrmTag[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLength = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const customer = Array.isArray(conversation.customer) ? conversation.customer[0] : conversation.customer;
  const phoneNumberId = (conversation as any).metadata?.phone_number_id || "";
  const operation = phoneMap[phoneNumberId];
  const customerPhone = customer?.phone || "";

  const lastCustomerMsg = useMemo(() => {
    const cm = messages.filter(m => m.sender_type === "customer");
    if (!cm.length) return null;
    return cm.reduce((l, m) => new Date(m.created_at) > new Date(l.created_at) ? m : l, cm[0]);
  }, [messages]);

  const window24h = useMemo(() => {
    if (!lastCustomerMsg) return null;
    const end = new Date(lastCustomerMsg.created_at).getTime() + 86400000;
    const rem = end - Date.now();
    return { open: rem > 0, remainingMs: rem, endTime: end };
  }, [lastCustomerMsg]);

  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (!window24h?.open) { setCountdown(""); return; }
    const update = () => {
      const rem = window24h.endTime - Date.now();
      setCountdown(rem <= 0 ? "Fechada" : `${Math.floor(rem / 3600000)}h ${Math.floor((rem % 3600000) / 60000)}m`);
    };
    update();
    const i = setInterval(update, 30000);
    return () => clearInterval(i);
  }, [window24h]);

  const fetchMessages = async () => {
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", conversation.id).order("created_at", { ascending: true });
    setMessages(data || []);
    setLoading(false);
  };

  useEffect(() => {
    setMessages([]); setLoading(true); prevLength.current = 0;
    fetchMessages();
    supabase.from("operations_channels").select("phone_number_id, operation:operation_id(name, color)").eq("is_active", true).not("phone_number_id", "is", null).then(({ data }) => {
      if (data) {
        const map: Record<string, { name: string; color: string }> = {};
        for (const row of data) {
          const op = Array.isArray(row.operation) ? row.operation[0] : row.operation;
          if (row.phone_number_id && op) map[row.phone_number_id] = { name: op.name, color: op.color };
        }
        setPhoneMap(map);
      }
    });
    markAsRead();
  }, [conversation.id]);

  const markAsRead = async () => {
    await supabase.from("conversations").update({ unread_count: 0, last_message_read: true }).eq("id", conversation.id);
    const { data: unread } = await supabase.from("messages").select("id, metadata").eq("conversation_id", conversation.id).eq("sender_type", "customer").is("read_at", null);
    if (unread && unread.length > 0) {
      const now = new Date().toISOString();
      await supabase.from("messages").update({ read_at: now }).eq("conversation_id", conversation.id).eq("sender_type", "customer").is("read_at", null);
      const lastMsg = unread[unread.length - 1];
      if (phoneNumberId && lastMsg?.metadata?.wa_message_id) {
        fetch("/api/evohub/mark-read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumberId, messageId: lastMsg.metadata.wa_message_id }) }).catch(() => {});
      }
    }
  };

  const handleReact = async (msg: Message, emoji: string) => {
    if (!phoneNumberId || !msg.metadata?.wa_message_id) return;
    fetch("/api/evohub/send-reaction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumberId, messageId: msg.metadata.wa_message_id, emoji, to: customerPhone }) }).catch(() => {});
    const reactions = { ...(msg.metadata?.reactions || {}), "me": emoji };
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, metadata: { ...m.metadata, reactions } } : m));
  };

  const toggleArchive = async () => {
    const next = !archived;
    await supabase.from("conversations").update({ archived: next }).eq("id", conversation.id);
    setArchived(next);
    toast.success(next ? "Conversa arquivada" : "Conversa desarquivada");
  };

  const handleOpenTagModal = async () => {
    setShowTagModal(true);
    const res = await fetch("/api/crm/tags");
    if (res.ok) setCrmTags(await res.json());
  };

  const handleAddTag = async (tagId: string) => {
    // Buscar ou criar lead
    let { data: lead } = await supabase.from("leads").select("id").eq("phone", customerPhone).maybeSingle();
    if (!lead) {
      const { data: newLead, error: createErr } = await supabase
        .from("leads")
        .insert({ name: customer?.name || customerPhone, phone: customerPhone, status: "new" })
        .select("id")
        .single();
      if (createErr) { toast.error("Erro ao criar lead"); return; }
      lead = newLead;
    }

    const res = await fetch(`/api/crm/leads/${lead.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tag_id: tagId }) });
    if (res.ok) { toast.success("Etiqueta aplicada!"); setShowTagModal(false); }
    else { const err = await res.json(); toast.error(err.error || "Erro ao etiquetar"); }
  };

  useEffect(() => {
    if (loading) return;
    requestAnimationFrame(() => {
      if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
    });
    prevLength.current = messages.length;
  }, [messages, loading]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase.from("messages").select("*").eq("conversation_id", conversation.id).order("created_at", { ascending: true });
      if (data && data.length > 0) {
        setMessages(prev => {
          if (data.length === prev.length) { let changed = false; const u = prev.map(m => { const f = data.find(d => d.id === m.id); if (f && f.read_at !== m.read_at) { changed = true; return f; } return m; }); return changed ? u : prev; }
          const ids = new Set(data.map(m => m.id));
          return [...prev.filter(m => ids.has(m.id)), ...data.filter(d => !prev.some(m => m.id === d.id))].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [conversation.id]);

  useEffect(() => {
    const channel = supabase.channel("messages-" + conversation.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` }, (payload) => {
        setMessages(prev => { if (prev.some(m => m.id === (payload.new as Message).id)) return prev; return [...prev, payload.new as Message]; });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversation.id]);

  const headerBg = operation?.color || "#075e54";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 text-white flex-shrink-0" style={{ backgroundColor: headerBg }}>
        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition md:hidden">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <Avatar name={customer?.name} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[15px] truncate">{customer?.name || customer?.phone || "Desconhecido"}</p>
          <p className="text-[12px] text-white/80 truncate">{customerPhone}</p>
        </div>
        <button onClick={handleOpenTagModal} className="p-2 hover:bg-white/10 rounded-full transition" title="Etiquetar lead">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
        </button>
        <button onClick={toggleArchive} className="p-2 hover:bg-white/10 rounded-full transition" title={archived ? "Desarquivar" : "Arquivar"}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={archived ? "M3 4h18M3 8l1.5 13h15L21 8M9 12v6M12 12v6M15 12v6" : "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"} /></svg>
        </button>
      </div>

      {/* 24h window */}
      {window24h && (
        <div className={`px-3 py-1.5 text-[10px] font-medium text-center flex-shrink-0 ${window24h.open ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-b border-amber-200 dark:border-amber-800" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-b border-red-200 dark:border-red-800"}`}>
          {window24h.open ? `Janela 24h · fecha em ${countdown}` : "Janela 24h fechada"}
        </div>
      )}

      <QuickLinksBar phoneNumberId={phoneNumberId} customerPhone={customerPhone} conversationId={conversation.id} customerName={customer?.name || customer?.phone || "Desconhecido"} />

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-2 flex flex-col">
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
          <div className="mt-auto py-2">
            <div className="flex justify-center mb-3">
              <span className="text-[11px] bg-white/90 dark:bg-[#182229] text-[#54656f] dark:text-gray-400 px-3 py-1 rounded-lg shadow-sm">As mensagens são criptografadas de ponta a ponta</span>
            </div>
            {messages.map((msg, i) => {
              const prev = i > 0 ? messages[i - 1] : null;
              const consecutive = isConsecutive(prev, msg);
              const dateLabel = shouldShowDate(prev?.created_at || "", msg.created_at) ? formatDateHeader(new Date(msg.created_at)) : undefined;
              const quotedMsg = msg.metadata?.context?.id ? messages.find(m => m.metadata?.wa_message_id === msg.metadata?.context?.id) : null;
              // Use enriched context content from webhook if available
              const quotedContent = quotedMsg?.content || msg.metadata?.context?.quoted_content || null;
              const quotedByAgent = quotedMsg?.sender_type === "agent" || msg.metadata?.context?.quoted_sender_type === "agent";
              return (
                <MessageBubble key={msg.id} message={msg} isFirst={!consecutive} showDate={dateLabel} quotedContent={quotedContent} quotedByAgent={quotedByAgent} onReply={() => setReplyTo(msg)} onReact={(emoji) => handleReact(msg, emoji)} />
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <ChatInput conversationId={conversation.id} phoneNumberId={phoneNumberId} customerPhone={customerPhone} onMessageSent={fetchMessages} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
      <FlowBar conversationId={conversation.id} phoneNumberId={phoneNumberId} customerPhone={customerPhone} />

      {showTagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowTagModal(false)}>
          <div className="w-full max-w-xs rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Etiquetar lead</h3>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {crmTags.map((tag) => (
                <button key={tag.id} onClick={() => handleAddTag(tag.id)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition text-left">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{tag.name}</span>
                </button>
              ))}
              {!crmTags.length && <p className="text-xs text-gray-400 text-center py-4">Nenhuma etiqueta. Crie no CRM.</p>}
            </div>
            <button onClick={() => setShowTagModal(false)} className="w-full mt-3 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-300">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
