"use client";

import { useEffect, useState, useRef } from "react";
import { Camera, Loader2, Check, User } from "lucide-react";
import toast from "react-hot-toast";

const roleLabels: Record<string, string> = { admin: "Administrador", supervisor: "Supervisor", operator: "Vendedor", seller: "Vendedor" };

export default function PerfilPage() {
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/profile").then(r => r.json()).then(d => { setProfile(d); setName(d.full_name || ""); setAvatarUrl(d.avatar_url || null); }).catch(() => {});
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("userId", profile.id);
    const res = await fetch("/api/sellers/upload-avatar", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) { toast.error("Erro no upload"); setUploading(false); return; }
    setAvatarUrl(data.url);
    setUploading(false);
    // reflete na hora no menu lateral
    window.dispatchEvent(new CustomEvent("profile-updated", { detail: { avatar_url: data.url } }));
    toast.success("Foto atualizada!");
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ full_name: name.trim(), avatar_url: avatarUrl }) });
    if (!res.ok) { toast.error("Erro ao salvar"); setSaving(false); return; }
    toast.success("Perfil atualizado!");
    setSaving(false);
    // reflete na hora no menu lateral (avatar/nome), sem recarregar a página
    window.dispatchEvent(new CustomEvent("profile-updated", { detail: { full_name: name.trim(), avatar_url: avatarUrl } }));
  };

  const initials = (name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-tx mb-1">Meu perfil</h1>
      <p className="text-tx2 text-sm mb-6">Personalize seu nome e sua foto de perfil</p>

      <div className="rounded-card border border-bd bg-surface p-6">
        {/* Foto */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            <div className="w-28 h-28 rounded-full overflow-hidden bg-accentsoft flex items-center justify-center ring-1 ring-bd">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-extrabold text-accent">{initials}</span>
              )}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center shadow-glow hover:bg-accent2 transition disabled:opacity-60" title="Alterar foto">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.2} /> : <Camera className="w-4 h-4" strokeWidth={2} />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </div>
          <p className="text-xs text-tx3 mt-3">Clique na câmera para enviar uma foto</p>
        </div>

        {/* Campos */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-tx2 mb-1.5">Nome</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className="w-full rounded-control border border-bd bg-surface2 px-4 py-2.5 text-tx placeholder:text-tx3 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-tx2 mb-1.5">Email</label>
            <div className="flex items-center gap-2 rounded-control border border-bd bg-surface2 px-4 py-2.5 text-tx3">
              <User className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
              <span className="text-sm truncate">{profile?.email || "—"}</span>
              {profile?.role && <span className="ml-auto text-[11px] font-bold text-accent bg-accentsoft rounded-full px-2 py-0.5 flex-shrink-0">{roleLabels[profile.role] || profile.role}</span>}
            </div>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving || !name.trim()} className="w-full mt-6 rounded-control bg-accent px-4 py-3 text-sm font-bold text-white shadow-glow hover:bg-accent2 disabled:opacity-50 transition flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.2} /> : <Check className="w-4 h-4" strokeWidth={2.5} />}
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </div>
  );
}
