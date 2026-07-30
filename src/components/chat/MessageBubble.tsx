"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";

interface Message {
  id: string;
  content: string;
  sender_type: "customer" | "agent" | "system" | "bot";
  content_type: string;
  created_at: string;
  read_at?: string | null;
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
}: {
  message: Message;
  isFirst?: boolean;
  showDate?: string;
}) {
  const isAgent = message.sender_type === "agent";
  const isSystem = message.sender_type === "system" || message.sender_type === "bot";
  const isMedia = message.content_type === "image" || message.content_type === "video" || message.content_type === "audio" || message.content_type === "document" || message.content_type === "sticker";

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <span className="text-xs bg-[#e1f3fb] dark:bg-gray-800 text-[#54656f] dark:text-gray-400 px-3 py-1 rounded-lg shadow-sm">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <>
      {showDate && (
        <div className="flex justify-center my-3">
          <span className="text-[11px] bg-white/90 dark:bg-gray-800/90 text-[#54656f] dark:text-gray-400 px-3 py-1 rounded-lg shadow-sm">
            {showDate}
          </span>
        </div>
      )}
      <div className={`flex ${isAgent ? "justify-end" : "justify-start"} ${isFirst !== false ? "mt-2" : "mt-0.5"}`}>
        <div
          className={`relative max-w-[65%] text-sm leading-[1.4] ${
            isFirst === false ? (isAgent ? "rounded-tr-sm" : "rounded-tl-sm") : ""
          } ${
            isAgent
              ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-gray-100 rounded-t-lg rounded-l-lg"
              : "bg-white dark:bg-[#202c33] text-[#111b21] dark:text-gray-100 rounded-t-lg rounded-r-lg"
          } shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]`}
        >
          {isMedia ? (
            <MediaContent messageId={message.id} content={message.content} type={message.content_type} />
          ) : (
            <p className="whitespace-pre-wrap break-words px-3.5 pt-2 pb-1.5">{message.content}</p>
          )}
          <span className="inline-flex items-center gap-1 float-right mr-2 mb-1.5 text-[11px] text-[#667781] dark:text-gray-400">
            {format(new Date(message.created_at), "HH:mm")}
            {isAgent && (
              <svg className={`w-3.5 h-3.5 ${message.read_at ? "text-[#53bdeb]" : "text-[#8696a0]"}`} fill="currentColor" viewBox="0 0 16 11">
                <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 0 0-.336-.153.508.508 0 0 0-.432.246.458.458 0 0 0 .058.515l2.326 2.424a.56.56 0 0 0 .416.21.55.55 0 0 0 .427-.208l6.502-8.022a.466.466 0 0 0 .078-.493.458.458 0 0 0-.153-.136Z" />
                {message.read_at && <path d="M14.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 0 0-.336-.153.508.508 0 0 0-.432.246.458.458 0 0 0 .058.515l2.326 2.424a.56.56 0 0 0 .416.21.55.55 0 0 0 .427-.208l6.502-8.022a.466.466 0 0 0 .078-.493.458.458 0 0 0-.153-.136Z" transform="translate(3,0)" />}
              </svg>
            )}
          </span>
        </div>
      </div>
    </>
  );
}

function MediaContent({ messageId, content, type }: { messageId: string; content: string; type: string }) {
  const mediaUrl = `/api/media/${messageId}`;

  if (type === "image" || type === "sticker") {
    return (
      <div className="p-1">
        <img src={mediaUrl} alt="" className="rounded-lg max-w-[300px] max-h-[300px] object-cover" loading="lazy" />
      </div>
    );
  }

  if (type === "video") {
    return (
      <div className="p-1">
        <video controls className="rounded-lg max-w-[300px] max-h-[300px]" preload="metadata">
          <source src={mediaUrl} />
        </video>
      </div>
    );
  }

  if (type === "audio") {
    return (
      <div className="px-3.5 py-2">
        <audio controls className="max-w-[260px] h-10" preload="metadata">
          <source src={mediaUrl} />
        </audio>
      </div>
    );
  }

  if (type === "document") {
    return (
      <div className="px-3.5 py-2">
        <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#027eb5] dark:text-[#71c5e8] hover:underline">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
          <span className="text-xs underline">{content}</span>
        </a>
      </div>
    );
  }

  return null;
}
