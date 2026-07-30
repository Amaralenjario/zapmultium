"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import AudioPlayer from "./AudioPlayer";
import DocumentPreview from "./DocumentPreview";
import EmojiPicker from "./EmojiPicker";

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
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
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
}: {
  message: Message;
  isFirst?: boolean;
  showDate?: string;
  quotedContent?: string | null;
  quotedByAgent?: boolean;
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
        <div className={`relative max-w-[65%] text-sm leading-[1.4] ${isFirst === false ? (isAgent ? "rounded-tr-sm" : "rounded-tl-sm") : ""} ${isAgent ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-gray-100 rounded-t-lg rounded-l-lg" : "bg-white dark:bg-[#202c33] text-[#111b21] dark:text-gray-100 rounded-t-lg rounded-r-lg"} shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]`}>
          {/* Quoted message */}
          {(context?.id || quotedContent) && (
            <div className={`mx-2 mt-2 px-2.5 py-1.5 rounded-md border-l-[3px] text-xs ${isAgent ? "bg-black/10 border-[#075e54]" : "bg-black/5 dark:bg-white/5 border-[#25d366]"}`}>
              <p className="text-[11px] opacity-60 mb-0.5 truncate">{quotedByAgent ? "Você" : (context?.from || "Cliente")}</p>
              <p className="truncate opacity-80">{quotedContent || "Mensagem"}</p>
            </div>
          )}
          {isMedia ? (
            <MediaContent messageId={message.id} content={message.content} type={message.content_type} />
          ) : (
            <p className="whitespace-pre-wrap break-words px-3.5 pt-2 pb-1.5">{message.content}</p>
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
        <div className={`flex ${isAgent ? "justify-end" : "justify-start"} -mt-1`}>
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

function MediaContent({ messageId, content, type }: { messageId: string; content: string; type: string }) {
  const [error, setError] = useState(false);
  const mediaUrl = `/api/media/${messageId}`;

  if (error) return <p className="px-3.5 py-2 text-gray-500 dark:text-gray-400 text-sm">{content}</p>;

  if (type === "sticker") return <div className="p-1"><img src={mediaUrl} alt="" className="rounded-lg max-w-[140px] max-h-[140px] object-contain" loading="lazy" onError={() => setError(true)} /></div>;
  if (type === "image") return <div className="p-1"><img src={mediaUrl} alt="" className="rounded-lg max-w-[300px] max-h-[300px] object-cover" loading="lazy" onError={() => setError(true)} /></div>;
  if (type === "video") return <div className="p-1"><video controls className="rounded-lg max-w-[300px] max-h-[300px]" preload="metadata"><source src={mediaUrl} /></video></div>;
  if (type === "audio") return <AudioPlayer src={mediaUrl} />;
  if (type === "document") return <DocumentPreview src={mediaUrl} name={content} />;
  return null;
}
