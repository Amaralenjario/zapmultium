"use client";

import { useState } from "react";
import ConversationList, { type Conversation } from "@/components/chat/ConversationList";
import ChatWindow from "@/components/chat/ChatWindow";

export default function ChatPageClient() {
  const [selected, setSelected] = useState<Conversation | null>(null);

  return (
    <div className="h-full flex overflow-hidden">
      <div className={`${selected ? "hidden lg:block" : "w-full"} lg:w-[340px] flex-shrink-0 border-r border-gray-200 dark:border-[#222d34]`}>
        <ConversationList selectedId={selected?.id || null} onSelect={setSelected} />
      </div>

      {selected && (
        <div className={`${selected ? "fixed inset-0 z-30 lg:relative lg:flex-1 lg:min-w-0" : "hidden"}`}>
          <ChatWindow conversation={selected} onClose={() => setSelected(null)} />
        </div>
      )}

      {!selected && (
        <div className="hidden lg:flex flex-1 items-center justify-center bg-[#efeae2] dark:bg-[#0b141a]">
          <div className="text-center">
            <p className="text-4xl mb-2">💬</p>
            <p className="text-gray-500 dark:text-gray-400">Selecione uma conversa</p>
          </div>
        </div>
      )}
    </div>
  );
}
