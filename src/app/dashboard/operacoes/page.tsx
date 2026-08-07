"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Building2, AlertTriangle, Braces } from "lucide-react";
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
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-tx">Operações</h1>
          <p className="text-tx2 text-sm mt-0.5">{operations.length} {operations.length === 1 ? "operação" : "operações"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/operacoes/api" className="rounded-control border border-bd bg-surface px-4 py-2.5 text-sm font-bold text-tx2 hover:text-accent hover:border-accent/40 transition flex items-center gap-2">
            <Braces className="w-4 h-4" strokeWidth={2.2} /> API
          </Link>
          <button onClick={() => setShowCreate(true)} className="rounded-control bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-accent2 transition flex items-center gap-2">
            <Plus className="w-4 h-4" strokeWidth={2.2} /> Nova operação
          </button>
        </div>
      </div>

      {operations.length === 0 ? (
        <div className="text-center py-20 text-tx3 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-accentsoft flex items-center justify-center mb-4"><Building2 className="w-8 h-8 text-accent" strokeWidth={1.6} /></div>
          <p className="text-lg font-bold text-tx2">Nenhuma operação criada</p>
          <p className="text-sm mt-1">Crie sua primeira operação para organizar os números</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {operations.map((op) => {
            const channels = op.channels || [];
            const activeCount = channels.filter((c: any) => c.phone_number_id).length;
            return (
              <div key={op.id} className="rounded-card border border-bd bg-surface overflow-hidden hover:shadow-pop transition-all">
                <div className="h-1.5" style={{ backgroundColor: op.color }} />
                <div className="p-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="w-8 h-8 rounded-control flex items-center justify-center flex-shrink-0" style={{ backgroundColor: op.color + "1f" }}>
                      <Building2 className="w-4 h-4" strokeWidth={2} style={{ color: op.color }} />
                    </span>
                    <h3 className="font-extrabold text-tx text-base truncate">{op.name}</h3>
                    <span className="text-[11px] text-tx3 font-mono ml-auto flex-shrink-0">{op.slug}</span>
                  </div>

                  <div className="flex items-center gap-4 text-sm mb-4">
                    <div className="flex items-center gap-1.5"><span className="text-tx3 text-xs">Números:</span><span className="font-bold text-tx">{channels.length}</span></div>
                    <div className="flex items-center gap-1.5"><span className="text-tx3 text-xs">Ativos:</span><span className="font-bold text-success">{activeCount}</span></div>
                  </div>

                  {channels.length > 0 ? (
                    <div className="space-y-1">
                      {channels.map((ch: any) => (
                        <div key={ch.id} className="flex items-center justify-between text-xs bg-surface2 rounded-lg px-3 py-2">
                          <span className="text-tx2 font-semibold truncate">{ch.evohub_channel_name}</span>
                          {ch.phone_number_id ? (
                            <span className="flex items-center gap-1 text-success flex-shrink-0 ml-2 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-success" /> Ativo</span>
                          ) : (
                            <span className="flex items-center gap-1 text-tx3 flex-shrink-0 ml-2 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-tx3" /> Pendente</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-tx3 py-2">Nenhum número vinculado</p>
                  )}
                </div>

                <div className="flex border-t border-line">
                  <button onClick={() => setEditing(op)} className="flex-1 py-2.5 text-xs font-bold text-tx2 hover:bg-hover hover:text-tx transition flex items-center justify-center gap-1.5"><Pencil className="w-3.5 h-3.5" strokeWidth={2} /> Editar</button>
                  <button onClick={() => setDeleteTarget(op)} className="flex-1 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/10 hover:text-red-500 transition border-l border-line flex items-center justify-center gap-1.5"><Trash2 className="w-3.5 h-3.5" strokeWidth={2} /> Excluir</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreateOperationModal onClose={() => setShowCreate(false)} onCreated={fetchOps} />}
      {editing && <EditOperationModal operation={editing} onClose={() => setEditing(null)} onUpdated={fetchOps} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-sm rounded-card border border-bd bg-surface shadow-pop p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/12 flex items-center justify-center"><AlertTriangle className="w-6 h-6 text-red-500" strokeWidth={2} /></div>
              <h3 className="text-lg font-bold text-tx">Excluir {deleteTarget.name}?</h3>
              <p className="text-sm text-tx2 mt-1">Esta ação não pode ser desfeita.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 rounded-control border border-bd px-4 py-2.5 text-sm font-semibold text-tx2 hover:bg-hover transition">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 rounded-control bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-500 transition">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
