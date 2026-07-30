"use client";

import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";

interface ChatInputProps {
  conversationId: string;
  phoneNumberId?: string;
  customerPhone?: string;
  onMessageSent: () => void;
}

export default function ChatInput({ conversationId, phoneNumberId, customerPhone, onMessageSent }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId]);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    if (!phoneNumberId || !customerPhone) {
      toast.error("Canal não configurado para envio");
      return;
    }

    setSending(true);

    try {
      const res = await fetch("/api/evohub/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          phoneNumberId,
          to: customerPhone,
          message: trimmed,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.error_data?.details || data.error?.message || "Erro ao enviar");
        setSending(false);
        return;
      }

      setMessage("");
      setSending(false);
      onMessageSent();
    } catch {
      toast.error("Erro de conexão");
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua mensagem..."
          disabled={!phoneNumberId}
          className="flex-1 rounded-full border-0 bg-white dark:bg-gray-800 px-5 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-1 focus:ring-[#075e54] focus:outline-none transition disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || sending || !phoneNumberId}
          className="w-10 h-10 rounded-full bg-[#075e54] text-white flex items-center justify-center hover:bg-[#064e46] disabled:opacity-40 disabled:cursor-not-allowed transition flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
