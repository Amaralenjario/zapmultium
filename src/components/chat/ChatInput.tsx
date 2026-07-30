"use client";

import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import StickersPanel from "./StickersPanel";

interface ChatInputProps {
  conversationId: string;
  phoneNumberId?: string;
  customerPhone?: string;
  onMessageSent: () => void;
  replyTo?: { id: string; content: string; sender_type: string; metadata?: any } | null;
  onCancelReply?: () => void;
}

export default function ChatInput({ conversationId, phoneNumberId, customerPhone, onMessageSent, replyTo, onCancelReply }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
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
        body: JSON.stringify({ conversationId, phoneNumberId, to: customerPhone, message: trimmed, context: (replyTo as any)?.metadata?.wa_message_id || undefined }),
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

  const handleEmojiSelect = (emoji: EmojiClickData) => {
    setMessage((prev) => prev + emoji.emoji);
    inputRef.current?.focus();
  };

  const handleStickerSelect = async (url: string) => {
    if (!phoneNumberId || !customerPhone) {
      toast.error("Canal não configurado");
      return;
    }
    setSending(true);
    try {
      // Use send message API with sticker URL (sending as image with link)
      const res = await fetch("/api/evohub/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          phoneNumberId,
          to: customerPhone,
          message: url,
          type: "sticker",
        }),
      });
      if (!res.ok) toast.error("Erro ao enviar figurinha");
      else onMessageSent();
    } catch { toast.error("Erro"); }
    setSending(false);
  };

  return (
    <div className="flex-shrink-0">
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#e3f0e3] dark:bg-[#1c3730] border-t border-gray-200 dark:border-gray-800">
          <div className="flex-1 min-w-0 border-l-[3px] border-[#075e54] pl-2.5">
            <p className="text-[11px] font-medium text-[#075e54]">{replyTo.sender_type === "agent" ? "Você" : "Cliente"}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{replyTo.content}</p>
          </div>
          <button onClick={onCancelReply} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
      <div className="px-4 py-2 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center gap-2">
        <div className="relative">
          <button onClick={() => { setShowEmoji(!showEmoji); setShowStickers(false); }} className={`p-2 rounded-full hover:bg-white/50 dark:hover:bg-white/5 transition ${showEmoji ? "text-[#f59e0b] bg-white/50" : "text-[#54656f] dark:text-[#8696a0]"}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
            </svg>
          </button>
          {showEmoji && (
            <div className="absolute bottom-full left-0 mb-2 z-50" onClick={(e) => e.stopPropagation()}>
              <EmojiPicker onEmojiClick={handleEmojiSelect} lazyLoadEmojis />
            </div>
          )}
        </div>

        <div className="relative">
          <button onClick={() => { setShowStickers(!showStickers); setShowEmoji(false); }} className={`p-2 rounded-full hover:bg-white/50 dark:hover:bg-white/5 transition ${showStickers ? "text-[#25d366] bg-white/50" : "text-[#54656f] dark:text-[#8696a0]"}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
          </button>
          {showStickers && <StickersPanel onSelect={handleStickerSelect} onClose={() => setShowStickers(false)} />}
        </div>

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

      {showEmoji && <div className="fixed inset-0 z-40" onClick={() => setShowEmoji(false)} />}
      {showStickers && <div className="fixed inset-0 z-40" onClick={() => setShowStickers(false)} />}
    </div>
  );
}
