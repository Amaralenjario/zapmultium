"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

interface Channel {
  id: string;
  operation_id: string;
  evohub_channel_id: string;
  evohub_channel_name: string;
  phone_number_id: string | null;
}

interface Operation {
  id: string;
  name: string;
  slug: string;
  color: string;
  channels: Channel[];
}

export default function EditOperationModal({
  operation,
  onClose,
  onUpdated,
}: {
  operation: Operation;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState(operation.name);
  const [color, setColor] = useState(operation.color);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState(operation.channels || []);
  const [availableChannels, setAvailableChannels] = useState<any[]>([]);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState("");
  const [phoneId, setPhoneId] = useState("");

  useEffect(() => {
    fetch("/api/evohub/list-channels").then(r => r.json()).then(setAvailableChannels).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/operations/${operation.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) { toast.error("Erro ao salvar"); setSaving(false); return; }
    toast.success("Operação atualizada!");
    onUpdated();
    onClose();
  };

  const handleAddChannel = async () => {
    if (!selectedChannel) return;
    const ch = availableChannels.find((c: any) => c.id === selectedChannel);
    const res = await fetch(`/api/operations/${operation.id}/channels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evohub_channel_id: ch.id,
        evohub_channel_name: ch.name,
        phone_number_id: phoneId || null,
      }),
    });
    if (!res.ok) { toast.error("Erro ao vincular"); return; }
    toast.success("Número vinculado!");
    onUpdated();
    setShowAddChannel(false);
    setSelectedChannel("");
    setPhoneId("");
  };

  const handleRemoveChannel = async (ch: Channel) => {
    const res = await fetch(`/api/operations/${operation.id}/channels`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel_id: ch.id }),
    });
    if (!res.ok) { toast.error("Erro ao remover"); return; }
    toast.success("Número removido!");
    onUpdated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Editar operação</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">Nome</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none transition" />

        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5 mt-4">Cor</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full transition ring-offset-2 ${color === c ? "ring-2 ring-offset-gray-100 dark:ring-offset-gray-900" : ""}`} style={{ backgroundColor: c }} />
          ))}
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Números vinculados</h3>
            <button onClick={() => setShowAddChannel(true)} className="text-xs text-green-600 dark:text-green-400 hover:underline font-medium">+ Vincular</button>
          </div>

          {channels.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum número vinculado</p>
          ) : (
            <div className="space-y-1.5">
              {channels.map((ch) => (
                <div key={ch.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{ch.evohub_channel_name}</span>
                    {ch.phone_number_id && <span className="text-[10px] text-gray-400 ml-2">{ch.phone_number_id}</span>}
                  </div>
                  <button onClick={() => handleRemoveChannel(ch)} className="text-red-400 hover:text-red-500 text-xs">Remover</button>
                </div>
              ))}
            </div>
          )}

          {showAddChannel && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-2">
              <select value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-green-500 focus:outline-none">
                <option value="">Selecionar canal EvoHub...</option>
                {availableChannels.filter((c: any) => !channels.some(ch => ch.evohub_channel_id === c.id)).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input type="text" value={phoneId} onChange={(e) => setPhoneId(e.target.value)} placeholder="Phone Number ID (ex: 897878513398151)" className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-green-500 focus:outline-none" />
              <div className="flex gap-2">
                <button onClick={() => setShowAddChannel(false)} className="flex-1 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500">Cancelar</button>
                <button onClick={handleAddChannel} disabled={!selectedChannel} className="flex-1 py-1.5 text-xs rounded-lg bg-green-600 text-white disabled:opacity-50">Vincular</button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancelar</button>
          <button onClick={handleSave} disabled={!name.trim() || saving} className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition">{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}
