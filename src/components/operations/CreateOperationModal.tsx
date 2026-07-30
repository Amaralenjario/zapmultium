"use client";

import { useState } from "react";
import toast from "react-hot-toast";

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

export default function CreateOperationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    const res = await fetch("/api/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), color }),
    });
    if (!res.ok) { toast.error("Erro ao criar"); setLoading(false); return; }
    toast.success("Operação criada!");
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nova operação</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">Nome</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Comercial" autoFocus className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none transition" />

        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5 mt-4">Cor</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full transition ring-offset-2 ${color === c ? "ring-2 ring-offset-gray-100 dark:ring-offset-gray-900" : ""}`} style={{ backgroundColor: c }} />
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancelar</button>
          <button onClick={handleCreate} disabled={!name.trim() || loading} className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition">{loading ? "Criando..." : "Criar"}</button>
        </div>
      </div>
    </div>
  );
}
