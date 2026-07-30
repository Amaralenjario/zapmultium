"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";

const ROLES = ["operator", "supervisor", "admin"];

interface Channel {
  id: string;
  name: string;
  displayPhone?: string;
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
    if (pm?.opName) return `${pm.opName}${pm.phoneId ? " (" + pm.phoneId + ")" : ""}`;
    if (ch.displayPhone) return `${ch.name} (${ch.displayPhone})`;
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Novo vendedor</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Nome</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vendedor@email.com" className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Senha</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Função</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none">
              {ROLES.map((r) => <option key={r} value={r}>{r === "admin" ? "Administrador" : r === "supervisor" ? "Supervisor" : "Operador"}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Instância WhatsApp</label>
            {loadingChannels ? (
              <div className="flex items-center gap-2 py-2.5 text-sm text-gray-400">
                <div className="animate-spin w-3.5 h-3.5 border-2 border-gray-300 border-t-green-500 rounded-full" /> Carregando canais...
              </div>
            ) : (
              <select value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)} className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none">
                <option value="">Nenhuma (sem acesso a conversas)</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>{getChannelLabel(ch)}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Cancelar</button>
          <button onClick={handleCreate} disabled={!name.trim() || !email.trim() || !password || loading} className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50">{loading ? "Criando..." : "Criar"}</button>
        </div>
      </div>
    </div>
  );
}
