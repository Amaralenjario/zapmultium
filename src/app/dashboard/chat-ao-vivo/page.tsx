"use client";

import { useState } from "react";
import ConversationList, { type Conversation } from "@/components/chat/ConversationList";
import ChatWindow from "@/components/chat/ChatWindow";

export default function ChatPageClient() {
  const [selected, setSelected] = useState<Conversation | null>(null);

  return (
    <div className="-m-8 flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - lista de conversas */}
        <div className={`${selected ? "hidden md:block md:w-[320px]" : "w-full md:w-[320px]"} flex-shrink-0 border-r border-gray-200 dark:border-[#222d34]`}>
          <ConversationList selectedId={selected?.id || null} onSelect={setSelected} />
        </div>

        {/* Chat area */}
        <div className={`${selected ? "flex-1" : "hidden"} md:flex md:flex-1 flex-col min-w-0`}>
          {selected ? (
            <ChatWindow conversation={selected} onClose={() => setSelected(null)} />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-[#efeae2] dark:bg-[#0b141a]">
              <p className="text-gray-400 dark:text-gray-500 text-sm">Selecione uma conversa</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
