"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import CreateChannelModal from "@/components/whatsapp/CreateChannelModal";
import toast from "react-hot-toast";

interface Channel {
  id: string;
  name: string;
  type: string;
  status: string;
  token: string;
  external_id: string | null;
  metadata: {
    meta_connection?: {
      phone_number?: string;
      phone_number_id?: string;
      waba_id?: string;
      display_name?: string;
    };
  };
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  active: { label: "Conectado", color: "text-green-600 dark:text-green-400", dot: "bg-green-500" },
  inactive: { label: "Pendente", color: "text-yellow-600 dark:text-yellow-400", dot: "bg-yellow-500" },
  connecting: { label: "Conectando...", color: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500 animate-pulse" },
  banned: { label: "Banido", color: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
  disconnected: { label: "Desconectado", color: "text-gray-500", dot: "bg-gray-400" },
  archived: { label: "Arquivado", color: "text-gray-400", dot: "bg-gray-300" },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || { label: status, color: "text-gray-400", dot: "bg-gray-400" };
}

export default function WhatsappPageClient({ initialChannels }: { initialChannels: Channel[] }) {
  const [showModal, setShowModal] = useState(false);
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [deleteTarget, setDeleteTarget] = useState<Channel | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const handleCreated = useCallback(() => {
    router.refresh();
  }, [router]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Link copiado!");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch("/api/evohub/delete-channel", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: deleteTarget.id }),
    });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error?.message || "Erro ao excluir");
      setDeleting(false);
      return;
    }
    toast.success("Instância excluída!");
    setChannels((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">WhatsApps</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {channels.length} conex{channels.length === 1 ? "ão" : "ões"} no EvoHub
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 transition flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Conectar WhatsApp
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {channels.map((ch) => {
          const statusCfg = getStatusConfig(ch.status);
          const isActive = ch.status === "active";
          const link = `https://app.evohub.ai/connect/${ch.token}`;

          return (
            <div key={ch.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden hover:shadow-md transition">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      isActive ? "bg-green-100 dark:bg-green-600/20" : "bg-gray-100 dark:bg-gray-800"
                    }`}>
                      <svg className={`w-6 h-6 ${isActive ? "text-green-600 dark:text-green-400" : "text-gray-400 dark:text-gray-500"}`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{ch.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{ch.id.substring(0, 8)}...</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusCfg.color}`}>
                    <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
                    {statusCfg.label}
                  </span>
                </div>

                <div className="space-y-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 dark:text-gray-500">Tipo</span>
                    <span className="font-medium text-gray-900 dark:text-white capitalize">{ch.type}</span>
                  </div>
                  {(ch.metadata as any)?.meta_connection?.phone_number && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400 dark:text-gray-500">Número</span>
                      <span className="font-medium text-gray-900 dark:text-white text-xs">
                        {(ch.metadata as any).meta_connection.phone_number}
                      </span>
                    </div>
                  )}
                  {(ch.metadata as any)?.meta_connection?.waba_id && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400 dark:text-gray-500">BM (WABA)</span>
                      <span className="font-medium text-gray-900 dark:text-white text-xs font-mono">
                        {(ch.metadata as any).meta_connection.waba_id}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 dark:text-gray-500">Criado em</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {new Date(ch.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex border-t border-gray-100 dark:border-gray-800">
                {!isActive ? (
                  <>
                    <a href={link} target="_blank" rel="noopener noreferrer" className="flex-1 py-2.5 text-xs font-medium text-center text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                      Abrir link
                    </a>
                    <button onClick={() => copyToClipboard(link)} className="flex-1 py-2.5 text-xs font-medium text-center text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 transition border-l border-gray-100 dark:border-gray-800">
                      Copiar link
                    </button>
                  </>
                ) : (
                  <div className="flex-1 py-2.5 text-xs text-center text-gray-400">
                    Conectado via Meta
                  </div>
                )}
                <button
                  onClick={() => setDeleteTarget(ch)}
                  className="py-2.5 px-3 text-xs font-medium text-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition border-l border-gray-100 dark:border-gray-800"
                  title="Excluir instância"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de confirmação de exclusão */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl p-6">
            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-600/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Excluir instância?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Isso excluirá <strong className="text-gray-700 dark:text-gray-300">{deleteTarget.name}</strong> permanentemente da EvoHub. Esta ação não pode ser desfeita.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition"
              >
                {deleting ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && <CreateChannelModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
    </div>
  );
}
