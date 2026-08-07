"use client";

import { useState } from "react";
import { X, Building2, Check } from "lucide-react";
import toast from "react-hot-toast";

const COLORS = ["#3A5AF0", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#14b8a6"];

export default function CreateOperationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    const res = await fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), color }) });
    if (!res.ok) { toast.error("Erro ao criar"); setLoading(false); return; }
    toast.success("Operação criada!");
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-card border border-bd bg-surface shadow-pop p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-control flex items-center justify-center" style={{ backgroundColor: color + "1f" }}><Building2 className="w-4 h-4" strokeWidth={2} style={{ color }} /></span>
            <h2 className="text-lg font-bold text-tx">Nova operação</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-tx3 hover:text-tx hover:bg-hover transition"><X className="w-5 h-5" strokeWidth={2} /></button>
        </div>

        <label className="block text-sm font-semibold text-tx2 mb-1.5">Nome</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} placeholder="Ex: Comercial" autoFocus className="w-full rounded-control border border-bd bg-surface2 px-4 py-2.5 text-tx placeholder:text-tx3 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition" />

        <label className="block text-sm font-semibold text-tx2 mb-2 mt-4">Cor</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} className="w-8 h-8 rounded-full transition flex items-center justify-center" style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : "none" }}>
              {color === c && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 rounded-control border border-bd px-4 py-2.5 text-sm font-semibold text-tx2 hover:bg-hover transition">Cancelar</button>
          <button onClick={handleCreate} disabled={!name.trim() || loading} className="flex-1 rounded-control bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-accent2 disabled:opacity-50 transition">{loading ? "Criando..." : "Criar"}</button>
        </div>
      </div>
    </div>
  );
}
