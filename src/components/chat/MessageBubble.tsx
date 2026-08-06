"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
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
}: {
  message: Message;
  isFirst?: boolean;
  showDate?: string;
  quotedContent?: string | null;
  quotedByAgent?: boolean;
  quotedContentType?: string;
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

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <span className="text-xs bg-[#e1f3fb] dark:bg-gray-800 text-[#54656f] dark:text-gray-400 px-3 py-1 rounded-lg shadow-sm">{message.content}</span>
      </div>
    );
  }

  return (
    <>
      {showDate && (
        <div className="flex justify-center my-3">
          <span className="text-[11px] bg-white/90 dark:bg-gray-800/90 text-[#54656f] dark:text-gray-400 px-3 py-1 rounded-lg shadow-sm">{showDate}</span>
        </div>
      )}
      <div className={`flex ${isAgent ? "justify-end" : "justify-start"} group ${isFirst !== false ? "mt-2" : "mt-0.5"}`}>
        <div className={`relative text-sm leading-[1.4] ${isFirst === false ? (isAgent ? "rounded-tr-sm" : "rounded-tl-sm") : ""} ${isAgent ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-gray-100 rounded-t-lg rounded-l-lg" : "bg-white dark:bg-[#202c33] text-[#111b21] dark:text-gray-100 rounded-t-lg rounded-r-lg"} shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]`} style={{ maxWidth: "min(65%, 500px)" }}>
          {/* Quoted message */}
          {(context?.id || quotedContent) && (
            <div className={`mx-2 mt-2 px-2.5 py-1.5 rounded-md border-l-[3px] text-xs ${isAgent ? "bg-black/10 border-[#075e54]" : "bg-black/5 dark:bg-white/5 border-[#25d366]"}`}>
              <p className="text-[11px] opacity-60 mb-0.5 truncate">{quotedByAgent ? "Você" : (context?.from || "Cliente")}</p>
              {quotedContentType === "image" || quotedContentType === "sticker" ? (
                <div className="flex items-center gap-1.5">
                  <img src={quotedContent!} alt="" className="w-8 h-8 rounded object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <span className="opacity-80">📷 Imagem</span>
                </div>
              ) : quotedContentType === "video" ? (
                <span className="opacity-80">🎬 Vídeo</span>
              ) : (
                <p className="truncate opacity-80">{quotedContent || "Mensagem"}</p>
              )}
            </div>
          )}
          {isMedia ? (
            <MediaContent messageId={message.id} content={message.content} type={message.content_type} metadata={message.metadata} />
          ) : (
            <p className="whitespace-pre-wrap break-all px-3.5 pt-2 pb-1.5 overflow-hidden">{message.content}</p>
          )}
          <span className="inline-flex items-center gap-1 float-right mr-2 mb-1.5 text-[11px] text-[#667781] dark:text-gray-400">
            {format(new Date(message.created_at), "HH:mm")}
            {isAgent && (
              <svg className={`w-3.5 h-3.5 ${message.read_at ? "text-[#53bdeb]" : "text-[#8696a0]"}`} fill="currentColor" viewBox="0 0 16 11">
                <path d="M11.071.653a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 00-.336-.153.508.508 0 00-.432.246.458.458 0 00.058.515l2.326 2.424a.56.56 0 00.416.21.55.55 0 00.427-.208l6.502-8.022a.466.466 0 00.078-.493.458.458 0 00-.153-.136Z" />
                {message.read_at && <path d="M14.071.653a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 00-.336-.153.508.508 0 00-.432.246.458.458 0 00.058.515l2.326 2.424a.56.56 0 00.416.21.55.55 0 00.427-.208l6.502-8.022a.466.466 0 00.078-.493.458.458 0 00-.153-.136Z" transform="translate(3,0)" />}
              </svg>
            )}
          </span>
          {/* Reply button on hover */}
          <div className={`absolute ${isAgent ? "-left-8" : "-right-8"} top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition`}>
            {onReply && (
              <button onClick={onReply} className="w-6 h-6 rounded-full bg-gray-400 dark:bg-gray-600 text-white flex items-center justify-center shadow text-[10px] hover:bg-gray-500" title="Responder">↩</button>
            )}
            {onReact && (
              <div className="relative">
                <button onClick={() => setShowPicker(!showPicker)} className="w-6 h-6 rounded-full bg-gray-400 dark:bg-gray-600 text-white flex items-center justify-center shadow text-[13px] hover:bg-gray-500" title="Reagir">😊</button>
                {showPicker && <EmojiPicker onSelect={(e) => { onReact(e); setShowPicker(false); }} onClose={() => setShowPicker(false)} />}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Reactions */}
      {reactionList.length > 0 && (
        <div className={`flex ${isAgent ? "justify-end" : "justify-start"} -mt-1 relative z-10`}>
          <div className={`inline-flex gap-0.5 bg-white dark:bg-gray-800 rounded-full px-2 py-0.5 shadow-sm border border-gray-200 dark:border-gray-700 ${isAgent ? "mr-0" : "ml-0"}`}>
            {reactionList.map(([user, emoji]) => (
              <span key={user} className="text-sm leading-none" title={user}>{emoji}</span>
            ))}
            <span className="text-[10px] text-gray-400 ml-0.5">{reactionList.length}</span>
          </div>
        </div>
      )}
    </>
  );
}

function MediaContent({ messageId, content, type, metadata }: { messageId: string; content: string; type: string; metadata?: any }) {
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [zoom, setZoom] = useState(1);
  const isFlow = metadata?.source === "flow";
  const isDirectUrl = content.startsWith("http");
  const mediaUrl = isFlow && isDirectUrl ? content : (isDirectUrl && !isFlow ? content : `/api/media/${messageId}`);

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

  if (error) return <p className="px-3.5 py-2 text-gray-500 dark:text-gray-400 text-sm">{content}</p>;

  if (type === "sticker") return <div className="p-1 relative group/sticker"><img src={mediaUrl} alt="" className="rounded-lg max-w-[140px] max-h-[140px] object-contain cursor-pointer" loading="lazy" onError={() => setError(true)} onClick={openLightbox} /><button onClick={() => handleSaveSticker(messageId)} className="absolute top-1 right-1 opacity-0 group-hover/sticker:opacity-100 transition bg-gray-800/70 text-white text-[10px] px-1.5 py-0.5 rounded hover:bg-gray-800">{saving ? "..." : "Salvar"}</button></div>;
  if (type === "image") return (
    <>
      <div className="p-1"><img src={mediaUrl} alt="" className="rounded-lg max-w-[300px] max-h-[300px] object-cover cursor-pointer hover:opacity-90 transition" loading="lazy" onError={() => setError(true)} onClick={openLightbox} /></div>
      {metadata?.caption && <p className="px-3.5 pb-2 text-[13px] text-[#667781] dark:text-gray-400">{metadata.caption}</p>}
      {lightbox && <ImageViewer src={mediaUrl} zoom={zoom} setZoom={setZoom} onClose={closeLightbox} />}
    </>
  );
  if (type === "video") return (
    <div className="p-1">
      <video controls className="rounded-lg max-w-[300px] max-h-[300px]" preload="metadata"><source src={mediaUrl} /></video>
      {metadata?.caption && <p className="px-3.5 pb-2 text-[13px] text-[#667781] dark:text-gray-400">{metadata.caption}</p>}
    </div>
  );
  if (type === "audio") return <AudioPlayer src={mediaUrl} />;
  if (type === "document") return <DocumentPreview src={mediaUrl} name={content} />;
  return null;
}

function ImageViewer({ src, zoom, setZoom, onClose }: { src: string; zoom: number; setZoom: (z: number) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center" onClick={onClose}>
      <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
        <button onClick={() => setZoom(Math.min(3, zoom + 0.5))} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition" title="Aumentar zoom">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </button>
        <button onClick={() => setZoom(Math.max(0.5, zoom - 0.5))} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition" title="Diminuir zoom">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
        </button>
        <span className="text-white text-xs">{Math.round(zoom * 100)}%</span>
        <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition" title="Fechar">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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
