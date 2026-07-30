"use client";

import { useState } from "react";
import ConversationList, { type Conversation } from "@/components/chat/ConversationList";
import ChatWindow from "@/components/chat/ChatWindow";

export default function ChatPageClient() {
  const [selected, setSelected] = useState<Conversation | null>(null);

  return (
    <div className="-m-8 flex h-[calc(100vh-4rem)] overflow-x-hidden">
      <div className="w-[340px] flex-shrink-0 border-r border-gray-200 dark:border-[#222d34] overflow-hidden">
        <ConversationList selectedId={selected?.id || null} onSelect={setSelected} />
      </div>
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {selected ? (
          <ChatWindow conversation={selected} onClose={() => setSelected(null)} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#efeae2] dark:bg-[#0b141a]">
            <div className="text-center">
              <p className="text-4xl mb-2">💬</p>
              <p className="text-gray-500 dark:text-gray-400">Selecione uma conversa</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
