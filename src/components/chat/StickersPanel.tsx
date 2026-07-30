"use client";

import { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";

interface Sticker { id: string; url: string; name: string; created_at: string; }

export default function StickersPanel({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchStickers = async () => {
    setLoading(true);
    const res = await fetch("/api/stickers/upload");
    const data = await res.json();
    setStickers(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchStickers(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", file.name);
    try {
      const res = await fetch("/api/stickers/upload", { method: "POST", body: fd });
      if (!res.ok) { toast.error("Erro ao enviar"); return; }
      toast.success("Figurinha adicionada!");
      fetchStickers();
    } catch { toast.error("Erro de conexão"); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-3 w-[360px] z-50" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Figurinhas</h3>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-emerald-500 rounded-full" /></div>
      ) : (
        <div className="grid grid-cols-4 gap-2 max-h-[240px] overflow-y-auto">
          {stickers.map((s) => (
            <button key={s.id} onClick={() => { onSelect(s.url); onClose(); }} className="aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-emerald-500 hover:shadow-md transition bg-gray-50 dark:bg-gray-700 flex items-center justify-center">
              <img src={s.url} alt={s.name} className="max-w-full max-h-full object-contain" loading="lazy" />
            </button>
          ))}
          {stickers.length === 0 && (
            <div className="col-span-4 py-6 text-center text-xs text-gray-400">Nenhuma figurinha.<br />Faça upload abaixo.</div>
          )}
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <label className={`w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition cursor-pointer ${uploading ? "bg-gray-200 text-gray-400" : "bg-emerald-600 text-white hover:bg-emerald-500"}`}>
          {uploading ? (
            <><div className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" /> Enviando...</>
          ) : (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> Upload de figurinha</>
          )}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>
    </div>
  );
}
