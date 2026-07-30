"use client";

import { useState, useCallback, useEffect } from "react";
import CreateChannelModal from "@/components/whatsapp/CreateChannelModal";
import toast from "react-hot-toast";

interface Channel {
  id: string;
  name: string;
  type: string;
  status: string;
  token: string;
  displayPhone?: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; bg: string }> = {
  active: { label: "Conectado", color: "text-emerald-400", dot: "bg-emerald-400", bg: "bg-emerald-500/10" },
  inactive: { label: "Pendente", color: "text-amber-400", dot: "bg-amber-400", bg: "bg-amber-500/10" },
  connecting: { label: "Conectando", color: "text-sky-400", dot: "bg-sky-400 animate-pulse", bg: "bg-sky-500/10" },
  banned: { label: "Banido", color: "text-red-400", dot: "bg-red-400", bg: "bg-red-500/10" },
  disconnected: { label: "Desconectado", color: "text-gray-400", dot: "bg-gray-400", bg: "bg-gray-500/10" },
  archived: { label: "Arquivado", color: "text-gray-500", dot: "bg-gray-500", bg: "bg-gray-500/10" },
};

function getStatus(status: string) {
  return STATUS_CONFIG[status] || { label: status, color: "text-gray-400", dot: "bg-gray-400", bg: "bg-gray-500/10" };
}

export default function WhatsappPageClient({
  initialChannels,
  phoneMap: initialPhoneMap,
}: {
  initialChannels: Channel[];
  phoneMap: Record<string, { phoneId: string; opName: string; opColor: string; opId: string }>;
}) {
  const [showModal, setShowModal] = useState(false);
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [phoneMap, setPhoneMap] = useState(initialPhoneMap);
  const [deleteTarget, setDeleteTarget] = useState<Channel | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [operations, setOperations] = useState<{ id: string; name: string; color: string }[]>([]);

  const fetchChannels = useCallback(async () => {
    const res = await fetch("/api/evohub/channels");
    if (res.ok) {
      const data = await res.json();
      if (data.channels?.length > 0) setChannels(data.channels);
      if (data.phoneMap) setPhoneMap(data.phoneMap);
    }
  }, []);

  useEffect(() => { fetchChannels(); fetch("/api/operations").then(r => r.json()).then(setOperations); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch("/api/evohub/delete-channel", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId: deleteTarget.id }) });
    if (!res.ok) { toast.error("Erro ao excluir"); setDeleting(false); return; }
    toast.success("Instância excluída!");
    setChannels(prev => prev.filter(c => c.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
  };

  const changeOperation = async (channelId: string, newOpId: string, channelName: string) => {
    const current = phoneMap[channelId];
    const res = await fetch(`/api/operations/${newOpId}/channels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evohub_channel_id: channelId, evohub_channel_name: channelName, phone_number_id: current?.phoneId || null }),
    });
    if (!res.ok) { toast.error("Erro ao trocar"); return; }
    toast.success("Operação alterada!");
    fetchChannels();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">WhatsApps</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{channels.length} instâncias conectadas</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition shadow-lg shadow-emerald-500/25">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Conectar WhatsApp
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {channels.map((ch) => {
          const st = getStatus(ch.status);
          const isActive = ch.status === "active";
          const link = `https://app.evohub.evolutionfoundation.com.br/connect/${ch.token}`;
          const m = phoneMap[ch.id];
          const phone = (ch as any).displayPhone;
          const opName = m?.opName;

          return (
            <div key={ch.id} className="group rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-700 transition-all">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold ${isActive ? "bg-emerald-500/10 text-emerald-500" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-[15px]">{ch.name}</h3>
                    <p className="text-[11px] text-gray-400 font-mono">{ch.id.substring(0, 8)}...</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2.5 py-1 ${st.bg} ${st.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                  {st.label}
                </span>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
                {phone && (
                  <div className="col-span-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Telefone</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{phone}</p>
                  </div>
                )}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Tipo</p>
                  <p className="font-medium text-gray-700 dark:text-gray-300 capitalize">{ch.type}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Criado</p>
                  <p className="font-medium text-gray-700 dark:text-gray-300">{new Date(ch.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                {m?.phoneId && (
                  <div className="col-span-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Phone ID</p>
                    <p className="font-mono text-[11px] text-gray-500 dark:text-gray-400">{m.phoneId}</p>
                  </div>
                )}
              </div>

              {/* Operação */}
              <div className="mt-3 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400">Operação</span>
                  {opName ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: m.opColor }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.opColor }} />
                      {opName}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </div>
                <select
                  value=""
                  onChange={(e) => e.target.value && changeOperation(ch.id, e.target.value, ch.name)}
                  className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-transparent border-0 cursor-pointer hover:underline focus:outline-none focus:ring-0"
                >
                  <option value="">+ Vincular</option>
                  {operations.filter(o => o.id !== m?.opId).map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                {!isActive && (
                  <>
                    <a href={link} target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-[11px] font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                      Abrir link
                    </a>
                    <button onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado!"); }} className="flex-1 text-center text-[11px] font-medium text-emerald-600 dark:text-emerald-400 py-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition">
                      Copiar link
                    </button>
                  </>
                )}
                {isActive && <div className="flex-1 text-center text-[11px] text-gray-400 py-1.5">Conectado via Meta</div>}
                <button onClick={() => setDeleteTarget(ch)} className="px-3 py-1.5 text-[11px] font-medium text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition" title="Excluir">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl p-6">
            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-600/20 flex items-center justify-center"><svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg></div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Excluir instância?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Isso excluirá <strong>{deleteTarget.name}</strong> permanentemente da EvoHub.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Cancelar</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50">{deleting ? "Excluindo..." : "Sim, excluir"}</button>
            </div>
          </div>
        </div>
      )}

      {showModal && <CreateChannelModal onClose={() => setShowModal(false)} onCreated={() => { fetchChannels(); setShowModal(false); }} />}
    </div>
  );
}
