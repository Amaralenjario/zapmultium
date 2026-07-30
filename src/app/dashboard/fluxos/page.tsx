"use client";

import { useEffect, useState } from "react";
import FlowBuilder from "@/components/flows/FlowBuilder";
import toast from "react-hot-toast";

interface Flow {
  id: string;
  name: string;
  status: string;
  trigger_type: string;
  config: any;
  created_at: string;
  updated_at: string;
}

export default function FluxosPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [editing, setEditing] = useState<Flow | null>(null);
  const [creating, setCreating] = useState(false);
  const [nameModal, setNameModal] = useState(false);
  const [newFlowName, setNewFlowName] = useState("");

  const handleCreate = async () => {
    if (!newFlowName.trim()) return;
    setNameModal(false);

    const res = await fetch("/api/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFlowName.trim(), config: { steps: [] } }),
    });

    if (!res.ok) { toast.error("Erro ao criar"); return; }
    const flow = await res.json();
    toast.success("Fluxo criado!");
    setNewFlowName("");
    setEditing(flow);
    fetchFlows();
  };

  const fetchFlows = async () => {
    const res = await fetch("/api/flows");
    setFlows(await res.json());
  };

  useEffect(() => { fetchFlows(); }, []);

  const handleSave = async (steps: any[]) => {
    const url = editing ? `/api/flows/${editing.id}` : "/api/flows";
    const method = editing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editing?.name, config: { steps } }),
    });

    if (!res.ok) { toast.error("Erro ao salvar"); return; }
    toast.success(editing ? "Fluxo atualizado!" : "Fluxo criado!");
    setEditing(null);
    fetchFlows();
  };

  const handleDelete = async (flow: Flow) => {
    if (!confirm(`Excluir "${flow.name}"?`)) return;
    await fetch(`/api/flows/${flow.id}`, { method: "DELETE" });
    toast.success("Excluído!");
    fetchFlows();
  };

  if (editing) {
    return (
      <div>
        <button onClick={() => setEditing(null)} className="mb-4 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Voltar para fluxos
        </button>
        <FlowBuilder
          initialSteps={editing.config?.steps || [{ id: "start", type: "start", label: "Início", config: {} }]}
          onSave={handleSave}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fluxos</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{flows.length} fluxo{flows.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setNameModal(true)} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition shadow-lg shadow-emerald-500/25 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Novo fluxo
        </button>
      </div>

      {flows.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          <p className="text-lg">Nenhum fluxo criado</p>
          <p className="text-sm mt-1">Crie seu primeiro fluxo de atendimento automatizado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {flows.map((flow) => (
            <div key={flow.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition cursor-pointer" onClick={() => setEditing(flow)}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{flow.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(flow.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  flow.status === "active" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" :
                  flow.status === "draft" ? "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400" :
                  "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                }`}>
                  {flow.status === "active" ? "Ativo" : flow.status === "draft" ? "Rascunho" : "Inativo"}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{flow.trigger_type}</span>
                <span>{(flow.config?.steps?.length || 1) - 1} etapa(s)</span>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button onClick={(e) => { e.stopPropagation(); setEditing(flow); }} className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Editar</button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(flow); }} className="text-xs font-medium text-red-400 hover:text-red-500">Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {nameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Novo fluxo</h2>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">Nome do fluxo</label>
            <input
              type="text"
              value={newFlowName}
              onChange={(e) => setNewFlowName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Ex: Boas-vindas automático"
              autoFocus
              className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
            />
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setNameModal(false); setNewFlowName(""); }} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Cancelar</button>
              <button onClick={handleCreate} disabled={!newFlowName.trim()} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">Criar fluxo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
