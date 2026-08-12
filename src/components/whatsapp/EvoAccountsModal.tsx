"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2, Server, Loader2, Star } from "lucide-react";
import toast from "react-hot-toast";

interface EvoAccount { id: string; name: string; api_url: string; is_default: boolean; }

const inputCls = "w-full rounded-control border border-bd bg-surface2 px-3 py-2 text-sm text-tx placeholder:text-tx3 focus:border-accent focus:outline-none";

export default function EvoAccountsModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [accounts, setAccounts] = useState<EvoAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("https://api.evohub.ai");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { const res = await fetch("/api/evo-accounts"); if (res.ok) setAccounts(await res.json()); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim() || !apiKey.trim()) { toast.error("Preencha nome e API key"); return; }
    setSaving(true);
    const res = await fetch("/api/evo-accounts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), api_key: apiKey.trim(), api_url: apiUrl.trim() }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || "Erro ao adicionar"); return; }
    toast.success("Conta EvoHub adicionada! Sincronizando conexões...");
    setName(""); setApiKey(""); setApiUrl("https://api.evohub.ai"); setAdding(false);
    await load();
    onChanged(); // manda o pai puxar os canais da nova conta
  };

  const remove = async (acc: EvoAccount) => {
    if (!confirm(`Remover a conta "${acc.name}"? As conexões dela deixam de aparecer (conversas não são apagadas).`)) return;
    const res = await fetch("/api/evo-accounts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: acc.id }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || "Erro ao remover"); return; }
    toast.success("Conta removida");
    await load();
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-card border border-bd bg-surface shadow-pop flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-bd">
          <h3 className="text-sm font-bold text-tx flex items-center gap-2"><Server className="w-4 h-4 text-accent" strokeWidth={2} /> Contas EvoHub</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-tx3 hover:text-tx hover:bg-hover transition"><X className="w-5 h-5" strokeWidth={2} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-accent animate-spin" /></div>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-tx3 text-center py-6">Nenhuma conta cadastrada.</p>
          ) : accounts.map((acc) => (
            <div key={acc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-control border border-bd bg-surface">
              <span className="w-8 h-8 rounded-control bg-accentsoft flex items-center justify-center flex-shrink-0"><Server className="w-4 h-4 text-accent" strokeWidth={2} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-tx truncate flex items-center gap-1.5">{acc.name}{acc.is_default && <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-500"><Star className="w-3 h-3" fill="currentColor" strokeWidth={0} />padrão</span>}</p>
                <p className="text-[11px] text-tx3 font-mono truncate">{acc.api_url}</p>
              </div>
              <button onClick={() => remove(acc)} className="p-1.5 rounded-lg text-tx3 hover:text-red-500 hover:bg-red-500/10 transition flex-shrink-0" title="Remover"><Trash2 className="w-4 h-4" strokeWidth={2} /></button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-bd">
          {!adding ? (
            <button onClick={() => setAdding(true)} className="w-full rounded-control bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-accent2 transition flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" strokeWidth={2.2} /> Adicionar conta EvoHub
            </button>
          ) : (
            <div className="space-y-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (ex.: EvoHub 2)" className={inputCls} autoFocus />
              <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API Key da EvoHub (evh_pk_...)" className={inputCls} />
              <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="URL da API (https://api.evohub.ai)" className={inputCls} />
              <div className="flex gap-2 pt-1">
                <button onClick={() => setAdding(false)} className="flex-1 rounded-control border border-bd px-4 py-2 text-sm font-semibold text-tx2 hover:bg-hover transition">Cancelar</button>
                <button onClick={create} disabled={saving} className="flex-1 rounded-control bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent2 disabled:opacity-50 transition flex items-center justify-center gap-1.5">{saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Salvar</button>
              </div>
              <p className="text-[10px] text-tx3 leading-tight pt-0.5">A API key fica salva no seu sistema e é usada só pra puxar as conexões dessa EvoHub. Depois de salvar, use <b>Sincronizar</b>.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
