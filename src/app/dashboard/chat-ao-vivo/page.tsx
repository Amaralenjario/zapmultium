"use client";

import { useState, useEffect } from "react";
import { MessagesSquare } from "lucide-react";
import ConversationList, { type Conversation } from "@/components/chat/ConversationList";
import ChatWindow from "@/components/chat/ChatWindow";
import { createClient } from "@/lib/supabase/client";

const CONV_SELECT = "id, status, archived, last_message, last_message_at, last_message_sender, last_message_read, unread_count, created_at, metadata, customer:customer_id(name, phone, avatar_url)";

export default function ChatPageClient() {
  const [selected, setSelected] = useState<Conversation | null>(null);

  // Deep link vindo da notificação push: /dashboard/chat-ao-vivo?c=<conversationId>
  // abre direto a conversa do lead. (client.navigate no SW recarrega a rota → roda no mount.)
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("c");
    if (!c) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("conversations").select(CONV_SELECT).eq("id", c).single();
      if (!cancelled && data) setSelected(data as unknown as Conversation);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="absolute inset-0 flex overflow-hidden bg-bg">
      <div className={`${selected ? "hidden lg:block" : "w-full"} lg:w-[360px] flex-shrink-0 border-r border-bd`}>
        <ConversationList selectedId={selected?.id || null} onSelect={setSelected} />
      </div>

      {selected && (
        <div className={`${selected ? "fixed inset-0 z-30 lg:relative lg:flex-1 lg:min-w-0" : "hidden"}`}>
          <ChatWindow conversation={selected} onClose={() => setSelected(null)} />
        </div>
      )}

      {!selected && (
        <div className="hidden lg:flex flex-1 items-center justify-center bg-bg">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-accentsoft flex items-center justify-center mx-auto mb-4">
              <MessagesSquare className="w-8 h-8 text-accent" strokeWidth={1.8} />
            </div>
            <p className="text-tx font-bold">Selecione uma conversa</p>
            <p className="text-tx3 text-sm mt-1">Escolha um contato à esquerda para começar</p>
          </div>
        </div>
      )}
    </div>
  );
}
