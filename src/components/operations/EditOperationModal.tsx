"use client";

import { useState, useEffect } from "react";
import { X, Check, Plus, Trash2, Smartphone } from "lucide-react";
import toast from "react-hot-toast";

const COLORS = ["#3A5AF0", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#14b8a6"];

interface Channel { id: string; operation_id: string; evohub_channel_id: string; evohub_channel_name: string; phone_number_id: string | null; }
interface Operation { id: string; name: string; slug: string; color: string; channels: Channel[]; }

export default function EditOperationModal({ operation, onClose, onUpdated }: { operation: Operation; onClose: () => void; onUpdated: () => void }) {
  const [name, setName] = useState(operation.name);
  const [color, setColor] = useState(operation.color);
  const [saving, setSaving] = useState(false);
  const [channels] = useState(operation.channels || []);
  const [availableChannels, setAvailableChannels] = useState<any[]>([]);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState("");
  const [phoneId, setPhoneId] = useState("");

  useEffect(() => { fetch("/api/evohub/list-channels").then(r => r.json()).then(setAvailableChannels).catch(() => {}); }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/operations/${operation.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, color }) });
    if (!res.ok) { toast.error("Erro ao salvar"); setSaving(false); return; }
    toast.success("Operação atualizada!");
    onUpdated();
    onClose();
  };

  const handleAddChannel = async () => {
    if (!selectedChannel) return;
    const ch = availableChannels.find((c: any) => c.id === selectedChannel);
    const res = await fetch(`/api/operations/${operation.id}/channels`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ evohub_channel_id: ch.id, evohub_channel_name: ch.name, phone_number_id: phoneId || null }) });
    if (!res.ok) { toast.error("Erro ao vincular"); return; }
    toast.success("Número vinculado!");
    onUpdated();
    setShowAddChannel(false); setSelectedChannel(""); setPhoneId("");
  };

  const handleRemoveChannel = async (ch: Channel) => {
    const res = await fetch(`/api/operations/${operation.id}/channels`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel_id: ch.id }) });
    if (!res.ok) { toast.error("Erro ao remover"); return; }
    toast.success("Número removido!");
    onUpdated();
  };

  const inputCls = "w-full rounded-control border border-bd bg-surface2 px-4 py-2.5 text-tx placeholder:text-tx3 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-card border border-bd bg-surface shadow-pop p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-tx">Editar operação</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-tx3 hover:text-tx hover:bg-hover transition"><X className="w-5 h-5" strokeWidth={2} /></button>
        </div>

        <label className="block text-sm font-semibold text-tx2 mb-1.5">Nome</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />

        <label className="block text-sm font-semibold text-tx2 mb-2 mt-4">Cor</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} className="w-8 h-8 rounded-full transition flex items-center justify-center" style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : "none" }}>
              {color === c && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-tx">Números vinculados</h3>
            <button onClick={() => setShowAddChannel(true)} className="text-xs font-bold text-accent hover:text-accent2 flex items-center gap-1"><Plus className="w-3.5 h-3.5" strokeWidth={2.2} /> Vincular</button>
          </div>

          {channels.length === 0 ? (
            <p className="text-sm text-tx3">Nenhum número vinculado</p>
          ) : (
            <div className="space-y-1.5">
              {channels.map((ch) => (
                <div key={ch.id} className="flex items-center justify-between bg-surface2 rounded-control px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Smartphone className="w-3.5 h-3.5 text-tx3 flex-shrink-0" strokeWidth={2} />
                    <span className="text-sm text-tx2 font-semibold truncate">{ch.evohub_channel_name}</span>
                    {ch.phone_number_id && <span className="text-[10px] text-tx3 tabular-nums flex-shrink-0">{ch.phone_number_id}</span>}
                  </div>
                  <button onClick={() => handleRemoveChannel(ch)} className="text-tx3 hover:text-red-500 flex-shrink-0 p-1" title="Remover"><Trash2 className="w-3.5 h-3.5" strokeWidth={2} /></button>
                </div>
              ))}
            </div>
          )}

          {showAddChannel && (
            <div className="mt-3 p-3 bg-surface2 rounded-control space-y-2 border border-bd">
              <select value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)} className="w-full rounded-lg border border-bd bg-surface px-3 py-2 text-sm text-tx focus:border-accent focus:outline-none">
                <option value="">Selecionar canal EvoHub...</option>
                {availableChannels.filter((c: any) => !channels.some(ch => ch.evohub_channel_id === c.id)).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="text" value={phoneId} onChange={(e) => setPhoneId(e.target.value)} placeholder="Phone Number ID (ex: 897878513398151)" className="w-full rounded-lg border border-bd bg-surface px-3 py-2 text-sm text-tx placeholder:text-tx3 focus:border-accent focus:outline-none" />
              <div className="flex gap-2">
                <button onClick={() => setShowAddChannel(false)} className="flex-1 py-1.5 text-xs font-semibold rounded-lg border border-bd text-tx2 hover:bg-hover transition">Cancelar</button>
                <button onClick={handleAddChannel} disabled={!selectedChannel} className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-accent text-white disabled:opacity-50 hover:bg-accent2 transition">Vincular</button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 rounded-control border border-bd px-4 py-2.5 text-sm font-semibold text-tx2 hover:bg-hover transition">Cancelar</button>
          <button onClick={handleSave} disabled={!name.trim() || saving} className="flex-1 rounded-control bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-accent2 disabled:opacity-50 transition">{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}
