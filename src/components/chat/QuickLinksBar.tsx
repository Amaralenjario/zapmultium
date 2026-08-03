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
}

export default function QuickLinksBar({ phoneNumberId, customerPhone, conversationId }: Props) {
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [showManage, setShowManage] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
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

  const handleSend = async (link: QuickLink) => {
    if (!phoneNumberId || !customerPhone || sending) return;
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

  const handleSave = async () => {
    if (!editTitle.trim() || !editUrl.trim()) return;
    const method = editId ? "PUT" : "POST";
    const body: any = { title: editTitle.trim(), url: editUrl.trim() };
    if (editId) body.id = editId;
    const res = await fetch("/api/quick-links", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { toast.success(editId ? "Atualizado!" : "Adicionado!"); fetchLinks(); resetForm(); }
    else toast.error("Erro ao salvar");
  };

  const handleDelete = async (id: string) => {
    await fetch("/api/quick-links", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setLinks(prev => prev.filter(l => l.id !== id));
    toast.success("Removido");
  };

  const resetForm = () => { setEditId(null); setEditTitle(""); setEditUrl(""); };

  return (
    <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-[#f0f2f5] dark:bg-[#1a252c] py-1.5">
      <div className="flex items-center px-3">
        <div className="flex items-center gap-1 text-[10px] text-gray-400 flex-shrink-0 mr-2">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
          <span className="uppercase tracking-wider font-semibold">Links</span>
        </div>

        <div ref={scrollRef} className="flex-1 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {links.map(link => (
            <button
              key={link.id}
              onClick={() => handleSend(link)}
              disabled={sending === link.id}
              className="flex-shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:opacity-40 transition truncate max-w-[160px]"
              title={link.url}
            >
              {sending === link.id ? "..." : link.title}
            </button>
          ))}
          {links.length === 0 && !showManage && (
            <span className="text-[10px] text-gray-400 py-1 italic">Nenhum link — clique em + para adicionar</span>
          )}
        </div>

        <button
          onClick={() => setShowManage(!showManage)}
          className={`flex-shrink-0 ml-1.5 p-1 rounded-lg transition ${showManage ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/15" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
          title="Gerenciar links"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
        </button>
      </div>

      {showManage && (
        <div className="px-3 pt-2 pb-1 border-t border-gray-200/50 dark:border-gray-800/50 mt-1.5">
          <div className="flex gap-1.5 mb-2">
            <input
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              placeholder="Nome"
              className="flex-[2] text-[11px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none"
            />
            <input
              type="url"
              value={editUrl}
              onChange={e => setEditUrl(e.target.value)}
              placeholder="https://..."
              className="flex-[3] text-[11px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none"
            />
            <button onClick={handleSave} disabled={!editTitle.trim() || !editUrl.trim()} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-500 text-white disabled:opacity-40 transition flex-shrink-0">
              {editId ? "Salvar" : "Adicionar"}
            </button>
            {editId && <button onClick={resetForm} className="text-[11px] text-gray-400 px-2 py-1.5">Cancelar</button>}
          </div>
          {links.length > 0 && (
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {links.map(link => (
                <div key={link.id} className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800/50">
                  <span className="flex-1 truncate font-medium text-gray-600 dark:text-gray-300">{link.title}</span>
                  <span className="text-gray-400 truncate max-w-[200px] hidden sm:inline">{link.url}</span>
                  <button onClick={() => { setEditId(link.id); setEditTitle(link.title); setEditUrl(link.url); }} className="text-gray-400 hover:text-emerald-500 p-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={() => handleDelete(link.id)} className="text-gray-400 hover:text-red-500 p-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
