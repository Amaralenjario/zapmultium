"use client";

import { useState, useCallback, useEffect } from "react";
import CreateChannelModal from "@/components/whatsapp/CreateChannelModal";
import toast from "react-hot-toast";

interface Channel {
  id: string;
  name: string;
  status: string;
  token: string;
  displayPhone?: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  active: { label: "Conectado", dot: "bg-emerald-400", bg: "bg-emerald-500/10", text: "text-emerald-400" },
  inactive: { label: "Pendente", dot: "bg-amber-400", bg: "bg-amber-500/10", text: "text-amber-400" },
  connecting: { label: "Conectando", dot: "bg-sky-400 animate-pulse", bg: "bg-sky-500/10", text: "text-sky-400" },
  banned: { label: "Banido", dot: "bg-red-400", bg: "bg-red-500/10", text: "text-red-400" },
  disconnected: { label: "Desconectado", dot: "bg-gray-400", bg: "bg-gray-500/10", text: "text-gray-400" },
};

function getStatus(s: string) { return STATUS_CONFIG[s] || { label: s, dot: "bg-gray-400", bg: "bg-gray-500/10", text: "text-gray-400" }; }

function daysAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
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
    if (!res.ok) { toast.error("Erro"); setDeleting(false); return; }
    toast.success("Excluída!");
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
    if (!res.ok) { toast.error("Erro"); return; }
    toast.success("Operação alterada!");
    fetchChannels();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">WhatsApps</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{channels.length} instâncias</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition shadow-lg shadow-emerald-500/25">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Conectar WhatsApp
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {channels.map((ch) => {
          const st = getStatus(ch.status);
          const isActive = ch.status === "active";
          const link = `https://app.evohub.evolutionfoundation.com.br/connect/${ch.token}`;
          const m = phoneMap[ch.id];
          const phone = (ch as any).displayPhone;
          const opName = m?.opName;
          const days = daysAgo(ch.created_at);

          return (
            <div key={ch.id} className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md transition-all">
              {/* Top: nome + status */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? "bg-emerald-500/10 text-emerald-500" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{ch.name}</p>
                </div>
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 flex-shrink-0 ml-2 ${st.bg} ${st.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                  {st.label}
                </span>
              </div>

              {/* Info */}
              <div className="space-y-2 text-sm">
                {phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Telefone</span>
                    <span className="font-semibold text-gray-900 dark:text-white text-xs">{phone}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">Operação</span>
                  <div className="flex items-center gap-1.5">
                    {opName ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: m.opColor }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.opColor }} />
                        {opName}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                    <select value="" onChange={(e) => e.target.value && changeOperation(ch.id, e.target.value, ch.name)} className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-transparent border-0 cursor-pointer hover:underline focus:outline-none p-0">
                      <option value="">Trocar</option>
                      {operations.filter(o => o.id !== m?.opId).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">Criado</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(ch.created_at).toLocaleDateString("pt-BR")}
                    <span className="text-gray-400 ml-1">· {days} dia{days > 1 ? "s" : ""}</span>
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-50 dark:border-gray-800/50">
                {!isActive ? (
                  <>
                    <a href={link} target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-[11px] font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 py-1 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">Abrir link</a>
                    <button onClick={() => { navigator.clipboard.writeText(link); toast.success("Copiado!"); }} className="flex-1 text-center text-[11px] font-medium text-emerald-600 dark:text-emerald-400 py-1 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition">Copiar link</button>
                  </>
                ) : (
                  <span className="flex-1 text-center text-[11px] text-gray-400 py-1">{days} dia{days > 1 ? "s" : ""} ativo</span>
                )}
                <button onClick={() => setDeleteTarget(ch)} className="px-2 py-1 text-[11px] text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition flex-shrink-0" title="Excluir">Excluir</button>
              </div>
            </div>
          );
        })}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl p-6">
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-600/20 flex items-center justify-center"><svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg></div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Excluir {deleteTarget.name}?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Esta ação é permanente e não pode ser desfeita.</p>
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
