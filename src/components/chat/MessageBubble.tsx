import { format } from "date-fns";

interface Message {
  id: string;
  content: string;
  sender_type: "customer" | "agent" | "system" | "bot";
  content_type: string;
  created_at: string;
}

export default function MessageBubble({ message }: { message: Message }) {
  const isAgent = message.sender_type === "agent";
  const isSystem = message.sender_type === "system" || message.sender_type === "bot";

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <span className="text-xs bg-white/80 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 px-3 py-1 rounded-full shadow-sm">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex my-1 ${isAgent ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[70%] px-4 py-2 rounded-lg text-sm leading-relaxed shadow-[0_1px_1px_rgba(0,0,0,0.1)] ${
          isAgent
            ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-gray-900 dark:text-gray-100"
            : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        }`}
      >
        <p>{message.content}</p>
        <p className={`text-[11px] mt-0.5 text-right ${isAgent ? "text-[#667781] dark:text-gray-400" : "text-gray-400 dark:text-gray-500"}`}>
          {format(new Date(message.created_at), "HH:mm")}
        </p>
      </div>
    </div>
  );
}
