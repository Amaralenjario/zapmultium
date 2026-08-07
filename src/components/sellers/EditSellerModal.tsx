"use client";

import { useState, useRef, useEffect } from "react";
import { X, Camera, Loader2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

const ROLES = ["operator", "supervisor", "admin"];
const roleLabel = (r: string) => r === "admin" ? "Administrador" : r === "supervisor" ? "Supervisor" : "Vendedor";

interface Seller { id: string; name: string; email: string; avatar_url: string | null; role: string; is_active: boolean; instancia: string | null; evohub_channel_id?: string | null; }
interface Channel { id: string; name: string; displayPhone?: string; metadata?: { meta_connection?: { phone_number?: string } }; }
interface PhoneMapEntry { phoneId: string; opName: string; opColor: string; }

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
    fetch("/api/evohub/channels").then((r) => r.json()).then((data) => { setChannels(data.channels || []); setPhoneMap(data.phoneMap || {}); }).catch(() => {}).finally(() => setLoadingChannels(false));
  }, []);

  const getChannelLabel = (ch: Channel) => {
    const pm = phoneMap[ch.id];
    const displayNumber = ch.displayPhone || ch.metadata?.meta_connection?.phone_number || "";
    if (pm?.opName) return displayNumber ? `${pm.opName} - ${displayNumber}` : `${pm.opName} (${ch.name})`;
    if (displayNumber) return `${ch.name} - ${displayNumber}`;
    return ch.name;
  };

  const handleSave = async () => {
    setSaving(true);
    const body: any = { name, role, is_active: isActive, evohub_channel_id: selectedChannel || null };
    if (email) body.email = email;
    if (password) body.password = password;
    if (avatarUrl !== seller.avatar_url) body.avatar_url = avatarUrl;
    const res = await fetch(`/api/sellers/${seller.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { toast.error("Erro ao salvar"); setSaving(false); return; }
    toast.success("Vendedor atualizado!");
    onUpdated(); onClose();
  };

  const handleDelete = async () => {
    if (!confirm(`Tem certeza que deseja excluir ${seller.name}?`)) return;
    const res = await fetch(`/api/sellers/${seller.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Erro ao excluir"); return; }
    toast.success("Vendedor excluído!");
    onUpdated(); onClose();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file); fd.append("userId", seller.id);
    const res = await fetch("/api/sellers/upload-avatar", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) { toast.error("Erro no upload"); setUploading(false); return; }
    setAvatarUrl(data.url); setUploading(false);
    toast.success("Foto enviada!");
  };

  const initials = (name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const inputCls = "w-full rounded-control border border-bd bg-surface2 px-4 py-2.5 text-sm text-tx placeholder:text-tx3 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-card border border-bd bg-surface shadow-pop p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-tx">Editar vendedor</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-tx3 hover:text-tx hover:bg-hover transition"><X className="w-5 h-5" strokeWidth={2} /></button>
        </div>

        <div className="flex justify-center mb-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-accentsoft flex items-center justify-center overflow-hidden ring-1 ring-bd">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : <span className="text-xl font-extrabold text-accent">{initials}</span>}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center shadow-glow hover:bg-accent2 transition disabled:opacity-60" title="Alterar foto">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.2} /> : <Camera className="w-4 h-4" strokeWidth={2} />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </div>
        </div>

        <div className="space-y-3">
          <div><label className="block text-sm font-semibold text-tx2 mb-1">Nome</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></div>
          <div><label className="block text-sm font-semibold text-tx2 mb-1">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></div>
          <div><label className="block text-sm font-semibold text-tx2 mb-1">Nova senha (opcional)</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Deixe em branco para manter" className={inputCls} /></div>
          <div><label className="block text-sm font-semibold text-tx2 mb-1">Função</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>{ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</select>
          </div>
          <div><label className="block text-sm font-semibold text-tx2 mb-1">Instância WhatsApp</label>
            {loadingChannels ? (
              <div className="flex items-center gap-2 py-2.5 text-sm text-tx3"><Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} /> Carregando canais...</div>
            ) : (
              <select value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)} className={inputCls}>
                <option value="">Nenhuma (sem acesso a conversas)</option>
                {channels.map((ch) => <option key={ch.id} value={ch.id}>{getChannelLabel(ch)}</option>)}
              </select>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 accent-[color:var(--accent)]" />
            <span className="text-sm font-semibold text-tx2">Ativo</span>
          </label>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button onClick={handleDelete} className="p-2.5 text-red-500 hover:bg-red-500/10 rounded-control transition" title="Excluir vendedor"><Trash2 className="w-4 h-4" strokeWidth={2} /></button>
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-tx2 border border-bd rounded-control hover:bg-hover transition">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 text-sm font-bold text-white bg-accent shadow-glow hover:bg-accent2 rounded-control disabled:opacity-50 transition">{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}
