"use client";

import { useState } from "react";
import { MessagesSquare } from "lucide-react";
import ConversationList, { type Conversation } from "@/components/chat/ConversationList";
import ChatWindow from "@/components/chat/ChatWindow";

export default function ChatPageClient() {
  const [selected, setSelected] = useState<Conversation | null>(null);

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
