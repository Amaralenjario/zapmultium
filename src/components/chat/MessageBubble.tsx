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
        <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex my-1.5 ${isAgent ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
          isAgent
            ? "bg-green-500 text-white rounded-br-md"
            : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md"
        }`}
      >
        <p>{message.content}</p>
        <p className={`text-[10px] mt-1 text-right ${isAgent ? "text-green-100" : "text-gray-400 dark:text-gray-500"}`}>
          {format(new Date(message.created_at), "HH:mm")}
        </p>
      </div>
    </div>
  );
}
