"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { ChevronLeft, Tag, Archive, ArchiveRestore, MessagesSquare, Smartphone } from "lucide-react";
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

// União por id (nunca descarta) + reconcilia otimistas (remove o temp cujo conteúdo já
// chegou como msg real do agente). Retorna prev se nada mudou (evita re-render à toa).
function mergeMessages(prev: Message[], incoming: Message[]): Message[] {
  const byId = new Map<string, Message>();
  for (const m of prev) byId.set(m.id, m);
  let changed = false;
  for (const d of incoming) {
    const ex = byId.get(d.id);
    if (!ex) { byId.set(d.id, d); changed = true; }
    else if (ex.read_at !== d.read_at || ex.content !== d.content) { byId.set(d.id, d); changed = true; }
  }
  const realAgent = new Set(Array.from(byId.values()).filter(m => !String(m.id).startsWith("tmp_") && m.sender_type === "agent").map(m => m.content));
  for (const [id, m] of byId) {
    if (String(id).startsWith("tmp_") && m.metadata?.pending && realAgent.has(m.content)) { byId.delete(id); changed = true; }
  }
  if (!changed && byId.size === prev.length) return prev;
  return Array.from(byId.values()).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export default function ChatWindow({ conversation, onClose }: { conversation: Conversation; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneMap, setPhoneMap] = useState<Record<string, { name: string; color: string; channel?: string }>>({});
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [archived, setArchived] = useState(!!(conversation as any).archived);
  const [showTagModal, setShowTagModal] = useState(false);
  const [crmTags, setCrmTags] = useState<CrmTag[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLength = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const customer = Array.isArray(conversation.customer) ? conversation.customer[0] : conversation.customer;
  const rawPhoneId = (conversation as any).metadata?.phone_number_id || "";
  const [phoneNumberId, setPhoneNumberId] = useState(rawPhoneId);
  const operation = phoneMap[phoneNumberId];
  const customerPhone = customer?.phone || "";

  useEffect(() => {
    if (!rawPhoneId) {
      const fixPhoneId = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: sc } = await supabase.from("seller_channels").select("evohub_channel_id").eq("user_id", user.id).limit(1);
        if (sc && sc.length > 0) {
          const phoneIdMap: Record<string, string> = {
            "5145a0c0-a358-43e5-8269-c5ace26ca023": "897878513398151",
            "effa72d1-47f6-445b-acbc-7693ef21ee24": "976034132269824",
            "c5505ddf-f9ef-4837-9337-45ed3de40d6a": "892228177298374",
            "346e4eef-bc78-41ec-a7ae-ec7ec75bf177": "1034222499765101",
            "b1c6879b-e962-4f50-95f7-14f1a04601a5": "1234821229708132",
            "0bce92b7-b6a9-4859-ac87-bc2ed01719e1": "1077309398802921",
            "004d0718-04ae-4af5-b55b-aaa5136d1138": "1050317928161978",
          };
          const pid = phoneIdMap[sc[0].evohub_channel_id];
          if (pid) {
            setPhoneNumberId(pid);
            await supabase.from("conversations").update({ metadata: { phone_number_id: pid } }).eq("id", conversation.id);
          }
        }
      };
      fixPhoneId();
    }
  }, [rawPhoneId, conversation.id]);

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

  const fetchMessages = async (replace = false) => {
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", conversation.id).order("created_at", { ascending: true });
    // MESCLA (não substitui) pra não apagar mensagens otimísticas ainda não confirmadas.
    // replace=true só na 1ª carga da conversa (quando prev já foi zerado).
    if (replace) setMessages(data || []);
    else setMessages(prev => mergeMessages(prev, (data || []) as Message[]));
    setLoading(false);
  };

  // Envio OTIMISTA: mostra a mensagem na hora que o atendente dá enter (some a demora de segundos).
  // Ela é reconciliada (removida) quando a msg real do agente chega via realtime/poll.
  const addOptimistic = (content: string) => {
    const tmp = {
      id: "tmp_" + Date.now() + "_" + Math.random().toString(36).slice(2),
      conversation_id: conversation.id,
      sender_type: "agent" as const,
      content,
      content_type: "text",
      created_at: new Date().toISOString(),
      metadata: { pending: true },
    } as unknown as Message;
    setMessages(prev => [...prev, tmp]);
  };

  useEffect(() => {
    setMessages([]); setLoading(true); prevLength.current = 0;
    fetchMessages(true);
    supabase.from("operations_channels").select("phone_number_id, evohub_channel_name, operation:operation_id(name, color)").eq("is_active", true).not("phone_number_id", "is", null).then(({ data }) => {
      if (data) {
        const map: Record<string, { name: string; color: string; channel?: string }> = {};
        for (const row of data) {
          const op = Array.isArray(row.operation) ? row.operation[0] : row.operation;
          if (row.phone_number_id && op) map[row.phone_number_id] = { name: op.name, color: op.color, channel: (row as any).evohub_channel_name || undefined };
        }
        setPhoneMap(map);
      }
    });
    markAsRead();
  }, [conversation.id]);

  const markAsRead = async () => {
    // Só zera o contador de não-lidas do ATENDENTE. NÃO marca last_message_read:
    // esse campo é "o cliente viu minha mensagem" e vem do webhook de status (read receipt).
    await supabase.from("conversations").update({ unread_count: 0 }).eq("id", conversation.id);
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

  // Rola suavemente até a mensagem citada e dá um destaque rápido
  const scrollToMessage = (id: string) => {
    const el = containerRef.current?.querySelector(`[data-message-id="${id}"]`) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const bubble = (el.firstElementChild as HTMLElement | null) || el;
    bubble.style.transition = "box-shadow .3s ease";
    bubble.style.boxShadow = "0 0 0 3px var(--accent)";
    bubble.style.borderRadius = "16px";
    setTimeout(() => { bubble.style.boxShadow = "none"; }, 1400);
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
    const customerId = Array.isArray(conversation.customer) ? (conversation.customer[0] as any)?.id : (conversation.customer as any)?.id;

    let { data: lead } = await supabase.from("leads").select("id, lead_tags(tag_id)").eq("phone", customerPhone).maybeSingle();
    if (!lead) {
      const { data: newLead, error: createErr } = await supabase
        .from("leads")
        .insert({
          name: customer?.name || customerPhone,
          phone: customerPhone,
          status: "new",
          source: "whatsapp",
          customer_id: customerId || null,
          conversation_id: conversation.id,
          metadata: { phone_number_id: phoneNumberId },
        })
        .select("id")
        .single();
      if (createErr) { toast.error("Erro ao criar lead: " + createErr.message); return; }
      lead = { ...newLead, lead_tags: [] };
    } else {
      await supabase.from("leads").update({
        customer_id: customerId || null,
        conversation_id: conversation.id,
        updated_at: new Date().toISOString(),
      }).eq("id", lead.id);
    }

    const existingTags = (lead as any).lead_tags || [];
    const hasTag = existingTags.some((lt: any) => lt.tag_id === tagId);

    if (hasTag) {
      await supabase.from("lead_tags").delete().eq("lead_id", lead.id).eq("tag_id", tagId);
      toast.success("Etiqueta removida!");
    } else {
      const res = await fetch(`/api/crm/leads/${lead.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tag_id: tagId }) });
      if (res.ok) { toast.success("Etiqueta aplicada!"); }
      else { const err = await res.json(); toast.error(err.error || "Erro ao etiquetar"); return; }
    }

    setShowTagModal(false);
    window.dispatchEvent(new CustomEvent("lead-tagged"));
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
        // União por id + reconcilia otimistas (helper). NUNCA descarta msg real.
        setMessages(prev => mergeMessages(prev, data as Message[]));
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [conversation.id]);

  useEffect(() => {
    const channel = supabase.channel("messages-" + conversation.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` }, (payload) => {
        setMessages(prev => {
          const incoming = payload.new as Message;
          if (prev.some(m => m.id === incoming.id)) return prev;
          // remove o otimista (temp) de mesmo conteúdo quando a msg real do agente chega
          const next = incoming.sender_type === "agent"
            ? prev.filter(m => !(String(m.id).startsWith("tmp_") && (m.metadata as any)?.pending && m.content === incoming.content))
            : prev;
          return [...next, incoming];
        });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversation.id]);

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-surface border-b border-bd flex-shrink-0">
        <button onClick={onClose} className="p-1.5 hover:bg-hover rounded-full transition lg:hidden text-tx2">
          <ChevronLeft className="w-5 h-5" strokeWidth={2} />
        </button>
        <Avatar name={customer?.name} url={customer?.avatar_url} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[15px] text-tx truncate">{customer?.name || customer?.phone || "Desconhecido"}</p>
          <div className="flex items-center gap-1.5 min-w-0">
            {operation && (
              <span className="flex items-center gap-1 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: operation.color }} />
                <span className="text-[12px] font-semibold truncate" style={{ color: operation.color }}>{operation.name}</span>
                <span className="text-tx3">·</span>
              </span>
            )}
            <p className="text-[12px] text-tx3 truncate">{customerPhone}</p>
          </div>
        </div>
        {(operation?.channel || operation?.name) && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl flex-shrink-0 mr-1" style={{ backgroundColor: (operation.color || "#3A5AF0") + "1f" }} title={`Atendendo pelo número ${operation.channel || operation.name}`}>
            <Smartphone className="w-4 h-4 flex-shrink-0" style={{ color: operation.color }} strokeWidth={2} />
            <div className="leading-tight min-w-0">
              <p className="text-[9px] uppercase tracking-wide text-tx3 font-bold">Atendendo por</p>
              <p className="text-[11px] font-bold truncate max-w-[140px]" style={{ color: operation.color }}>{operation.channel || operation.name}</p>
            </div>
          </div>
        )}
        <button onClick={handleOpenTagModal} className="p-2 hover:bg-hover rounded-full transition text-tx2 hover:text-accent" title="Etiquetar lead">
          <Tag className="w-[1.15rem] h-[1.15rem]" strokeWidth={1.9} />
        </button>
        <button onClick={toggleArchive} className="p-2 hover:bg-hover rounded-full transition text-tx2 hover:text-tx" title={archived ? "Desarquivar" : "Arquivar"}>
          {archived ? <ArchiveRestore className="w-[1.15rem] h-[1.15rem]" strokeWidth={1.9} /> : <Archive className="w-[1.15rem] h-[1.15rem]" strokeWidth={1.9} />}
        </button>
      </div>

      {/* Janela 24h */}
      {window24h && (
        <div className={`px-3 py-1.5 text-[11px] font-semibold text-center flex-shrink-0 ${window24h.open ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-b border-amber-500/20" : "bg-red-500/10 text-red-600 dark:text-red-400 border-b border-red-500/20"}`}>
          {window24h.open ? `Janela 24h · fecha em ${countdown}` : "Janela 24h fechada"}
        </div>
      )}

      <QuickLinksBar phoneNumberId={phoneNumberId} customerPhone={customerPhone} conversationId={conversation.id} customerName={customer?.name || customer?.phone || "Desconhecido"} />

      {/* Mensagens */}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-2 flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-[3px] border-bd border-t-accent rounded-full" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-accentsoft flex items-center justify-center mx-auto mb-3">
                <MessagesSquare className="w-7 h-7 text-accent" strokeWidth={1.6} />
              </div>
              <p className="text-tx3 text-sm">Nenhuma mensagem ainda</p>
            </div>
          </div>
        ) : (
          <div className="mt-auto py-2">
            <div className="flex justify-center mb-3">
              <span className="text-[11px] bg-surface2 text-tx3 px-3 py-1 rounded-full">Início da conversa</span>
            </div>
            {messages.map((msg, i) => {
              const prev = i > 0 ? messages[i - 1] : null;
              const consecutive = isConsecutive(prev, msg);
              const dateLabel = shouldShowDate(prev?.created_at || "", msg.created_at) ? formatDateHeader(new Date(msg.created_at)) : undefined;
              const quotedMsg = msg.metadata?.context?.id ? messages.find(m => m.metadata?.wa_message_id === msg.metadata?.context?.id) : null;
              const quotedContent = quotedMsg?.content || msg.metadata?.context?.quoted_content || null;
              const quotedByAgent = quotedMsg?.sender_type === "agent" || msg.metadata?.context?.quoted_sender_type === "agent";
              const quotedContentType = quotedMsg?.content_type || msg.metadata?.context?.quoted_content_type || "text";
              // URL real da mídia citada (mostra a miniatura da imagem certa)
              const qIsMedia = quotedContentType === "image" || quotedContentType === "sticker" || quotedContentType === "video";
              const quotedMediaUrl = qIsMedia && quotedMsg
                ? (quotedMsg.content?.startsWith("http") ? quotedMsg.content : `/api/media/${quotedMsg.id}`)
                : null;
              return (
                <MessageBubble key={msg.id} message={msg} isFirst={!consecutive} showDate={dateLabel} quotedContent={quotedContent} quotedByAgent={quotedByAgent} quotedContentType={quotedContentType} quotedMediaUrl={quotedMediaUrl} quotedMsgId={quotedMsg?.id || null} onScrollTo={scrollToMessage} domId={msg.id} onReply={() => setReplyTo(msg)} onReact={(emoji) => handleReact(msg, emoji)} />
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <ChatInput conversationId={conversation.id} phoneNumberId={phoneNumberId} customerPhone={customerPhone} onMessageSent={fetchMessages} onOptimisticSend={addOptimistic} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
      <FlowBar conversationId={conversation.id} phoneNumberId={phoneNumberId} customerPhone={customerPhone} />

      {showTagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowTagModal(false)}>
          <div className="w-full max-w-xs rounded-card border border-bd bg-surface shadow-pop p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-tx mb-3">Etiquetar lead</h3>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {crmTags.map((tag) => (
                <button key={tag.id} onClick={() => handleAddTag(tag.id)} className="w-full flex items-center gap-2 px-3 py-2 rounded-control hover:bg-hover transition text-left">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="text-sm text-tx2">{tag.name}</span>
                </button>
              ))}
              {!crmTags.length && <p className="text-xs text-tx3 text-center py-4">Nenhuma etiqueta. Crie no CRM.</p>}
            </div>
            <button onClick={() => setShowTagModal(false)} className="w-full mt-3 rounded-control border border-bd px-4 py-2 text-sm font-semibold text-tx2 hover:bg-hover transition">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
