import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface ChatInputProps {
  conversationId: string;
  onMessageSent: () => void;
}

export default function ChatInput({ conversationId, onMessageSent }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId]);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;

    setSending(true);
    const supabase = createClient();

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      content: trimmed,
      sender_type: "agent",
      content_type: "text",
    });

    if (error) {
      toast.error("Erro ao enviar mensagem");
      setSending(false);
      return;
    }

    await supabase
      .from("conversations")
      .update({
        last_message: trimmed,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    setMessage("");
    setSending(false);
    onMessageSent();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua mensagem..."
          className="flex-1 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none transition"
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || sending}
          className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed transition flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
