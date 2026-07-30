"use client";

import { useEffect, useState } from "react";
import CreateOperationModal from "@/components/operations/CreateOperationModal";
import EditOperationModal from "@/components/operations/EditOperationModal";
import toast from "react-hot-toast";

export default function OperacoesPage() {
  const [operations, setOperations] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const fetchOps = async () => {
    const res = await fetch("/api/operations");
    const data = await res.json();
    setOperations(Array.isArray(data) ? data : []);
  };

  useEffect(() => { fetchOps(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/operations/${deleteTarget.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Erro ao excluir"); return; }
    toast.success("Operação excluída!");
    setDeleteTarget(null);
    fetchOps();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Operações</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{operations.length} operações</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition shadow-lg shadow-emerald-500/25 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nova operação
        </button>
      </div>

      {operations.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">Nenhuma operação criada</p>
          <p className="text-sm mt-1">Crie sua primeira operação para começar a organizar os números</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {operations.map((op) => {
            const channels = op.channels || [];
            const activeCount = channels.filter((c: any) => c.phone_number_id).length;
            return (
              <div key={op.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden hover:shadow-md transition-all">
                {/* Header com cor */}
                <div className="h-1.5" style={{ backgroundColor: op.color }} />

                <div className="p-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="w-3.5 h-3.5 rounded-lg flex-shrink-0" style={{ backgroundColor: op.color }} />
                    <h3 className="font-bold text-gray-900 dark:text-white text-base">{op.name}</h3>
                    <span className="text-[11px] text-gray-400 font-mono ml-auto">{op.slug}</span>
                  </div>

                  <div className="flex items-center gap-4 text-sm mb-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400">Números:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{channels.length}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400">Ativos:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{activeCount}</span>
                    </div>
                  </div>

                  {channels.length > 0 ? (
                    <div className="space-y-1">
                      {channels.map((ch: any) => (
                        <div key={ch.id} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
                          <span className="text-gray-700 dark:text-gray-300 font-medium truncate">{ch.evohub_channel_name}</span>
                          {ch.phone_number_id ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 flex-shrink-0 ml-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Ativo
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-gray-400 flex-shrink-0 ml-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                              Pendente
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 py-2">Nenhum número vinculado</p>
                  )}
                </div>

                <div className="flex border-t border-gray-100 dark:border-gray-800">
                  <button onClick={() => setEditing(op)} className="flex-1 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">Editar</button>
                  <button onClick={() => setDeleteTarget(op)} className="flex-1 py-2.5 text-xs font-medium text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition border-l border-gray-100 dark:border-gray-800">Excluir</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreateOperationModal onClose={() => setShowCreate(false)} onCreated={fetchOps} />}
      {editing && <EditOperationModal operation={editing} onClose={() => setEditing(null)} onUpdated={fetchOps} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl p-6">
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-600/20 flex items-center justify-center"><svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg></div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Excluir {deleteTarget.name}?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Esta ação não pode ser desfeita.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
