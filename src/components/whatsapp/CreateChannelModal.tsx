"use client";

import { useState, useEffect } from "react";
import { X, ExternalLink, Copy, Check, MessageCircle } from "lucide-react";
import toast from "react-hot-toast";

interface CreatedChannel { id: string; name: string; token: string; status: string; type: string; connectUrl: string; }

export default function CreateChannelModal({ onClose, onCreated, operationName }: { onClose: () => void; onCreated: (ch: CreatedChannel) => void; operationName?: string }) {
  const [name, setName] = useState("");
  const [evoAccountId, setEvoAccountId] = useState("");
  const [evoAccounts, setEvoAccounts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState<CreatedChannel | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/evo-accounts").then(r => r.json()).then(d => { setEvoAccounts(d || []); if (d && d.length > 0) setEvoAccountId(d[0].id); }).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/evohub/create-channel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), evo_account_id: evoAccountId }) });
      const data = await res.json();
      if (!res.ok) { const msg = typeof data.error === "string" ? data.error : (data.error?.message || JSON.stringify(data.error) || "Erro ao criar conexão"); toast.error(msg); setLoading(false); return; }
      setChannel(data); setLoading(false); onCreated(data);
    } catch { toast.error("Erro de conexão com o servidor"); setLoading(false); }
  };

  const copyLink = (text: string) => { navigator.clipboard.writeText(text); setCopied(true); toast.success("Copiado!"); setTimeout(() => setCopied(false), 2000); };

  const inputCls = "w-full rounded-control border border-bd bg-surface2 px-4 py-3 text-tx placeholder:text-tx3 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-card border border-bd bg-surface shadow-pop" onClick={(e) => e.stopPropagation()}>
        {channel ? (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-tx">Conexão criada!</h2>
              <button onClick={onClose} className="p-1.5 rounded-lg text-tx3 hover:text-tx hover:bg-hover transition"><X className="w-5 h-5" strokeWidth={2} /></button>
            </div>
            <div className="bg-success-soft border border-success/25 rounded-card p-4 mb-4">
              <div className="flex items-center gap-2 mb-2"><span className="w-2 h-2 rounded-full bg-success" /><span className="text-sm font-bold text-success">{channel.name}</span></div>
              <p className="text-xs text-tx2 mb-3">Compartilhe o link abaixo com o cliente para conectar o WhatsApp dele.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-surface rounded-lg px-3 py-2 text-xs text-tx2 truncate border border-bd">{channel.connectUrl}</code>
                <button onClick={() => copyLink(channel.connectUrl)} className={`px-3 py-2 rounded-lg text-xs font-bold transition flex-shrink-0 flex items-center gap-1 ${copied ? "bg-success text-white" : "bg-surface2 text-tx2 hover:bg-hover"}`}>
                  {copied ? <><Check className="w-3.5 h-3.5" strokeWidth={2.5} /> Copiado</> : <><Copy className="w-3.5 h-3.5" strokeWidth={2} /> Copiar</>}
                </button>
              </div>
            </div>
            <a href={channel.connectUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full text-center rounded-control bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-accent2 transition">
              <ExternalLink className="w-4 h-4" strokeWidth={2} /> Abrir link de conexão
            </a>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-control bg-accentsoft flex items-center justify-center"><MessageCircle className="w-[1.15rem] h-[1.15rem] text-accent" strokeWidth={2} /></div>
                <h2 className="text-lg font-bold text-tx">Nova conexão WhatsApp</h2>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-tx3 hover:text-tx hover:bg-hover transition"><X className="w-5 h-5" strokeWidth={2} /></button>
            </div>
            <p className="text-sm text-tx2 mb-4">Crie um canal para conectar um número de WhatsApp Business. Após criar, compartilhe o link com o cliente para ele autorizar a conexão.</p>
            {operationName && (
              <div className="flex items-center gap-2 mb-4 rounded-control bg-accentsoft px-3 py-2">
                <MessageCircle className="w-4 h-4 text-accent flex-shrink-0" strokeWidth={2} />
                <p className="text-xs text-tx2">Será vinculado à operação <span className="font-bold text-accent">{operationName}</span></p>
              </div>
            )}
            {evoAccounts.length > 0 && (
              <div className="mb-3">
                <label className="block text-sm font-semibold text-tx2 mb-1.5">Conta EvoHub</label>
                <select value={evoAccountId} onChange={(e) => setEvoAccountId(e.target.value)} className={inputCls}>
                  {evoAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
              </div>
            )}
            <label className="block text-sm font-semibold text-tx2 mb-1.5">Nome da conexão</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} placeholder="Ex: Atendimento Principal" autoFocus className={inputCls} />
            <div className="flex gap-3 mt-5">
              <button onClick={onClose} className="flex-1 rounded-control border border-bd px-4 py-2.5 text-sm font-semibold text-tx2 hover:bg-hover transition">Cancelar</button>
              <button onClick={handleCreate} disabled={!name.trim() || loading} className="flex-1 rounded-control bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-accent2 disabled:opacity-50 disabled:cursor-not-allowed transition">{loading ? "Criando..." : "Criar conexão"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
