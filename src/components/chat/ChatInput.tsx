"use client";

import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { Smile, Sticker, Zap, Paperclip, Send, X, Loader2, Mic } from "lucide-react";
import StickersPanel from "./StickersPanel";
import QuickMessagesPanel from "./QuickMessagesPanel";

interface ChatInputProps {
  conversationId: string;
  phoneNumberId?: string;
  customerPhone?: string;
  onMessageSent: () => void;
  replyTo?: { id: string; content: string; sender_type: string; metadata?: any } | null;
  onCancelReply?: () => void;
}

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB

export default function ChatInput({ conversationId, phoneNumberId, customerPhone, onMessageSent, replyTo, onCancelReply }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId]);

  // Auto-crescer a caixa de texto conforme o conteúdo (até um teto)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 128) + "px";
  }, [message]);

  const clearPending = () => {
    setPendingImage(null);
    setPendingPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
  };

  // Colar imagem (Ctrl+V) direto no campo → vira anexo com legenda
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        if (file.size > MAX_FILE_SIZE) { toast.error("Imagem muito grande. Máximo 16MB."); return; }
        setPendingImage(file);
        setPendingPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
        return;
      }
    }
  };

  // Limpa a URL de preview ao trocar de conversa / desmontar
  useEffect(() => {
    return () => { setPendingPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; }); };
  }, [conversationId]);

  const handleSend = async () => {
    // Se há uma imagem colada, envia ela com o texto como legenda
    if (pendingImage) {
      if (sending || uploading) return;
      if (!phoneNumberId || !customerPhone) {
        toast.error("Canal não configurado para envio");
        return;
      }
      const img = pendingImage;
      const cap = message.trim();
      clearPending();
      setMessage("");
      if (onCancelReply) onCancelReply();
      await uploadFile(img, cap);
      inputRef.current?.focus();
      return;
    }

    const trimmed = message.trim();
    if (!trimmed || sending) return;
    if (!phoneNumberId || !customerPhone) {
      toast.error("Canal não configurado para envio");
      return;
    }

    setMessage("");
    setSending(true);
    if (onCancelReply) onCancelReply();
    inputRef.current?.focus();

    try {
      const res = await fetch("/api/evohub/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, phoneNumberId, to: customerPhone, message: trimmed, context: (replyTo as any)?.metadata?.wa_message_id || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.detail
          ? `Erro: campos faltando (phoneId:${data.detail.hasPhoneId}, to:${data.detail.hasTo}, msg:${data.detail.hasMessage})`
          : (typeof data.error === "string" ? data.error : (data.error?.message || data.error?.error || "Erro ao enviar"));
        toast.error(msg);
      } else onMessageSent();
    } catch { toast.error("Erro de conexão"); }
    setSending(false);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. Máximo 16MB.");
      return;
    }
    if (!phoneNumberId || !customerPhone) {
      toast.error("Canal não configurado");
      return;
    }
    uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleQuickMessage = async (msg: { content_type: string; content: string; media_url: string; caption: string }) => {
    setShowQuickMessages(false);
    if (msg.content_type === "text") {
      setMessage(msg.content);
      inputRef.current?.focus();
      return;
    }
    if (!phoneNumberId || !customerPhone) {
      toast.error("Canal não configurado");
      return;
    }
    if (msg.content_type === "image") {
      sendMediaMessage(msg.media_url, "image", msg.caption || undefined);
    } else if (msg.content_type === "video") {
      sendMediaMessage(msg.media_url, "video");
    } else if (msg.content_type === "image_caption") {
      sendMediaMessage(msg.media_url, "image", msg.caption);
    }
  };

  const sendMediaMessage = async (url: string, type: "image" | "video", caption?: string) => {
    setSending(true);
    try {
      const res = await fetch("/api/evohub/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          phoneNumberId,
          to: customerPhone,
          message: url,
          type,
          caption,
        }),
      });
      if (res.ok) onMessageSent();
      else toast.error("Erro ao enviar");
    } catch { toast.error("Erro"); }
    setSending(false);
  };

  const uploadFile = async (file: File, caption?: string) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("conversation_id", conversationId);
      formData.append("phone_number_id", phoneNumberId!);
      formData.append("customer_phone", customerPhone!);
      if (caption && caption.trim()) formData.append("caption", caption.trim());

      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      });

      await new Promise<void>((resolve, reject) => {
        xhr.open("POST", "/api/evohub/send-media");
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(xhr.responseText));
        };
        xhr.onerror = () => reject(new Error("Erro de conexão"));
        xhr.send(formData);
      });

      onMessageSent();
    } catch {
      toast.error("Erro ao enviar arquivo");
    }
    setUploading(false);
    setUploadProgress(0);
  };

  const iconBtn = "p-2 rounded-full transition text-tx2 hover:bg-hover hover:text-tx";

  return (
    <div className="flex-shrink-0">
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-surface2 border-t border-bd">
          <div className="flex-1 min-w-0 border-l-[3px] border-accent pl-2.5">
            <p className="text-[11px] font-bold text-accent">{replyTo.sender_type === "agent" ? "Você" : "Cliente"}</p>
            <p className="text-xs text-tx2 truncate">{replyTo.content}</p>
          </div>
          <button onClick={onCancelReply} className="p-1 text-tx3 hover:text-tx">
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>
      )}
      {pendingImage && pendingPreview && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-surface2 border-t border-bd">
          <div className="relative flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pendingPreview} alt="" className="w-14 h-14 rounded-lg object-cover border border-bd" />
            <button onClick={clearPending} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-tx text-bg flex items-center justify-center shadow" title="Remover imagem">
              <X className="w-3 h-3" strokeWidth={2.5} />
            </button>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-tx">Imagem pronta para enviar</p>
            <p className="text-[11px] text-tx3">Escreva uma legenda abaixo (opcional) e aperte enviar</p>
          </div>
        </div>
      )}
      <div className="px-4 py-2.5 bg-surface border-t border-bd flex items-center gap-1.5 relative">
        {uploading && (
          <div className="absolute bottom-full left-0 right-0 px-4">
            <div className="h-1 bg-track rounded-full overflow-hidden">
              <div className="h-full bg-accent transition-all duration-200 rounded-full" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-[10px] text-tx3 text-center mt-0.5">Enviando arquivo...</p>
          </div>
        )}
        <div className="relative">
          <button onClick={() => { setShowEmoji(!showEmoji); setShowStickers(false); }} className={`${iconBtn} ${showEmoji ? "text-accent bg-accentsoft" : ""}`} title="Emoji">
            <Smile className="w-[1.35rem] h-[1.35rem]" strokeWidth={1.8} />
          </button>
          {showEmoji && (
            <div className="absolute bottom-full left-0 mb-2 z-50" onClick={(e) => e.stopPropagation()}>
              <EmojiPicker onEmojiClick={handleEmojiSelect} lazyLoadEmojis />
            </div>
          )}
        </div>

        <div className="relative">
          <button onClick={() => { setShowStickers(!showStickers); setShowEmoji(false); }} className={`${iconBtn} ${showStickers ? "text-accent bg-accentsoft" : ""}`} title="Figurinhas">
            <Sticker className="w-[1.35rem] h-[1.35rem]" strokeWidth={1.8} />
          </button>
          {showStickers && <StickersPanel onSelect={handleStickerSelect} onClose={() => setShowStickers(false)} />}
        </div>

        <div className="relative">
          <button onClick={() => { setShowQuickMessages(!showQuickMessages); setShowEmoji(false); setShowStickers(false); }} className={`${iconBtn} ${showQuickMessages ? "text-accent bg-accentsoft" : ""}`} title="Mensagens rápidas">
            <Zap className="w-[1.35rem] h-[1.35rem]" strokeWidth={1.8} />
          </button>
          {showQuickMessages && (
            <QuickMessagesPanel onSelect={handleQuickMessage} onClose={() => setShowQuickMessages(false)} />
          )}
        </div>

        <div className="flex-1 flex items-end bg-surface2 border border-bd rounded-2xl focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition">
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={pendingImage ? "Adicione uma legenda..." : "Digite uma mensagem"}
            disabled={!phoneNumberId || (uploading && !pendingImage)}
            rows={1}
            className="flex-1 bg-transparent px-4 py-2.5 text-[15px] text-tx placeholder:text-tx3 focus:outline-none disabled:opacity-50 resize-none max-h-32 leading-relaxed"
          />
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!phoneNumberId || uploading}
            title="Enviar imagem, vídeo ou documento"
            className={`p-2 mr-1 rounded-full transition ${uploading ? "text-accent" : "text-tx3 hover:text-accent"} disabled:opacity-40`}
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} /> : <Paperclip className="w-5 h-5" strokeWidth={1.9} />}
          </button>
        </div>
        {(message.trim() || pendingImage) ? (
          <button
            onClick={handleSend}
            disabled={sending || uploading}
            className="p-2.5 rounded-full bg-accent text-white shadow-glow hover:bg-accent2 transition disabled:opacity-50"
            title="Enviar"
          >
            <Send className="w-5 h-5" strokeWidth={1.9} />
          </button>
        ) : (
          <button className={`${iconBtn} cursor-default`} title="Áudio">
            <Mic className="w-[1.35rem] h-[1.35rem]" strokeWidth={1.8} />
          </button>
        )}
      </div>

      {showEmoji && <div className="fixed inset-0 z-40" onClick={() => setShowEmoji(false)} />}
      {showStickers && <div className="fixed inset-0 z-40" onClick={() => setShowStickers(false)} />}
    </div>
  );
}
