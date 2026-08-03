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

  const typeIcons: Record<string, string> = { text: "📝", image: "🖼️", video: "🎬", image_caption: "🖼️✏️" };

  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<QuickMessage | null>(null);

  return (
    <div ref={panelRef} className="absolute bottom-full right-0 mb-2 w-80 max-h-[28rem] bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col z-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Mensagens rápidas</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setEditing(null); setShowEditor(true); }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition"
            title="Nova mensagem"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      <div className="px-3 py-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar mensagem..."
          className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-emerald-500 rounded-full" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-gray-400">{search ? "Nenhuma encontrada" : "Nenhuma mensagem"}</p>
            {!search && (
              <button onClick={() => { setEditing(null); setShowEditor(true); }} className="mt-2 text-xs text-emerald-500 hover:underline">Criar primeira</button>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((msg) => (
              <div key={msg.id} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition cursor-pointer" onClick={() => onSelect(msg)}>
                <span className="text-base flex-shrink-0">{typeIcons[msg.content_type] || "📝"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{msg.title}</p>
                  {msg.content_type === "text" ? (
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{msg.content}</p>
                  ) : (
                    <p className="text-[11px] text-gray-400 mt-0.5">{msg.content_type === "image_caption" ? "Imagem + legenda" : msg.content_type === "image" ? "Imagem" : "Vídeo"}</p>
                  )}
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={(e) => { e.stopPropagation(); setEditing(msg); setShowEditor(true); }} className="p-1 rounded text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" title="Editar">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(msg.id); }} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" title="Excluir">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showEditor && (
        <QuickMessageEditor
          editing={editing}
          onClose={() => { setShowEditor(false); setEditing(null); }}
          onSaved={() => { fetchMessages(); setShowEditor(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function QuickMessageEditor({
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
    const res = await fetch("/api/quick-messages", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const err = await res.json(); toast.error(err.error || "Erro"); }
    else { toast.success(editing ? "Atualizada!" : "Criada!"); onSaved(); }
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
      if (res.ok) { const { url } = await res.json(); setMediaUrl(url); toast.success("Upload ok!"); }
      else toast.error("Erro no upload");
    } catch { toast.error("Erro"); }
    setUploading(false);
  };

  const types = [
    { key: "text", label: "Texto", icon: "📝" },
    { key: "image", label: "Imagem", icon: "🖼️" },
    { key: "video", label: "Vídeo", icon: "🎬" },
    { key: "image_caption", label: "Img + Leg", icon: "✏️" },
  ] as const;

  return (
    <div className="absolute inset-0 z-10 bg-black/50 backdrop-blur-sm flex items-start justify-center" onClick={onClose}>
      <div className="mt-6 w-[calc(100%-2rem)] max-w-sm bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col max-h-[90%] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">{editing ? "Editar" : "Nova"} mensagem rápida</h4>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Título</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Boas vindas"
              autoFocus
              className="w-full text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Tipo</label>
            <div className="grid grid-cols-4 gap-1.5">
              {types.map(t => (
                <button
                  key={t.key}
                  onClick={() => setContentType(t.key)}
                  className={`text-[11px] font-medium py-2 px-1 rounded-xl border transition text-center ${
                    contentType === t.key
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <div className="text-sm mb-0.5">{t.icon}</div>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {contentType === "text" && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Mensagem</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Digite a mensagem..."
                rows={4}
                className="w-full text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none resize-none"
              />
            </div>
          )}

          {(contentType === "image" || contentType === "video" || contentType === "image_caption") && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  {contentType === "video" ? "URL do vídeo" : "URL da imagem"}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={mediaUrl}
                    onChange={e => setMediaUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none"
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-[11px] font-medium flex-shrink-0 disabled:opacity-50"
                  >
                    {uploading ? "..." : "Upload"}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFileUpload} className="hidden" />
                </div>
              </div>

              {contentType === "image_caption" && (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Legenda</label>
                  <textarea
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    placeholder="Legenda da imagem..."
                    rows={2}
                    className="w-full text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none resize-none"
                  />
                </div>
              )}

              {mediaUrl && (
                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                  {contentType === "video" ? (
                    <video src={mediaUrl} controls className="w-full max-h-32 object-cover" />
                  ) : (
                    <img src={mediaUrl} alt="" className="w-full max-h-32 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="flex-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-40 transition"
          >
            {saving ? "Salvando..." : editing ? "Atualizar" : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}
