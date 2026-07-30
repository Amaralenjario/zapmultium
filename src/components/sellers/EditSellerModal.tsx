"use client";

import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";

const ROLES = ["operator", "supervisor", "admin"];

interface Seller {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  instancia: string | null;
  evohub_channel_id?: string | null;
}

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

export default function EditSellerModal({ seller, onClose, onUpdated }: { seller: Seller; onClose: () => void; onUpdated: () => void }) {
  const [name, setName] = useState(seller.name);
  const [email, setEmail] = useState(seller.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(seller.role);
  const [selectedChannel, setSelectedChannel] = useState(seller.evohub_channel_id || "");
  const [isActive, setIsActive] = useState(seller.is_active);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(seller.avatar_url);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [phoneMap, setPhoneMap] = useState<Record<string, PhoneMapEntry>>({});
  const [loadingChannels, setLoadingChannels] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleSave = async () => {
    setSaving(true);
    const body: any = { name, role, is_active: isActive, evohub_channel_id: selectedChannel || null };
    if (email) body.email = email;
    if (password) body.password = password;
    if (avatarUrl !== seller.avatar_url) body.avatar_url = avatarUrl;

    const res = await fetch(`/api/sellers/${seller.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { toast.error("Erro ao salvar"); setSaving(false); return; }
    toast.success("Vendedor atualizado!");
    onUpdated();
    onClose();
  };

  const handleDelete = async () => {
    if (!confirm(`Tem certeza que deseja excluir ${seller.name}?`)) return;
    const res = await fetch(`/api/sellers/${seller.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Erro ao excluir"); return; }
    toast.success("Vendedor excluído!");
    onUpdated();
    onClose();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", seller.id);

    const res = await fetch("/api/sellers/upload-avatar", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) { toast.error("Erro no upload"); setUploading(false); return; }
    setAvatarUrl(data.url);
    setUploading(false);
    toast.success("Foto enviada!");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Editar vendedor</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              )}
            </div>
            <button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center hover:bg-green-500 transition text-sm" title="Alterar foto">
              {uploading ? <span className="animate-spin">⟳</span> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Nome</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Nova senha (opcional)</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Deixe em branco para manter" className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none" />
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
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-600 dark:text-gray-300">Ativo</span>
          </label>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={handleDelete} className="px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl">Excluir</button>
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-500 rounded-xl disabled:opacity-50">{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}
