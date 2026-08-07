"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { Reply, Smile, CheckCheck, Plus, Minus, X, AlertTriangle } from "lucide-react";
import AudioPlayer from "./AudioPlayer";
import DocumentPreview from "./DocumentPreview";
import EmojiPicker from "./EmojiPicker";
import toast from "react-hot-toast";

interface Message {
  id: string;
  content: string;
  sender_type: "customer" | "agent" | "system" | "bot";
  content_type: string;
  created_at: string;
  read_at?: string | null;
  metadata?: any;
}

export function formatDateHeader(date: Date) {
  const now = new Date();
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = todayDate.getTime() - msgDate.getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

export function shouldShowDate(prev: string, curr: string) {
  if (!prev) return true;
  return new Date(prev).toDateString() !== new Date(curr).toDateString();
}

export function isConsecutive(prev: { sender_type: string; created_at: string } | null, curr: { sender_type: string; created_at: string }) {
  if (!prev) return false;
  if (prev.sender_type !== curr.sender_type) return false;
  const diff = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime();
  return diff < 60000;
}

export default function MessageBubble({
  message,
  isFirst,
  showDate,
  quotedContent,
  quotedByAgent,
  onReply,
  onReact,
  quotedContentType,
  quotedMediaUrl,
  quotedMsgId,
  onScrollTo,
  domId,
}: {
  message: Message;
  isFirst?: boolean;
  showDate?: string;
  quotedContent?: string | null;
  quotedByAgent?: boolean;
  quotedContentType?: string;
  quotedMediaUrl?: string | null;
  quotedMsgId?: string | null;
  onScrollTo?: (id: string) => void;
  domId?: string;
  onReply?: () => void;
  onReact?: (emoji: string) => void;
}) {
  const isAgent = message.sender_type === "agent";
  const isSystem = message.sender_type === "system" || message.sender_type === "bot";
  const isMedia = message.content_type === "image" || message.content_type === "video" || message.content_type === "audio" || message.content_type === "document" || message.content_type === "sticker";
  const context = message.metadata?.context;
  const reactions = message.metadata?.reactions || {};
  const reactionList = Object.entries(reactions) as [string, string][];
  const [showPicker, setShowPicker] = useState(false);
  const sendError: string | undefined = isAgent ? (message.metadata?.error as string | undefined) : undefined;
  const isRead = !!message.read_at;
  const quoteIsMedia = quotedContentType === "image" || quotedContentType === "sticker" || quotedContentType === "video";

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <span className="text-xs bg-surface2 text-tx2 px-3 py-1 rounded-full">{message.content}</span>
      </div>
    );
  }

  const cornerClass = isFirst === false
    ? (isAgent ? "rounded-2xl rounded-tr-md" : "rounded-2xl rounded-tl-md")
    : "rounded-2xl";
  const bubbleTheme = isAgent
    ? "bg-accent text-white"
    : "bg-surface text-tx border border-bd";
  const metaColor = isAgent ? "text-white/70" : "text-tx3";

  return (
    <>
      {showDate && (
        <div className="flex justify-center my-3">
          <span className="text-[11px] bg-surface2 text-tx2 px-3 py-1 rounded-full">{showDate}</span>
        </div>
      )}
      <div data-message-id={domId} className={`flex ${isAgent ? "justify-end" : "justify-start"} group ${isFirst !== false ? "mt-2" : "mt-0.5"}`}>
        <div className={`relative text-sm leading-[1.45] shadow-card ${cornerClass} ${bubbleTheme}`} style={{ maxWidth: "min(70%, 520px)" }}>
          {/* Mensagem citada (clicável → rola até a original) */}
          {(context?.id || quotedContent) && (
            <button
              type="button"
              onClick={() => quotedMsgId && onScrollTo?.(quotedMsgId)}
              className={`flex items-stretch gap-2 mx-2 mt-2 rounded-lg border-l-[3px] text-xs overflow-hidden text-left transition w-[calc(100%-1rem)] ${isAgent ? "bg-black/15 border-white/60 hover:bg-black/25" : "bg-surface2 border-accent hover:bg-hover"} ${quotedMsgId ? "cursor-pointer" : "cursor-default"}`}
            >
              <div className="flex-1 min-w-0 px-2.5 py-1.5">
                <p className="text-[11px] opacity-70 mb-0.5 truncate font-semibold">{quotedByAgent ? "Você" : (context?.from || "Cliente")}</p>
                {quoteIsMedia ? (
                  <span className="opacity-80">{quotedContentType === "video" ? "🎬 Vídeo" : "📷 Imagem"}</span>
                ) : (
                  <p className="truncate opacity-80">{quotedContent || "Mensagem"}</p>
                )}
              </div>
              {quoteIsMedia && quotedMediaUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={quotedMediaUrl} alt="" className="w-12 h-12 object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
            </button>
          )}
          {isMedia ? (
            <MediaContent messageId={message.id} content={message.content} type={message.content_type} metadata={message.metadata} isAgent={isAgent} />
          ) : (
            <p className="whitespace-pre-wrap break-words px-3.5 pt-2 pb-1.5 overflow-hidden">{message.content}</p>
          )}
          <span className={`inline-flex items-center gap-1 float-right mr-2.5 mb-1.5 text-[11px] ${metaColor}`}>
            {format(new Date(message.created_at), "HH:mm")}
            {isAgent && (
              sendError ? (
                <AlertTriangle className="w-3.5 h-3.5 text-red-200" strokeWidth={2.2} />
              ) : (
                <CheckCheck className={`w-3.5 h-3.5 ${isRead ? "text-sky-300" : "text-white/45"}`} strokeWidth={2.2} />
              )
            )}
          </span>
          {/* Ações no hover */}
          <div className={`absolute ${isAgent ? "-left-9" : "-right-9"} top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition`}>
            {onReply && (
              <button onClick={onReply} className="w-7 h-7 rounded-full bg-surface border border-bd text-tx2 flex items-center justify-center shadow-card hover:text-accent hover:border-accent transition" title="Responder">
                <Reply className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            )}
            {onReact && (
              <div className="relative">
                <button onClick={() => setShowPicker(!showPicker)} className="w-7 h-7 rounded-full bg-surface border border-bd text-tx2 flex items-center justify-center shadow-card hover:text-accent hover:border-accent transition" title="Reagir">
                  <Smile className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
                {showPicker && <EmojiPicker onSelect={(e) => { onReact(e); setShowPicker(false); }} onClose={() => setShowPicker(false)} />}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Erro de envio (janela 24h, etc.) */}
      {sendError && (
        <div className="flex justify-end mt-0.5">
          <div className="flex items-start gap-1 text-[11px] text-red-500 dark:text-red-400 max-w-[75%]">
            <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-[1px]" strokeWidth={2} />
            <span className="leading-snug">{sendError}</span>
          </div>
        </div>
      )}
      {/* Reações */}
      {reactionList.length > 0 && (
        <div className={`flex ${isAgent ? "justify-end" : "justify-start"} -mt-1 relative z-10`}>
          <div className="inline-flex gap-0.5 bg-surface rounded-full px-2 py-0.5 shadow-card border border-bd">
            {reactionList.map(([user, emoji]) => (
              <span key={user} className="text-sm leading-none" title={user}>{emoji}</span>
            ))}
            <span className="text-[10px] text-tx3 ml-0.5">{reactionList.length}</span>
          </div>
        </div>
      )}
    </>
  );
}

function MediaContent({ messageId, content, type, metadata, isAgent }: { messageId: string; content: string; type: string; metadata?: any; isAgent?: boolean }) {
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [zoom, setZoom] = useState(1);
  const isFlow = metadata?.source === "flow";
  const isDirectUrl = content.startsWith("http");
  const mediaUrl = isFlow && isDirectUrl ? content : (isDirectUrl && !isFlow ? content : `/api/media/${messageId}`);
  const captionColor = isAgent ? "text-white/80" : "text-tx3";

  const handleSaveSticker = async (msgId: string) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/stickers/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: msgId }) });
      if (res.ok) toast.success("Figurinha salva!");
      else toast.error("Erro ao salvar");
    } catch { toast.error("Erro"); }
    setSaving(false);
  };

  const openLightbox = () => { setLightbox(true); setZoom(1); };
  const closeLightbox = () => setLightbox(false);

  if (error) return <p className={`px-3.5 py-2 text-sm ${isAgent ? "text-white/80" : "text-tx3"}`}>{content}</p>;

  if (type === "sticker") return <div className="p-1 relative group/sticker"><img src={mediaUrl} alt="" className="rounded-lg max-w-[140px] max-h-[140px] object-contain cursor-pointer" loading="lazy" onError={() => setError(true)} onClick={openLightbox} /><button onClick={() => handleSaveSticker(messageId)} className="absolute top-1 right-1 opacity-0 group-hover/sticker:opacity-100 transition bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded hover:bg-black">{saving ? "..." : "Salvar"}</button></div>;
  if (type === "image") return (
    <>
      <div className="p-1"><img src={mediaUrl} alt="" className="rounded-xl max-w-[300px] max-h-[300px] object-cover cursor-pointer hover:opacity-90 transition" loading="lazy" onError={() => setError(true)} onClick={openLightbox} /></div>
      {metadata?.caption && <p className={`px-3.5 pb-2 text-[13px] ${captionColor}`}>{metadata.caption}</p>}
      {lightbox && <ImageViewer src={mediaUrl} zoom={zoom} setZoom={setZoom} onClose={closeLightbox} />}
    </>
  );
  if (type === "video") return (
    <div className="p-1">
      <video controls className="rounded-xl max-w-[300px] max-h-[300px]" preload="metadata"><source src={mediaUrl} /></video>
      {metadata?.caption && <p className={`px-3.5 pb-2 text-[13px] ${captionColor}`}>{metadata.caption}</p>}
    </div>
  );
  if (type === "audio") return <AudioPlayer src={mediaUrl} onAccent={isAgent} />;
  if (type === "document") return <DocumentPreview src={mediaUrl} name={content} />;
  return null;
}

function ImageViewer({ src, zoom, setZoom, onClose }: { src: string; zoom: number; setZoom: (z: number) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center" onClick={onClose}>
      <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
        <button onClick={() => setZoom(Math.min(3, zoom + 0.5))} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition" title="Aumentar zoom">
          <Plus className="w-5 h-5" strokeWidth={2} />
        </button>
        <button onClick={() => setZoom(Math.max(0.5, zoom - 0.5))} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition" title="Diminuir zoom">
          <Minus className="w-5 h-5" strokeWidth={2} />
        </button>
        <span className="text-white text-xs">{Math.round(zoom * 100)}%</span>
        <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition" title="Fechar">
          <X className="w-5 h-5" strokeWidth={2} />
        </button>
      </div>
      <img
        src={src}
        alt=""
        className="max-w-[95vw] max-h-[95vh] object-contain transition-transform duration-200"
        style={{ transform: `scale(${zoom})`, cursor: zoom > 1 ? "grab" : "default" }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
