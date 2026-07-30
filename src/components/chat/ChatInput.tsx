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
        body: JSON.stringify({ conversationId, phoneNumberId, to: customerPhone, message: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.error_data?.details || "Erro ao enviar");
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
    <div className="px-4 py-2 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center gap-2 flex-shrink-0">
      <button className="p-2 text-[#54656f] dark:text-[#8696a0] hover:text-[#00a884] rounded-full hover:bg-white/50 dark:hover:bg-white/5 transition">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
        </svg>
      </button>
      <button className="p-2 text-[#54656f] dark:text-[#8696a0] hover:text-[#00a884] rounded-full hover:bg-white/50 dark:hover:bg-white/5 transition">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-5.7l-2.838 2.838" />
        </svg>
      </button>
      <div className="flex-1 flex items-center bg-white dark:bg-[#2a3942] rounded-lg">
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem"
          disabled={!phoneNumberId}
          className="flex-1 bg-transparent px-4 py-2.5 text-[15px] text-[#111b21] dark:text-[#e9edef] placeholder:text-[#667781] dark:placeholder:text-[#8696a0] focus:outline-none disabled:opacity-50"
        />
      </div>
      {message.trim() ? (
        <button
          onClick={handleSend}
          disabled={sending}
          className="p-2 text-[#54656f] dark:text-[#8696a0] hover:text-[#00a884] rounded-full hover:bg-white/50 dark:hover:bg-white/5 transition"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      ) : (
        <button className="p-2 text-[#54656f] dark:text-[#8696a0] rounded-full hover:bg-white/50 dark:hover:bg-white/5 transition">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        </button>
      )}
    </div>
  );
}
