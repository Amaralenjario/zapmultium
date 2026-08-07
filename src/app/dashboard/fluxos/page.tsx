"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Plus, Upload, FileUp, Download, Trash2, Copy, Pencil, Workflow, AlertTriangle, Loader2, CheckSquare, Square } from "lucide-react";
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

const statusMeta: Record<string, { label: string; cls: string; dot: string }> = {
  active: { label: "Ativo", cls: "bg-success-soft text-success", dot: "bg-success" },
  draft: { label: "Rascunho", cls: "bg-surface2 text-tx2", dot: "bg-tx3" },
  inactive: { label: "Inativo", cls: "bg-amber-500/12 text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
};
const execStatusMeta: Record<string, { label: string; cls: string; dot: string }> = {
  running: { label: "Executando", cls: "bg-accentsoft text-accent", dot: "bg-accent animate-pulse" },
  paused: { label: "Pausado", cls: "bg-amber-500/12 text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  completed: { label: "Concluído", cls: "bg-success-soft text-success", dot: "bg-success" },
  error: { label: "Erro", cls: "bg-red-500/12 text-red-600 dark:text-red-400", dot: "bg-red-500" },
};

export default function FluxosPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [editing, setEditing] = useState<Flow | null>(null);
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
  const [search, setSearch] = useState("");

  const handleCreate = async () => {
    if (!newFlowName.trim()) return;
    setNameModal(false);
    const res = await fetch("/api/flows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newFlowName.trim(), config: { steps: [] } }) });
    if (!res.ok) { toast.error("Erro ao criar"); return; }
    const flow = await res.json();
    toast.success("Fluxo criado!");
    setNewFlowName("");
    setEditing(flow);
    fetchFlows();
  };

  const fetchFlows = async () => { const res = await fetch("/api/flows"); setFlows(await res.json()); };
  useEffect(() => { fetchFlows(); }, []);

  // Salvamento automático silencioso (sem fechar o construtor nem toast)
  const editingId = editing?.id;
  const editingName = editing?.name;
  const handlePersist = useCallback(async (result: { steps: any[]; edges: any[] }) => {
    if (!editingId) return;
    await fetch(`/api/flows/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editingName, config: { steps: result.steps, edges: result.edges } }) });
  }, [editingId, editingName]);

  const handleExitBuilder = () => { setEditing(null); fetchFlows(); };

  const handleDelete = async (flow: Flow) => {
    if (!confirm(`Excluir "${flow.name}"?`)) return;
    await fetch(`/api/flows/${flow.id}`, { method: "DELETE" });
    toast.success("Excluído!");
    fetchFlows();
  };

  const saveRename = async (flow: any) => {
    if (!renameValue.trim() || renameValue.trim() === flow.name) { setRenamingId(null); return; }
    await fetch(`/api/flows/${flow.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: renameValue.trim() }) });
    setFlows(prev => prev.map(f => f.id === flow.id ? { ...f, name: renameValue.trim() } : f));
    setRenamingId(null);
    toast.success("Renomeado!");
  };

  const handleZvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setZvImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/flows/import-zv", { method: "POST", body: formData });
      if (res.status === 413) { toast.error("Arquivo muito grande (limite 4.5MB)."); setZvImporting(false); return; }
      const result = await res.json();
      if (result.ok) { toast.success(`${result.imported.length} fluxo(s) importado(s) do ZapVoice!`); fetchFlows(); }
      if (result.errors?.length) result.errors.slice(0, 3).forEach((err: string) => toast.error(err));
      if (!result.ok && !result.errors?.length) toast.error(result.error || "Erro ao importar");
    } catch { toast.error("Erro ao importar"); }
    setZvImporting(false);
    if (zvFileRef.current) zvFileRef.current.value = "";
  };

  const doImport = async () => {
    if (!importCode.trim()) return;
    const { importFlowV1 } = await import("@/lib/flow-export");
    const result = importFlowV1(importCode.trim());
    if (!result) { toast.error("Código FLOWV1 inválido"); return; }
    const res = await fetch("/api/flows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: result.name, config: { steps: result.steps, edges: result.edges } }) });
    if (!res.ok) { toast.error("Erro ao importar"); return; }
    const flow = await res.json();
    toast.success("Fluxo importado!");
    setImportModal(false); setImportCode("");
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

  const handleExportFlow = async (flow: Flow) => {
    const { exportFlowV1 } = await import("@/lib/flow-export");
    const code = exportFlowV1(flow.name, flow.config?.steps || [], flow.config?.edges || []);
    await navigator.clipboard.writeText(code);
    toast.success(`"${flow.name}" copiado!`);
  };

  const handleExportSelected = async () => {
    const { exportFlowV1 } = await import("@/lib/flow-export");
    let allCode = "";
    for (const id of selectedIds) {
      const flow = flows.find(f => f.id === id);
      if (!flow) continue;
      const code = exportFlowV1(flow.name, flow.config?.steps || [], flow.config?.edges || []);
      allCode += (allCode ? "\n\n" : "") + `# ${flow.name}\n` + code;
    }
    await navigator.clipboard.writeText(allCode);
    toast.success(`${selectedIds.size} fluxo(s) exportados! Cole em outra conta.`);
    setSelectedIds(new Set());
  };

  const handleBulkImport = async () => {
    if (!bulkImportText.trim()) return;
    setBulkImporting(true);
    try {
      const res = await fetch("/api/flows/bulk-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: bulkImportText }) });
      const data = await res.json();
      if (res.ok) {
        const ok = (data.results || []).filter((r: any) => !r.error).length;
        const fail = (data.results || []).filter((r: any) => r.error).length;
        toast.success(`${ok} fluxo(s) importado(s)${fail ? ` · ${fail} com erro` : ""}!`);
        setBulkImportModal(false); setBulkImportText("");
        fetchFlows();
      } else toast.error(data.error || "Erro");
    } catch { toast.error("Erro"); }
    setBulkImporting(false);
  };

  const fetchExecutions = async () => {
    const res = await fetch(`/api/flows/logs?status=${logsFilter}&limit=50`);
    if (res.ok) setExecutions(await res.json());
  };
  useEffect(() => { fetchExecutions(); const i = setInterval(fetchExecutions, 3000); return () => clearInterval(i); }, [logsFilter]);

  const visibleFlows = search.trim() ? flows.filter(f => f.name.toLowerCase().includes(search.trim().toLowerCase())) : flows;

  if (editing) {
    return (
      <div className="fixed inset-0 z-50 bg-bg">
        <FlowBuilder
          flowName={editing.name}
          initialSteps={editing.config?.steps || [{ id: "start", type: "start", label: "Início", config: {} }]}
          initialEdges={editing.config?.edges || []}
          onBack={handleExitBuilder}
          onPersist={handlePersist}
        />
      </div>
    );
  }

  const btnGhost = "rounded-control border border-bd px-3.5 py-2.5 text-sm font-semibold text-tx2 hover:bg-hover hover:text-tx transition flex items-center gap-2";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-tx">Fluxos</h1>
          <div className="flex bg-surface2 rounded-control p-0.5">
            <button onClick={() => setTab("flows")} className={`px-3.5 py-1.5 text-xs font-bold rounded-[9px] transition ${tab === "flows" ? "bg-surface text-tx shadow-card" : "text-tx2 hover:text-tx"}`}>Fluxos</button>
            <button onClick={() => setTab("logs")} className={`px-3.5 py-1.5 text-xs font-bold rounded-[9px] transition ${tab === "logs" ? "bg-surface text-tx shadow-card" : "text-tx2 hover:text-tx"}`}>Execuções</button>
          </div>
        </div>
        {tab === "flows" && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setBulkImportModal(true)} className={btnGhost} title="Importar vários fluxos de uma vez (de outra conta)">
              <Upload className="w-4 h-4" strokeWidth={2} /> Importar em massa
            </button>
            <input ref={zvFileRef} type="file" accept=".json" onChange={handleZvImport} className="hidden" />
            <button onClick={() => zvFileRef.current?.click()} disabled={zvImporting} className="rounded-control border border-amber-300/60 dark:border-amber-800/60 px-3.5 py-2.5 text-sm font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition flex items-center gap-2 disabled:opacity-50">
              {zvImporting ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} /> : <FileUp className="w-4 h-4" strokeWidth={2} />}
              {zvImporting ? "Importando..." : "ZapVoice"}
            </button>
            <button onClick={() => { setImportCode(""); setImportModal(true); }} className={btnGhost}>
              <Download className="w-4 h-4" strokeWidth={2} /> Importar
            </button>
            <button onClick={() => setNameModal(true)} className="rounded-control bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-accent2 transition flex items-center gap-2">
              <Plus className="w-4 h-4" strokeWidth={2.2} /> Novo fluxo
            </button>
          </div>
        )}
      </div>

      {tab === "flows" && (
        <>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar fluxo..." className="rounded-control border border-bd bg-surface2 px-4 py-2 text-sm text-tx placeholder:text-tx3 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition w-full max-w-xs" />
            {visibleFlows.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs font-semibold text-tx2 cursor-pointer select-none">
                <input type="checkbox" checked={selectedIds.size === visibleFlows.length && visibleFlows.length > 0} onChange={() => setSelectedIds(selectedIds.size === visibleFlows.length ? new Set() : new Set(visibleFlows.map(f => f.id)))} className="accent-[color:var(--accent)] w-4 h-4" />
                Selecionar todos ({visibleFlows.length})
              </label>
            )}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setConfirmDelete(true)} className="text-xs font-bold px-3 py-1.5 rounded-control bg-red-500/10 text-red-600 hover:bg-red-500/20 transition flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" strokeWidth={2} /> Excluir ({selectedIds.size})</button>
                <button onClick={handleExportSelected} className="text-xs font-bold px-3 py-1.5 rounded-control bg-accentsoft text-accent hover:brightness-95 transition flex items-center gap-1.5"><Copy className="w-3.5 h-3.5" strokeWidth={2} /> Exportar ({selectedIds.size})</button>
              </div>
            )}
          </div>

          {visibleFlows.length === 0 ? (
            <div className="text-center py-20 text-tx3 flex flex-col items-center">
              <Workflow className="w-16 h-16 mb-4 opacity-30" strokeWidth={1.5} />
              <p className="text-lg font-semibold text-tx2">{search ? "Nenhum fluxo encontrado" : "Nenhum fluxo criado"}</p>
              <p className="text-sm mt-1">Crie seu primeiro fluxo de atendimento automatizado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleFlows.map((flow) => {
                const sm = statusMeta[flow.status] || statusMeta.draft;
                const selected = selectedIds.has(flow.id);
                return (
                  <div key={flow.id} className={`group rounded-card border bg-surface p-5 hover:shadow-pop transition relative cursor-pointer ${selected ? "border-accent ring-2 ring-accent/20" : "border-bd"}`} onClick={() => setEditing(flow)}>
                    <div className="flex items-start gap-3">
                      <button onClick={(e) => { e.stopPropagation(); const next = new Set(selectedIds); next.has(flow.id) ? next.delete(flow.id) : next.add(flow.id); setSelectedIds(next); }} className="mt-0.5 text-tx3 hover:text-accent transition flex-shrink-0" title="Selecionar">
                        {selected ? <CheckSquare className="w-5 h-5 text-accent" strokeWidth={2} /> : <Square className="w-5 h-5" strokeWidth={2} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        {renamingId === flow.id ? (
                          <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveRename(flow); if (e.key === "Escape") setRenamingId(null); }} onBlur={() => saveRename(flow)} onClick={(e) => e.stopPropagation()} autoFocus className="w-full text-sm font-bold rounded-lg border border-accent bg-surface2 px-2 py-1 text-tx focus:outline-none" />
                        ) : (
                          <h3 className="font-bold text-tx truncate pr-2" onClick={(e) => { e.stopPropagation(); setRenamingId(flow.id); setRenameValue(flow.name); }} title="Clique para renomear">{flow.name}</h3>
                        )}
                        <p className="text-xs text-tx3 mt-0.5">{new Date(flow.created_at).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 flex-shrink-0 ${sm.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />{sm.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-tx3 mt-3">
                      <span className="bg-surface2 px-2 py-0.5 rounded font-semibold">{flow.trigger_type}</span>
                      <span className="flex items-center gap-1"><Workflow className="w-3 h-3" strokeWidth={2} />{Math.max(0, (flow.config?.steps?.length || 1) - 1)} etapa(s)</span>
                    </div>
                    <div className="flex gap-3 pt-3 mt-3 border-t border-line">
                      <button onClick={(e) => { e.stopPropagation(); setEditing(flow); }} className="text-xs font-bold text-tx2 hover:text-accent transition flex items-center gap-1"><Pencil className="w-3.5 h-3.5" strokeWidth={2} /> Editar</button>
                      <button onClick={(e) => { e.stopPropagation(); handleExportFlow(flow); }} className="text-xs font-bold text-accent hover:text-accent2 transition flex items-center gap-1"><Copy className="w-3.5 h-3.5" strokeWidth={2} /> Exportar</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(flow); }} className="text-xs font-bold text-red-400 hover:text-red-500 transition ml-auto flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" strokeWidth={2} /> Excluir</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "logs" && (
        <div>
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {(["all", "running", "paused", "completed", "error"] as const).map((s) => (
              <button key={s} onClick={() => setLogsFilter(s)} className={`text-[11px] px-3 py-1.5 rounded-control font-bold transition ${logsFilter === s ? "bg-accent text-white shadow-glow" : "bg-surface2 text-tx2 hover:bg-hover hover:text-tx"}`}>
                {s === "all" ? "Todas" : execStatusMeta[s]?.label || s}
              </button>
            ))}
          </div>
          {executions.length === 0 ? (
            <div className="text-center py-16 text-tx3 text-sm">Nenhuma execução encontrada</div>
          ) : (
            <div className="space-y-2">
              {executions.map((exec) => {
                const em = execStatusMeta[exec.status] || execStatusMeta.error;
                return (
                  <div key={exec.id} className="rounded-card border border-bd bg-surface p-4 hover:shadow-card transition">
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${em.dot}`} />
                        <span className="font-bold text-sm text-tx truncate">{exec.flowName}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${em.cls}`}>{em.label}</span>
                      </div>
                      <span className="text-[10px] text-tx3 flex-shrink-0">{new Date(exec.startedAt).toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-tx3 flex-wrap">
                      <span className="font-semibold text-tx2">{exec.customerName}</span>
                      {exec.customerPhone && <span>{exec.customerPhone}</span>}
                      {exec.nextStepAt && exec.status === "paused" && <span className="text-amber-500">Retoma {new Date(exec.nextStepAt).toLocaleTimeString("pt-BR")}</span>}
                      {exec.error && <span className="text-red-500 truncate max-w-[300px]">{exec.error}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      {nameModal && (
        <Modal onClose={() => { setNameModal(false); setNewFlowName(""); }} title="Novo fluxo" width="max-w-sm">
          <label className="block text-sm font-semibold text-tx2 mb-1.5">Nome do fluxo</label>
          <input type="text" value={newFlowName} onChange={(e) => setNewFlowName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} placeholder="Ex: Boas-vindas automático" autoFocus className="w-full rounded-control border border-bd bg-surface2 px-4 py-2.5 text-sm text-tx placeholder:text-tx3 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none" />
          <div className="flex gap-3 mt-5">
            <button onClick={() => { setNameModal(false); setNewFlowName(""); }} className="flex-1 rounded-control border border-bd px-4 py-2.5 text-sm font-semibold text-tx2 hover:bg-hover transition">Cancelar</button>
            <button onClick={handleCreate} disabled={!newFlowName.trim()} className="flex-1 rounded-control bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-accent2 disabled:opacity-50 transition">Criar fluxo</button>
          </div>
        </Modal>
      )}

      {importModal && (
        <Modal onClose={() => setImportModal(false)} title="Importar fluxo" width="max-w-lg">
          <p className="text-xs text-tx3 mb-3">Cole o código FLOWV1 exportado de outro fluxo/conta</p>
          <textarea value={importCode} onChange={(e) => setImportCode(e.target.value)} placeholder="FLOWV1:eyJ2ZXJzaW9uIjoxLC..." rows={6} autoFocus className="w-full rounded-control border border-bd bg-surface2 px-4 py-3 text-tx placeholder:text-tx3 focus:border-accent focus:outline-none font-mono text-xs resize-none" />
          <div className="flex gap-3 mt-5">
            <button onClick={() => setImportModal(false)} className="flex-1 rounded-control border border-bd px-4 py-2.5 text-sm font-semibold text-tx2 hover:bg-hover transition">Cancelar</button>
            <button onClick={doImport} disabled={!importCode.trim()} className="flex-1 rounded-control bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-accent2 disabled:opacity-50 transition">Importar</button>
          </div>
        </Modal>
      )}

      {bulkImportModal && (
        <Modal onClose={() => setBulkImportModal(false)} title="Importar fluxos em massa" width="max-w-2xl">
          <p className="text-xs text-tx3 mb-3">Cole vários fluxos no formato: <span className="font-mono text-tx2"># Nome do Fluxo</span> seguido do <span className="font-mono text-tx2">FLOWV1:...</span> — um por bloco. Ideal para migrar de uma conta para outra.</p>
          <textarea value={bulkImportText} onChange={(e) => setBulkImportText(e.target.value)} placeholder={`# Boas-vindas\nFLOWV1:eyJ2ZXJzaW9uIjo...\n\n# Pós-venda\nFLOWV1:eyJ2ZXJzaW9uIjo...`} rows={12} autoFocus className="w-full rounded-control border border-bd bg-surface2 px-4 py-3 text-tx placeholder:text-tx3 focus:border-accent focus:outline-none font-mono text-xs resize-none" />
          <div className="flex gap-3 mt-5">
            <button onClick={() => setBulkImportModal(false)} className="flex-1 rounded-control border border-bd px-4 py-2.5 text-sm font-semibold text-tx2 hover:bg-hover transition">Cancelar</button>
            <button onClick={handleBulkImport} disabled={!bulkImportText.trim() || bulkImporting} className="flex-1 rounded-control bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-accent2 disabled:opacity-50 transition">{bulkImporting ? "Importando..." : "Importar todos"}</button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(false)} title="" width="max-w-sm">
          <div className="text-center mb-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/12 flex items-center justify-center"><AlertTriangle className="w-6 h-6 text-red-500" strokeWidth={2} /></div>
            <h3 className="text-lg font-bold text-tx">Excluir fluxos?</h3>
            <p className="text-sm text-tx2 mt-1">Tem certeza que deseja excluir <span className="font-bold text-red-500">{selectedIds.size} fluxo(s)</span> permanentemente?</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-control border border-bd px-4 py-2.5 text-sm font-semibold text-tx2 hover:bg-hover transition">Cancelar</button>
            <button onClick={handleBulkDelete} className="flex-1 rounded-control bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-500 transition">Sim, excluir</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children, width = "max-w-sm" }: { title: string; onClose: () => void; children: React.ReactNode; width?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`w-full ${width} rounded-card border border-bd bg-surface shadow-pop p-6`} onClick={(e) => e.stopPropagation()}>
        {title && <h2 className="text-lg font-bold text-tx mb-4">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
