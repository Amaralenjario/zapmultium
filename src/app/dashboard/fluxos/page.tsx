"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
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
  const [tab, setTab] = useState<"flows" | "logs">("flows");
  const [executions, setExecutions] = useState<any[]>([]);
  const [logsFilter, setLogsFilter] = useState("all");
  const [importModal, setImportModal] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [bulkImportModal, setBulkImportModal] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [zvImporting, setZvImporting] = useState(false);
  const zvFileRef = useRef<HTMLInputElement>(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const handleSave = async (result: { steps: any[]; edges: any[] }) => {
    const url = editing ? `/api/flows/${editing.id}` : "/api/flows";
    const method = editing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editing?.name, config: { steps: result.steps, edges: result.edges } }),
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

  const handleImportFlow = () => {
    setImportCode("");
    setImportModal(true);
  };

  const saveRename = async (flow: any) => {
    if (!renameValue.trim() || renameValue.trim() === flow.name) { setRenamingId(null); return; }
    await fetch(`/api/flows/${flow.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameValue.trim() }),
    });
    setFlows(prev => prev.map(f => f.id === flow.id ? { ...f, name: renameValue.trim() } : f));
    setRenamingId(null);
    toast.success("Renomeado!");
  };

  const handleZvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setZvImporting(true);
    try {
      // Upload to Supabase Storage first (bypass Vercel body size limit)
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `temp-imports/${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage.from("flow-media").upload(path, file);
      if (uploadErr) { toast.error("Erro no upload"); setZvImporting(false); return; }

      // Send path to API
      const res = await fetch("/api/flows/import-zv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const result = await res.json();
      if (result.ok) {
        toast.success(`${result.imported.length} fluxo(s) importado(s) do ZapVoice!`);
        fetchFlows();
      }
      if (result.errors?.length) {
        result.errors.slice(0, 3).forEach((e: string) => toast.error(e));
      }
    } catch { toast.error("Erro ao importar"); }
    setZvImporting(false);
    if (zvFileRef.current) zvFileRef.current.value = "";
  };

  const doImport = async () => {
    if (!importCode.trim()) return;
    const { importFlowV1 } = await import("@/lib/flow-export");
    const result = importFlowV1(importCode.trim());
    if (!result) { toast.error("Código FLOWV1 inválido"); return; }

    const res = await fetch("/api/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: result.name, config: { steps: result.steps, edges: result.edges } }),
    });
    if (!res.ok) { toast.error("Erro ao importar"); return; }
    const flow = await res.json();
    toast.success("Fluxo importado!");
    setImportModal(false);
    setEditing(flow);
    fetchFlows();
  };

  const handleBulkDelete = async () => {
    await Promise.all(Array.from(selectedIds).map(id => fetch(`/api/flows/${id}`, { method: "DELETE" })));
    toast.success(`${selectedIds.size} fluxo(s) excluído(s)`);
    setFlows(prev => prev.filter(f => !selectedIds.has(f.id)));
    setSelectedIds(new Set());
    setConfirmDelete(false);
  };

  const handleBulkImport = async () => {
    if (!bulkImportText.trim()) return;
    setBulkImporting(true);
    try {
      const res = await fetch("/api/flows/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: bulkImportText }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${data.imported} fluxos importados!`);
        setBulkImportModal(false);
        setBulkImportText("");
        fetchFlows();
      } else {
        toast.error(data.error || "Erro");
      }
    } catch { toast.error("Erro"); }
    setBulkImporting(false);
  };

  const fetchExecutions = async () => {
    const res = await fetch(`/api/flows/logs?status=${logsFilter}&limit=50`);
    if (res.ok) setExecutions(await res.json());
  };

  useEffect(() => { fetchExecutions(); const i = setInterval(fetchExecutions, 3000); return () => clearInterval(i); }, [logsFilter]);

  const cancelExecution = async (execId: string) => {
    await fetch(`/api/flows/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ execution_id: execId }),
    });
    fetchExecutions();
  };

  if (editing) {
    return (
      <div className="fixed inset-0 top-[4rem] z-20 bg-white dark:bg-gray-950">        <button onClick={() => setEditing(null)} className="absolute top-3 left-3 z-30 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1 bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Voltar
        </button>
        <FlowBuilder
          initialSteps={editing.config?.steps || [{ id: "start", type: "start", label: "Início", config: {} }]}
          initialEdges={editing.config?.edges || []}
          onSave={handleSave}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fluxos</h1>
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button onClick={() => setTab("flows")} className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${tab === "flows" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500"}`}>Fluxos</button>
            <button onClick={() => setTab("logs")} className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${tab === "logs" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500"}`}>Execuções</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setBulkImportModal(true)} className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Importar FLOWV1
          </button>
          <input
            ref={zvFileRef}
            type="file"
            accept=".json"
            onChange={handleZvImport}
            className="hidden"
          />
          <button
            onClick={() => zvFileRef.current?.click()}
            disabled={zvImporting}
            className="rounded-xl border border-amber-200 dark:border-amber-800 px-4 py-2.5 text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition flex items-center gap-2 disabled:opacity-50"
          >
            {zvImporting ? (
              <div className="animate-spin w-4 h-4 border-2 border-amber-300 border-t-amber-600 rounded-full" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            )}
            {zvImporting ? "Importando..." : "Importar ZapVoice"}
          </button>
          <button onClick={handleImportFlow} className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition flex items-center gap-2">
            Importar
          </button>
          <button onClick={() => setNameModal(true)} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition shadow-lg shadow-emerald-500/25 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Novo fluxo
          </button>
        </div>
      </div>

      {tab === "flows" && (
        <>
          {flows.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedIds.size === flows.length}
                  onChange={() => setSelectedIds(selectedIds.size === flows.length ? new Set() : new Set(flows.map(f => f.id)))}
                  className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-400"
                />
                Selecionar todos ({flows.length})
              </label>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition"
                >
                  Excluir selecionados ({selectedIds.size})
                </button>
              )}
            </div>
          )}
          {flows.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              <p className="text-lg">Nenhum fluxo criado</p>
              <p className="text-sm mt-1">Crie seu primeiro fluxo de atendimento automatizado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {flows.map((flow) => (
                <div key={flow.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition relative" onClick={() => setEditing(flow)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 pl-6">
                      <label className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(flow.id)}
                          onChange={() => {
                            const next = new Set(selectedIds);
                            next.has(flow.id) ? next.delete(flow.id) : next.add(flow.id);
                            setSelectedIds(next);
                          }}
                          className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-400"
                        />
                      </label>
                      {renamingId === flow.id ? (
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveRename(flow); if (e.key === "Escape") setRenamingId(null); }}
                          onBlur={() => saveRename(flow)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          className="w-full text-sm font-semibold rounded-lg border border-emerald-400 bg-white dark:bg-gray-800 px-2 py-1 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        />
                      ) : (
                        <h3
                          className="font-semibold text-gray-900 dark:text-white cursor-text hover:text-emerald-500 transition"
                          onClick={(e) => { e.stopPropagation(); setRenamingId(flow.id); setRenameValue(flow.name); }}
                          title="Clique para renomear"
                        >
                          {flow.name}
                        </h3>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(flow.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${flow.status === "active" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" : flow.status === "draft" ? "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400" : "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"}`}>{flow.status === "active" ? "Ativo" : flow.status === "draft" ? "Rascunho" : "Inativo"}</span>
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
        </>
      )}

      {tab === "logs" && (
        <div>
          <div className="flex gap-1 mb-3">
            {(["all", "running", "paused", "completed", "error"] as const).map((s) => (
              <button key={s} onClick={() => setLogsFilter(s)} className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition ${logsFilter === s ? "bg-emerald-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                {s === "all" ? "Todas" : s === "running" ? "Em execução" : s === "paused" ? "Pausadas" : s === "completed" ? "Concluídas" : "Erros"}
              </button>
            ))}
          </div>

          {executions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Nenhuma execução encontrada</div>
          ) : (
            <div className="space-y-2">
              {executions.map((exec) => (
                <div key={exec.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${exec.status === "running" ? "bg-blue-500 animate-pulse" : exec.status === "paused" ? "bg-amber-500" : exec.status === "completed" ? "bg-emerald-500" : "bg-red-500"}`} />
                      <span className="font-medium text-sm text-gray-900 dark:text-white">{exec.flowName}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${exec.status === "running" ? "bg-blue-100 text-blue-600 dark:bg-blue-600/20 dark:text-blue-400" : exec.status === "paused" ? "bg-amber-100 text-amber-600 dark:bg-amber-600/20 dark:text-amber-400" : exec.status === "completed" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-600/20 dark:text-emerald-400" : "bg-red-100 text-red-600 dark:bg-red-600/20 dark:text-red-400"}`}>
                        {exec.status === "running" ? "Executando" : exec.status === "paused" ? "Pausado" : exec.status === "completed" ? "Concluído" : "Erro"}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400">{new Date(exec.startedAt).toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{exec.customerName}</span>
                    {exec.customerPhone && <span className="text-gray-400">{exec.customerPhone}</span>}
                    {exec.nextStepAt && exec.status === "paused" && (
                      <span className="text-amber-500">Retoma {new Date(exec.nextStepAt).toLocaleTimeString("pt-BR")}</span>
                    )}
                    {exec.error && <span className="text-red-400 truncate max-w-[300px]">{exec.error}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
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

      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Importar Fluxo</h2>
            <p className="text-xs text-gray-500 mb-3">Cole o código FLOWV1 exportado de outra ferramenta</p>
            <textarea
              value={importCode}
              onChange={(e) => setImportCode(e.target.value)}
              placeholder="FLOWV1:eyJ2ZXJzaW9uIjoxLC..."
              rows={6}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-mono text-xs"
              autoFocus
            />
            <div className="flex gap-3 mt-5">
              <button onClick={() => setImportModal(false)} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Cancelar</button>
              <button onClick={doImport} disabled={!importCode.trim()} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">Importar</button>
            </div>
          </div>
        </div>
      )}

      {bulkImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Importar Fluxos em Massa</h2>
            <p className="text-xs text-gray-500 mb-3">Cole o texto com múltiplos fluxos no formato: # Nome do Fluxo + FLOWV1:...</p>
            <textarea
              value={bulkImportText}
              onChange={(e) => setBulkImportText(e.target.value)}
              placeholder={`# [ZV] Nome do Fluxo 1\nFLOWV1:eyJ2ZXJzaW9uIjo...\n\n# [ZV] Nome do Fluxo 2\nFLOWV1:eyJ2ZXJzaW9uIjo...`}
              rows={12}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-mono text-xs"
              autoFocus
            />
            <div className="flex gap-3 mt-5">
              <button onClick={() => setBulkImportModal(false)} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Cancelar</button>
              <button onClick={handleBulkImport} disabled={!bulkImportText.trim() || bulkImporting} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                {bulkImporting ? "Importando..." : "Importar todos"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setConfirmDelete(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Excluir fluxos?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Tem certeza que deseja excluir <span className="font-semibold text-red-500">{selectedIds.size} fluxo(s)</span> permanentemente?
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                Cancelar
              </button>
              <button onClick={handleBulkDelete} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 transition">
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
