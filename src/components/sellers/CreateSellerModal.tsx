"use client";

import { useState, useEffect } from "react";
import { X, Loader2, UserPlus } from "lucide-react";
import toast from "react-hot-toast";

const ROLES = ["operator", "supervisor", "admin"];
const roleLabel = (r: string) => r === "admin" ? "Administrador" : r === "supervisor" ? "Supervisor" : "Vendedor";

interface Channel {
  id: string;
  name: string;
  displayPhone?: string;
  metadata?: { meta_connection?: { phone_number?: string } };
}

interface PhoneMapEntry {
  phoneId: string;
  opName: string;
  opColor: string;
}

export default function CreateSellerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("operator");
  const [selectedChannel, setSelectedChannel] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [phoneMap, setPhoneMap] = useState<Record<string, PhoneMapEntry>>({});
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/evohub/channels")
      .then((r) => r.json())
      .then((data) => {
        setChannels(data.channels || []);
        setPhoneMap(data.phoneMap || {});
      })
      .catch(() => {})
      .finally(() => setLoadingChannels(false));
  }, []);

  const getChannelLabel = (ch: Channel) => {
    const pm = phoneMap[ch.id];
    const displayNumber = ch.displayPhone || ch.metadata?.meta_connection?.phone_number || "";
    if (pm?.opName) {
      return displayNumber ? `${pm.opName} - ${displayNumber}` : `${pm.opName} (${ch.name})`;
    }
    if (displayNumber) return `${ch.name} - ${displayNumber}`;
    return ch.name;
  };

  const handleCreate = async () => {
    if (!name.trim() || !email.trim() || !password) return;
    setLoading(true);
    const res = await fetch("/api/sellers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        evohub_channel_id: selectedChannel || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || "Erro ao criar"); setLoading(false); return; }
    toast.success("Vendedor criado!");
    onCreated();
    onClose();
  };

  const inputCls = "w-full rounded-control border border-bd bg-surface2 px-4 py-2.5 text-sm text-tx placeholder:text-tx3 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-card border border-bd bg-surface shadow-pop p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-control bg-accentsoft flex items-center justify-center">
              <UserPlus className="w-[1.15rem] h-[1.15rem] text-accent" strokeWidth={2} />
            </div>
            <h2 className="text-lg font-bold text-tx">Novo vendedor</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-tx3 hover:text-tx hover:bg-hover transition"><X className="w-5 h-5" strokeWidth={2} /></button>
        </div>
        <p className="text-sm text-tx3 mb-5">A foto de perfil pode ser adicionada depois, ao editar.</p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-tx2 mb-1">Nome</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-tx2 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vendedor@email.com" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-tx2 mb-1">Senha</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-tx2 mb-1">Função</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
              {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-tx2 mb-1">Instância WhatsApp</label>
            {loadingChannels ? (
              <div className="flex items-center gap-2 py-2.5 text-sm text-tx3">
                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} /> Carregando canais...
              </div>
            ) : (
              <select value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)} className={inputCls}>
                <option value="">Nenhuma (sem acesso a conversas)</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>{getChannelLabel(ch)}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-tx2 border border-bd rounded-control hover:bg-hover transition">Cancelar</button>
          <button onClick={handleCreate} disabled={!name.trim() || !email.trim() || !password || loading} className="px-5 py-2.5 text-sm font-bold text-white bg-accent shadow-glow hover:bg-accent2 rounded-control disabled:opacity-50 transition flex items-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.2} />}
            {loading ? "Criando..." : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}
