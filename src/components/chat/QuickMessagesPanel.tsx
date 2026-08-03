"use client";

import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";

interface QuickMessage {
  id: string;
  title: string;
  content_type: "text" | "image" | "video" | "image_caption";
  content: string;
  media_url: string;
  caption: string;
}

interface Props {
  onSelect: (msg: QuickMessage) => void;
  onClose: () => void;
}

export default function QuickMessagesPanel({ onSelect, onClose }: Props) {
  const [messages, setMessages] = useState<QuickMessage[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<QuickMessage | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    const res = await fetch("/api/quick-messages");
    if (res.ok) setMessages(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = search.trim()
    ? messages.filter((m) => m.title.toLowerCase().includes(search.trim().toLowerCase()))
    : messages;

  const handleDelete = async (id: string) => {
    await fetch("/api/quick-messages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setMessages((prev) => prev.filter((m) => m.id !== id));
    toast.success("Removida");
  };

  const typeLabels: Record<string, string> = {
    text: "Texto",
    image: "Imagem",
    video: "Vídeo",
    image_caption: "Imagem + legenda",
  };

  const typeIcons: Record<string, string> = {
    text: "📝",
    image: "🖼️",
    video: "🎬",
    image_caption: "🖼️✏️",
  };

  return (
    <div ref={panelRef} className="absolute bottom-full right-0 mb-2 w-80 max-h-96 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Mensagens rápidas</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowCreate(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition"
            title="Nova mensagem"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar mensagem..."
          className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {loading ? (
          <div className="flex justify-center py-6"><div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-emerald-500 rounded-full" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-gray-400">{search ? "Nenhuma encontrada" : "Nenhuma mensagem rápida"}</p>
            {!search && (
              <button onClick={() => setShowCreate(true)} className="mt-2 text-xs text-emerald-500 hover:underline">Criar primeira</button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((msg) => (
              <div key={msg.id} className="group flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition cursor-pointer" onClick={() => onSelect(msg)}>
                <span className="text-sm flex-shrink-0">{typeIcons[msg.content_type] || "📝"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{msg.title}</p>
                  {msg.content_type === "text" && (
                    <p className="text-[11px] text-gray-400 truncate">{msg.content}</p>
                  )}
                  {msg.content_type !== "text" && (
                    <p className="text-[11px] text-gray-400">{typeLabels[msg.content_type]}</p>
                  )}
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={(e) => { e.stopPropagation(); setEditing(msg); setShowCreate(true); }} className="p-1 text-gray-400 hover:text-emerald-500" title="Editar">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(msg.id); }} className="p-1 text-gray-400 hover:text-red-500" title="Excluir">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreate && (
        <QuickMessageModal
          editing={editing}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={() => { fetchMessages(); setShowCreate(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function QuickMessageModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: QuickMessage | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(editing?.title || "");
  const [contentType, setContentType] = useState(editing?.content_type || "text");
  const [content, setContent] = useState(editing?.content || "");
  const [mediaUrl, setMediaUrl] = useState(editing?.media_url || "");
  const [caption, setCaption] = useState(editing?.caption || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);

    const body: any = { title: title.trim(), content_type: contentType, content, media_url: mediaUrl, caption };
    const method = editing ? "PUT" : "POST";
    if (editing) body.id = editing.id;

    const res = await fetch("/api/quick-messages", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Erro ao salvar");
    } else {
      toast.success(editing ? "Atualizada!" : "Criada!");
      onSaved();
    }
    setSaving(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/flows/media", { method: "POST", body: formData });
      if (res.ok) {
        const { url } = await res.json();
        setMediaUrl(url);
        toast.success("Upload ok!");
      } else {
        toast.error("Erro no upload");
      }
    } catch { toast.error("Erro"); }
    setUploading(false);
  };

  return (
    <div className="absolute inset-0 z-10 flex items-start justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="mt-4 w-[calc(100%-2rem)] max-w-sm bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4">{editing ? "Editar mensagem" : "Nova mensagem rápida"}</h4>

        {/* Title */}
        <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Título</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Boas vindas" className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none mb-3" />

        {/* Type selector */}
        <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Tipo</label>
        <div className="grid grid-cols-2 gap-1 mb-3">
          {(["text", "image", "video", "image_caption"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setContentType(t)}
              className={`text-[11px] px-3 py-1.5 rounded-lg border transition ${
                contentType === t
                  ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium"
                  : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {t === "text" ? "📝 Texto" : t === "image" ? "🖼️ Imagem" : t === "video" ? "🎬 Vídeo" : "🖼️✏️ Img+Leg"}
            </button>
          ))}
        </div>

        {/* Content fields */}
        {contentType === "text" && (
          <div className="mb-3">
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Mensagem</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Digite a mensagem..." rows={3} className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none resize-none" />
          </div>
        )}

        {(contentType === "image" || contentType === "video" || contentType === "image_caption") && (
          <div className="space-y-3 mb-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">{contentType === "video" ? "URL do vídeo" : "URL da imagem"}</label>
              <div className="flex gap-1.5">
                <input type="text" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://..." className="flex-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none" />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-[11px] flex-shrink-0 disabled:opacity-50"
                >
                  {uploading ? "..." : "Upload"}
                </button>
                <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFileUpload} className="hidden" />
              </div>
            </div>
            {contentType === "image_caption" && (
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Legenda</label>
                <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Legenda da imagem..." rows={2} className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none resize-none" />
              </div>
            )}
            {mediaUrl && (
              <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                {contentType === "video" ? (
                  <video src={mediaUrl} controls className="w-full max-h-32 object-cover" />
                ) : (
                  <img src={mediaUrl} alt="" className="w-full max-h-32 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <button onClick={onClose} className="flex-1 text-xs rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancelar</button>
          <button onClick={handleSave} disabled={!title.trim() || saving} className="flex-1 text-xs rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-white hover:bg-emerald-600 disabled:opacity-40 transition">{saving ? "Salvando..." : editing ? "Atualizar" : "Criar"}</button>
        </div>
      </div>
    </div>
  );
}
