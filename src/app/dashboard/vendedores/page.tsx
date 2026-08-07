"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Headset } from "lucide-react";
import Avatar from "@/components/chat/Avatar";
import CreateSellerModal from "@/components/sellers/CreateSellerModal";
import EditSellerModal from "@/components/sellers/EditSellerModal";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface Seller {
  id: string; name: string; email: string; avatar_url: string | null;
  role: string; is_active: boolean; instancia: string | null;
  evohub_channel_id?: string | null; created_at: string;
}
interface ChannelOption { id: string; label: string; }

const roleMeta: Record<string, { label: string; cls: string }> = {
  admin: { label: "Administrador", cls: "bg-red-500/12 text-red-600 dark:text-red-400" },
  supervisor: { label: "Supervisor", cls: "bg-violet-500/12 text-violet-600 dark:text-violet-400" },
  operator: { label: "Vendedor", cls: "bg-accentsoft text-accent" },
};

export default function VendedoresPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Seller | null>(null);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const supabaseClient = createClient();

  const fetchSellers = async () => {
    const res = await fetch("/api/sellers");
    const data = await res.json();
    if (Array.isArray(data)) setSellers(data);
  };

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/evohub/channels");
      const data = await res.json();
      const chans = data.channels || [];
      const pm = data.phoneMap || {};
      setChannels(chans.map((ch: any) => {
        const p = pm[ch.id];
        const display = ch.displayPhone || ch.metadata?.meta_connection?.phone_number || "";
        const label = p?.opName ? (display ? `${p.opName} - ${display}` : `${p.opName} (${ch.name})`) : (display ? `${ch.name} - ${display}` : ch.name);
        return { id: ch.id, label };
      }));
    } catch {}
  }, []);

  useEffect(() => { fetchSellers(); fetchChannels(); }, [fetchChannels]);

  const handleDelete = async (seller: Seller) => {
    if (!confirm(`Excluir "${seller.name}" permanentemente?`)) return;
    const res = await fetch(`/api/sellers/${seller.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Erro ao excluir"); return; }
    toast.success("Vendedor excluído!");
    fetchSellers();
  };

  const handleAssignChannel = async (sellerId: string, channelId: string) => {
    setSellers((prev) => prev.map((s) => s.id === sellerId ? { ...s, evohub_channel_id: channelId || null } : s));
    const { error } = await supabaseClient.from("seller_channels").delete().eq("user_id", sellerId);
    if (error) { toast.error(`Erro: ${error.message}`); fetchSellers(); return; }
    if (channelId) {
      const { error: insErr } = await supabaseClient.from("seller_channels").insert({ user_id: sellerId, evohub_channel_id: channelId });
      if (insErr) { toast.error(`Erro: ${insErr.message}`); fetchSellers(); return; }
    }
    toast.success("Instância vinculada!");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-tx">Vendedores</h1>
          <p className="text-tx2 text-sm mt-0.5">{sellers.length} {sellers.length === 1 ? "vendedor cadastrado" : "vendedores cadastrados"}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="rounded-control bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-accent2 transition flex items-center gap-2">
          <Plus className="w-4 h-4" strokeWidth={2.2} /> Novo vendedor
        </button>
      </div>

      <div className="rounded-card border border-bd bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-bd bg-surface2 text-[10px] font-bold uppercase tracking-[0.06em] text-tx3">
                <th className="text-left p-4">Vendedor</th>
                <th className="text-left p-4">Email</th>
                <th className="text-left p-4">Função</th>
                <th className="text-left p-4">Instância</th>
                <th className="text-left p-4">Status</th>
                <th className="text-right p-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((s) => {
                const rm = roleMeta[s.role] || { label: s.role, cls: "bg-surface2 text-tx2" };
                return (
                  <tr key={s.id} className="border-b border-line last:border-0 hover:bg-rowhover transition">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.name} url={s.avatar_url} size="sm" />
                        <p className="font-bold text-tx truncate">{s.name}</p>
                      </div>
                    </td>
                    <td className="p-4 text-tx2">{s.email || "—"}</td>
                    <td className="p-4"><span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${rm.cls}`}>{rm.label}</span></td>
                    <td className="p-4">
                      <select value={s.evohub_channel_id || ""} onChange={(e) => handleAssignChannel(s.id, e.target.value)} className="rounded-control border border-bd bg-surface2 px-2.5 py-1.5 text-xs text-tx focus:border-accent focus:ring-1 focus:ring-accent/20 focus:outline-none max-w-[220px]">
                        <option value="">Nenhuma</option>
                        {channels.map((ch) => <option key={ch.id} value={ch.id}>{ch.label}</option>)}
                      </select>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${s.is_active ? "text-success" : "text-tx3"}`}>
                        <span className={`w-2 h-2 rounded-full ${s.is_active ? "bg-success" : "bg-tx3"}`} />{s.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditing(s)} className="p-1.5 rounded-lg text-tx3 hover:text-accent hover:bg-accentsoft transition" title="Editar"><Pencil className="w-4 h-4" strokeWidth={2} /></button>
                        <button onClick={() => handleDelete(s)} className="p-1.5 rounded-lg text-tx3 hover:text-red-500 hover:bg-red-500/10 transition" title="Excluir"><Trash2 className="w-4 h-4" strokeWidth={2} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sellers.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-14 text-center text-tx3">
                    <Headset className="w-12 h-12 mx-auto mb-3 opacity-30" strokeWidth={1.5} />
                    <p className="font-semibold text-tx2">Nenhum vendedor cadastrado</p>
                    <p className="text-sm mt-1">Clique em &ldquo;Novo vendedor&rdquo; para começar</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <CreateSellerModal onClose={() => setShowCreate(false)} onCreated={fetchSellers} />}
      {editing && <EditSellerModal seller={editing} onClose={() => setEditing(null)} onUpdated={fetchSellers} />}
    </div>
  );
}
