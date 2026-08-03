"use client";

import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";

interface QuickLink {
  id: string;
  title: string;
  url: string;
}

interface Props {
  phoneNumberId: string;
  customerPhone: string;
  conversationId: string;
  customerName: string;
}

export default function QuickLinksBar({ phoneNumberId, customerPhone, conversationId, customerName }: Props) {
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [showManage, setShowManage] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [confirmLink, setConfirmLink] = useState<QuickLink | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const momentumRef = useRef(0);
  const animRef = useRef<number>(0);

  const fetchLinks = async () => {
    const res = await fetch("/api/quick-links");
    if (res.ok) setLinks(await res.json());
  };

  useEffect(() => { fetchLinks(); }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      momentumRef.current += e.deltaY;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      const animate = () => {
        const current = momentumRef.current;
        const step = current * 0.15;
        if (Math.abs(current) < 0.5) { momentumRef.current = 0; animRef.current = 0; return; }
        momentumRef.current -= step;
        el.scrollLeft += step;
        animRef.current = requestAnimationFrame(animate);
      };
      animRef.current = requestAnimationFrame(animate);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => { el.removeEventListener("wheel", handler); if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  const doSend = async () => {
    if (!confirmLink || !phoneNumberId || !customerPhone) return;
    const link = confirmLink;
    setConfirmLink(null);
    setSending(link.id);
    try {
      const res = await fetch("/api/evohub/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, phoneNumberId, to: customerPhone, message: link.url }),
      });
      if (!res.ok) toast.error("Erro ao enviar");
    } catch { toast.error("Erro"); }
    setSending(null);
  };

  const startEdit = (link?: QuickLink) => {
    if (link) { setEditId(link.id); setEditTitle(link.title); setEditUrl(link.url); }
    else { setEditId(null); setEditTitle(""); setEditUrl(""); }
    setShowManage(true);
  };

  const handleSave = async () => {
    if (!editTitle.trim() || !editUrl.trim()) return;
    const method = editId ? "PUT" : "POST";
    const body: any = { title: editTitle.trim(), url: editUrl.trim() };
    if (editId) body.id = editId;
    const res = await fetch("/api/quick-links", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { toast.success(editId ? "Atualizado!" : "Adicionado!"); fetchLinks(); setEditId(null); setEditTitle(""); setEditUrl(""); setShowManage(false); }
    else { const err = await res.json(); toast.error(err.error || "Erro"); }
  };

  const handleDelete = async (id: string) => {
    await fetch("/api/quick-links", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setLinks(prev => prev.filter(l => l.id !== id));
    toast.success("Removido");
  };

  return (
    <>
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-[#f0f2f5] dark:bg-[#1a252c] py-1.5">
        <div className="flex items-center px-2.5 gap-1">
          <button
            onClick={() => { startEdit(); }}
            className="flex-shrink-0 p-1 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition"
            title="Adicionar link"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          </button>

          <div ref={scrollRef} className="flex-1 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {links.length === 0 && (
              <span className="text-[10px] text-gray-400 py-1 italic flex-shrink-0">Nenhum link — clique no +</span>
            )}
            {links.map(link => (
              <div key={link.id} className="flex-shrink-0 flex items-center gap-0.5 group">
                <button
                  onClick={() => setConfirmLink(link)}
                  disabled={sending === link.id}
                  className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-emerald-200/60 dark:border-emerald-800/60 bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/15 disabled:opacity-40 transition truncate max-w-[140px]"
                  title={link.url}
                >
                  <span className="flex items-center gap-1">
                    <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                    {sending === link.id ? "..." : link.title}
                  </span>
                </button>
                <button
                  onClick={() => startEdit(link)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-emerald-500 transition"
                  title="Editar"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {showManage && (
          <div className="px-2.5 pt-2 pb-1.5 border-t border-gray-200/50 dark:border-gray-800/50 mt-1.5 space-y-2">
            <div className="flex gap-1.5">
              <div className="flex-1 flex gap-1.5">
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  placeholder="Nome do link"
                  className="flex-[2] text-[11px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none"
                />
                <input
                  type="url"
                  value={editUrl}
                  onChange={e => setEditUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-[3] text-[11px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={handleSave} disabled={!editTitle.trim() || !editUrl.trim()} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-500 text-white disabled:opacity-40 transition">
                  {editId ? "Salvar" : "Adicionar"}
                </button>
                <button onClick={() => { setShowManage(false); setEditId(null); }} className="text-[11px] text-gray-400 px-2 py-1.5 hover:text-gray-600">Fechar</button>
              </div>
            </div>
            {links.length > 0 && (
              <div className="space-y-0.5 max-h-28 overflow-y-auto">
                {links.map(link => (
                  <div key={link.id} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800/50">
                    <button
                      onClick={() => setConfirmLink(link)}
                      className="flex items-center gap-1.5 flex-1 min-w-0 hover:text-emerald-500 transition"
                    >
                      <svg className="w-2.5 h-2.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                      <span className="truncate font-medium text-gray-600 dark:text-gray-300">{link.title}</span>
                    </button>
                    <span className="text-gray-400 truncate max-w-[180px] hidden sm:inline">{link.url}</span>
                    <button onClick={() => startEdit(link)} className="text-gray-400 hover:text-emerald-500 p-0.5 flex-shrink-0" title="Editar">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                    </button>
                    <button onClick={() => handleDelete(link.id)} className="text-gray-400 hover:text-red-500 p-0.5 flex-shrink-0" title="Excluir">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation popup */}
      {confirmLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setConfirmLink(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Enviar link?</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                Deseja enviar o link <span className="font-semibold text-gray-700 dark:text-gray-300">&ldquo;{confirmLink.title}&rdquo;</span> para <span className="font-semibold text-gray-700 dark:text-gray-300">{customerName || "este lead"}</span>?
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 truncate">{confirmLink.url}</p>
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => setConfirmLink(null)} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                Cancelar
              </button>
              <button onClick={doSend} className="flex-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition">
                Sim, enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
