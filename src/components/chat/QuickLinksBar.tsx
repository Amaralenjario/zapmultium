"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Link2, Send, Pencil, Trash2, X } from "lucide-react";
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
      <div className="flex-shrink-0 border-b border-bd bg-surface2 py-1.5">
        <div className="flex items-center px-2.5 gap-1">
          <button
            onClick={() => { startEdit(); }}
            className="flex-shrink-0 p-1.5 rounded-lg text-tx3 hover:text-accent hover:bg-accentsoft transition"
            title="Adicionar link"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
          </button>

          <div ref={scrollRef} className="flex-1 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {links.length === 0 && (
              <span className="text-[11px] text-tx3 py-1 italic flex-shrink-0">Nenhum link — clique no +</span>
            )}
            {links.map(link => (
              <div key={link.id} className="flex-shrink-0 flex items-center gap-0.5 pl-2.5 pr-1 py-0.5 rounded-full border border-bd bg-surface" title={link.url}>
                <Link2 className="w-3 h-3 flex-shrink-0 text-tx3" strokeWidth={2.2} />
                <span className="text-[11px] font-semibold text-tx2 truncate max-w-[130px] ml-1">{link.title}</span>
                <button
                  onClick={() => setConfirmLink(link)}
                  disabled={sending === link.id}
                  className="ml-1 p-1 rounded-full text-accent hover:bg-accentsoft disabled:opacity-40 transition"
                  title="Enviar link"
                >
                  {sending === link.id
                    ? <span className="block w-3.5 h-3.5 border-[1.5px] border-accent/40 border-t-accent rounded-full animate-spin" />
                    : <Send className="w-3.5 h-3.5" strokeWidth={2} />}
                </button>
                <button
                  onClick={() => startEdit(link)}
                  className="p-1 rounded-full text-tx3 hover:text-tx hover:bg-hover transition"
                  title="Editar link"
                >
                  <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {showManage && (
          <div className="px-2.5 pt-2 pb-1.5 border-t border-line mt-1.5 space-y-2">
            <div className="flex gap-1.5">
              <div className="flex-1 flex gap-1.5">
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  placeholder="Nome do link"
                  className="flex-[2] text-[11px] rounded-lg border border-bd bg-surface2 px-2.5 py-1.5 text-tx2 placeholder:text-tx3 focus:border-accent focus:outline-none"
                />
                <input
                  type="url"
                  value={editUrl}
                  onChange={e => setEditUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-[3] text-[11px] rounded-lg border border-bd bg-surface2 px-2.5 py-1.5 text-tx2 placeholder:text-tx3 focus:border-accent focus:outline-none"
                />
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={handleSave} disabled={!editTitle.trim() || !editUrl.trim()} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-accent text-white disabled:opacity-40 transition">
                  {editId ? "Salvar" : "Adicionar"}
                </button>
                <button onClick={() => { setShowManage(false); setEditId(null); }} className="text-[11px] text-tx3 px-2 py-1.5 hover:text-tx">Fechar</button>
              </div>
            </div>
            {links.length > 0 && (
              <div className="space-y-0.5 max-h-28 overflow-y-auto">
                {links.map(link => (
                  <div key={link.id} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded hover:bg-hover">
                    <button
                      onClick={() => setConfirmLink(link)}
                      className="flex items-center gap-1.5 flex-1 min-w-0 hover:text-accent transition"
                    >
                      <Link2 className="w-3 h-3 flex-shrink-0 text-tx3" strokeWidth={2.2} />
                      <span className="truncate font-medium text-tx2">{link.title}</span>
                    </button>
                    <span className="text-tx3 truncate max-w-[180px] hidden sm:inline">{link.url}</span>
                    <button onClick={() => startEdit(link)} className="text-tx3 hover:text-accent p-0.5 flex-shrink-0" title="Editar">
                      <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                    <button onClick={() => handleDelete(link.id)} className="text-tx3 hover:text-red-500 p-0.5 flex-shrink-0" title="Excluir">
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
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
          <div className="w-full max-w-sm rounded-2xl border border-bd bg-surface shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-accentsoft flex items-center justify-center">
                <Send className="w-5 h-5 text-accent" strokeWidth={2} />
              </div>
              <h3 className="text-sm font-bold text-tx">Enviar link?</h3>
              <p className="text-xs text-tx3 mt-1.5">
                Deseja enviar o link <span className="font-semibold text-tx2">&ldquo;{confirmLink.title}&rdquo;</span> para <span className="font-semibold text-tx2">{customerName || "este lead"}</span>?
              </p>
              <p className="text-[10px] text-tx3 mt-1 truncate">{confirmLink.url}</p>
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => setConfirmLink(null)} className="flex-1 rounded-xl border border-bd px-4 py-2.5 text-sm font-medium text-tx2 hover:bg-hover transition">
                Cancelar
              </button>
              <button onClick={doSend} className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent2 transition">
                Sim, enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
