"use client";

import { useState } from "react";
import ConversationList, { type Conversation } from "@/components/chat/ConversationList";
import ChatWindow from "@/components/chat/ChatWindow";

export default function ChatPageClient() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  return (
    <div className="-m-8 flex h-[calc(100vh)]">
      <div className="w-[380px] flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <ConversationList
          selectedId={selectedConversation?.id || null}
          onSelect={setSelectedConversation}
        />
      </div>

      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-950">
        {selectedConversation ? (
          <ChatWindow
            conversation={selectedConversation}
            onClose={() => setSelectedConversation(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-600/20 flex items-center justify-center">
                <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                Chat ao vivo
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Selecione uma conversa para começar
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
