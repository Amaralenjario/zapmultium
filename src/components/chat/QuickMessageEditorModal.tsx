"use client";

import { useState, useRef } from "react";
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
  editing: QuickMessage | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function QuickMessageEditorModal({ editing, onClose, onSaved }: Props) {
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
    else { toast.success(editing ? "Mensagem atualizada!" : "Mensagem criada!"); onSaved(); }
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
    { key: "text", label: "Texto", icon: "📝", desc: "Apenas texto" },
    { key: "image", label: "Imagem", icon: "🖼️", desc: "URL ou upload" },
    { key: "video", label: "Vídeo", icon: "🎬", desc: "URL ou upload" },
    { key: "image_caption", label: "Imagem + Legenda", icon: "✏️", desc: "Imagem com texto" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">{editing ? "Editar mensagem rápida" : "Nova mensagem rápida"}</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Crie atalhos de texto, imagem ou vídeo para enviar rapidamente</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Título da mensagem</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Boas vindas, Agradecimento, FAQ..."
              autoFocus
              className="w-full text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15 focus:outline-none transition"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Tipo de conteúdo</label>
            <div className="grid grid-cols-2 gap-2">
              {types.map(t => (
                <button
                  key={t.key}
                  onClick={() => setContentType(t.key)}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 transition text-left ${
                    contentType === t.key
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <span className="text-xl flex-shrink-0 mt-0.5">{t.icon}</span>
                  <div>
                    <p className={`text-sm font-semibold ${contentType === t.key ? "text-emerald-600 dark:text-emerald-400" : "text-gray-700 dark:text-gray-300"}`}>{t.label}</p>
                    <p className="text-[11px] text-gray-400">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Conteúdo específico por tipo */}
          {contentType === "text" && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Mensagem</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Digite a mensagem que será enviada..."
                rows={6}
                className="w-full text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15 focus:outline-none resize-none"
              />
              {content && (
                <div className="mt-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3">
                  <p className="text-[11px] text-gray-400 mb-1">Preview:</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{content}</p>
                </div>
              )}
            </div>
          )}

          {(contentType === "image" || contentType === "video" || contentType === "image_caption") && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  {contentType === "video" ? "URL do vídeo" : "URL da imagem"}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={mediaUrl}
                    onChange={e => setMediaUrl(e.target.value)}
                    placeholder="https://seusite.com/imagem.jpg"
                    className="flex-1 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15 focus:outline-none"
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm font-medium flex-shrink-0 disabled:opacity-50"
                  >
                    {uploading ? "Enviando..." : "Upload"}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFileUpload} className="hidden" />
                </div>
              </div>

              {contentType === "image_caption" && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Legenda da imagem</label>
                  <textarea
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    placeholder="Legenda que acompanha a imagem..."
                    rows={3}
                    className="w-full text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15 focus:outline-none resize-none"
                  />
                </div>
              )}

              {mediaUrl && (
                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                  {contentType === "video" ? (
                    <video src={mediaUrl} controls className="w-full max-h-48 object-contain" />
                  ) : (
                    <div className="relative">
                      <img src={mediaUrl} alt="Preview" className="w-full max-h-48 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      {caption && (
                        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                          <p className="text-xs text-gray-400 mb-0.5">Legenda:</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{caption}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="flex-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-40 transition shadow-lg shadow-emerald-500/25"
          >
            {saving ? "Salvando..." : editing ? "Atualizar mensagem" : "Criar mensagem"}
          </button>
        </div>
      </div>
    </div>
  );
}
