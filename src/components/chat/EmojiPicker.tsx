"use client";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export default function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  return (
    <div className="absolute bottom-full right-0 mb-1 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-1.5 flex gap-1 z-50" onClick={(e) => e.stopPropagation()}>
      {EMOJIS.map((e) => (
        <button key={e} onClick={() => onSelect(e)} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-lg transition">{e}</button>
      ))}
    </div>
  );
}
