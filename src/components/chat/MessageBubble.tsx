import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Message {
  id: string;
  content: string;
  sender_type: "customer" | "agent" | "system" | "bot";
  content_type: string;
  created_at: string;
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
      <div className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
        <div
          className={`relative max-w-[65%] px-3.5 py-2 text-sm leading-[1.4] ${
            isFirst === false ? (isAgent ? "rounded-tr-sm" : "rounded-tl-sm") : ""
          } ${
            isAgent
              ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-gray-100 rounded-t-lg rounded-l-lg"
              : "bg-white dark:bg-[#202c33] text-[#111b21] dark:text-gray-100 rounded-t-lg rounded-r-lg"
          } shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]`}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
          <span className="inline-flex items-center gap-1 float-right ml-2 mt-1.5 -mb-1 text-[11px] text-[#667781] dark:text-gray-400">
            {format(new Date(message.created_at), "HH:mm")}
            {isAgent && (
              <svg className="w-3.5 h-3.5 text-[#53bdeb]" fill="currentColor" viewBox="0 0 16 11">
                <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 0 0-.336-.153.508.508 0 0 0-.432.246.458.458 0 0 0 .058.515l2.326 2.424a.56.56 0 0 0 .416.21.55.55 0 0 0 .427-.208l6.502-8.022a.466.466 0 0 0 .078-.493.458.458 0 0 0-.153-.136Z" />
              </svg>
            )}
          </span>
        </div>
      </div>
    </>
  );
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
  const p = new Date(prev).toDateString();
  const c = new Date(curr).toDateString();
  return p !== c;
}

export function isConsecutive(prev: { sender_type: string; created_at: string } | null, curr: { sender_type: string; created_at: string }) {
  if (!prev) return false;
  if (prev.sender_type !== curr.sender_type) return false;
  const diff = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime();
  return diff < 60000 * 3;
}
