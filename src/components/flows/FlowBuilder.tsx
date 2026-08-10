"use client";

import { useCallback, useState, useRef, useMemo, useEffect } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import {
  Play, MessageSquare, Image as ImageIcon, Video, Music, Clock, GitBranch, Tag, Tags,
  Copy, Trash2, Download, Upload, Loader2, ArrowLeft, Undo2, Check, MessageCircleReply, type LucideIcon,
} from "lucide-react";
import ReactFlow, {
  Background, addEdge, useNodesState, useEdgesState, Connection,
  BackgroundVariant, ReactFlowProvider, ReactFlowInstance, Handle, Position,
  getBezierPath, EdgeProps, BaseEdge, EdgeLabelRenderer,
} from "reactflow";
import "reactflow/dist/style.css";

const NODE_CONFIGS: Record<string, { label: string; color: string; icon: LucideIcon; defaultData: any }> = {
  message: { label: "Mensagem", color: "#3A5AF0", icon: MessageSquare, defaultData: { text: "" } },
  image: { label: "Imagem", color: "#EC4899", icon: ImageIcon, defaultData: { url: "" } },
  video: { label: "Vídeo", color: "#EF4444", icon: Video, defaultData: { url: "" } },
  audio: { label: "Áudio", color: "#14B8A6", icon: Music, defaultData: { url: "" } },
  wait: { label: "Aguardar", color: "#F59E0B", icon: Clock, defaultData: { delay: 5 } },
  wait_reply: { label: "Aguardar resposta", color: "#0891B2", icon: MessageCircleReply, defaultData: { variable: "resposta", timeoutMinutes: "" } },
  condition: { label: "Condição", color: "#8B5CF6", icon: GitBranch, defaultData: { variable: "", value: "" } },
  add_tag: { label: "Adicionar etiqueta", color: "#22C55E", icon: Tag, defaultData: { tagName: "" } },
  remove_tag: { label: "Remover etiqueta", color: "#D946EF", icon: Tags, defaultData: { tagName: "" } },
};
const START = { label: "Início", color: "#0EA5E9", icon: Play };

let idCounter = 0;
function uid() { idCounter++; return `node-${idCounter}`; }

const inputCls = "w-full rounded-lg border border-bd bg-surface2 px-2 py-1 text-xs text-tx placeholder:text-tx3 focus:border-accent focus:outline-none";

// ── Aresta com botão de excluir ──
function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style }: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const [hover, setHover] = useState(false);
  return (
    <g onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, stroke: hover ? "#ef4444" : "var(--accent)", strokeWidth: hover ? 3 : 2 }} />
      <EdgeLabelRenderer>
        <button
          onClick={() => document.dispatchEvent(new CustomEvent("delete-edge", { detail: id }))}
          className="nodrag nopan"
          style={{ position: "absolute", transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: "all", opacity: hover ? 1 : 0, transition: "opacity 0.15s" }}
        >
          <span className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md"><Trash2 className="w-3 h-3" strokeWidth={2.2} /></span>
        </button>
      </EdgeLabelRenderer>
    </g>
  );
}
const edgeTypes = { deletable: DeletableEdge };

// ── Nó do fluxo ──
function FlowNode({ data }: any) {
  const isStart = data.type === "start";
  const cfg = data.config || {};
  const meta = isStart ? START : NODE_CONFIGS[data.type];
  const Icon = meta?.icon || MessageSquare;
  const color = data.color;

  return (
    <div className="rounded-2xl bg-surface border border-bd shadow-pop min-w-[230px] overflow-hidden group" style={{ boxShadow: `0 0 0 1px ${color}22, var(--shadow2)` }}>
      {!isStart && <Handle type="target" position={Position.Top} className="!w-3 !h-3 !border-2 !border-surface" style={{ background: "var(--tx3)" }} />}

      {/* Cabeçalho */}
      <div className="flex items-center gap-2 px-3 py-2 text-white text-[13px] font-bold" style={{ backgroundColor: color }}>
        <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} fill={isStart ? "currentColor" : "none"} />
        <span className="truncate">{data.label}</span>
        {!isStart && (
          <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
            <button onClick={(e) => { e.stopPropagation(); data.onDuplicate?.(); }} className="p-1 hover:bg-white/25 rounded-md" title="Duplicar"><Copy className="w-3.5 h-3.5" strokeWidth={2} /></button>
            <button onClick={(e) => { e.stopPropagation(); data.onDelete?.(); }} className="p-1 hover:bg-white/25 rounded-md" title="Excluir"><Trash2 className="w-3.5 h-3.5" strokeWidth={2} /></button>
          </div>
        )}
      </div>

      {/* Corpo editável */}
      {data.type === "message" && (
        <div className="p-2.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <textarea defaultValue={cfg.text || ""} onChange={(e) => { data.config.text = e.target.value; }} placeholder="Digite a mensagem..." className={`${inputCls} resize-none`} rows={3} />
        </div>
      )}
      {data.type === "wait" && (
        <div className="p-2.5 flex items-center gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <span className="text-xs text-tx2 font-semibold">Aguardar</span>
          <input type="number" min={1} max={60} defaultValue={cfg.delay || 5} onChange={(e) => { data.config.delay = Math.min(60, Math.max(1, parseInt(e.target.value) || 5)); }} className={`${inputCls} w-16 text-center`} />
          <span className="text-xs text-tx2 font-semibold">seg</span>
        </div>
      )}
      {data.type === "wait_reply" && (
        <div className="p-2.5 space-y-1.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-tx2 font-semibold whitespace-nowrap">Salvar em</span>
            <input defaultValue={cfg.variable ?? "resposta"} onChange={(e) => { data.config.variable = e.target.value; }} placeholder="resposta" className={inputCls} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-tx2 font-semibold whitespace-nowrap">Tempo limite</span>
            <input type="number" min={0} defaultValue={cfg.timeoutMinutes ?? ""} onChange={(e) => { data.config.timeoutMinutes = e.target.value; }} placeholder="∞" className={`${inputCls} w-16 text-center`} />
            <span className="text-[11px] text-tx2 font-semibold">min</span>
          </div>
          <p className="text-[9px] text-tx3 leading-tight">Em branco = espera pra sempre.</p>
          <div className="flex justify-between text-[9px] font-bold pt-0.5"><span className="text-success">↙ Respondeu</span><span className="text-amber-500">Sem resposta ↘</span></div>
        </div>
      )}
      {data.type === "condition" && (
        <div className="p-2.5 space-y-1.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <input placeholder="Variável" defaultValue={cfg.variable || ""} onChange={(e) => { data.config.variable = e.target.value; }} className={inputCls} />
          <input placeholder="Valor esperado" defaultValue={cfg.value || ""} onChange={(e) => { data.config.value = e.target.value; }} className={inputCls} />
          <div className="flex justify-between text-[9px] font-bold pt-0.5"><span className="text-success">↙ Verdadeiro</span><span className="text-red-500">Falso ↘</span></div>
        </div>
      )}
      {(data.type === "add_tag" || data.type === "remove_tag") && <TagEditor config={data.config} />}
      {(data.type === "image" || data.type === "video" || data.type === "audio") && <MediaEditor type={data.type} config={data.config} />}

      {/* Saídas */}
      {data.type === "condition" ? (
        <>
          <Handle type="source" position={Position.Bottom} id="true" className="!w-3 !h-3 !bg-success !border-2 !border-surface !left-[30%]" />
          <Handle type="source" position={Position.Bottom} id="false" className="!w-3 !h-3 !bg-red-500 !border-2 !border-surface !left-[70%]" />
        </>
      ) : data.type === "wait_reply" ? (
        <>
          <Handle type="source" position={Position.Bottom} id="reply" className="!w-3 !h-3 !bg-success !border-2 !border-surface !left-[30%]" />
          <Handle type="source" position={Position.Bottom} id="timeout" className="!w-3 !h-3 !bg-amber-500 !border-2 !border-surface !left-[70%]" />
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !border-2 !border-surface" style={{ background: "var(--accent)" }} />
      )}
    </div>
  );
}

// ── Editor de mídia com upload ──
function MediaEditor({ type, config }: { type: string; config: any }) {
  const [uploading, setUploading] = useState(false);
  const labels: Record<string, string> = { image: "imagem (máx 5MB)", audio: "áudio (máx 16MB)", video: "vídeo (máx 16MB)" };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "bin";
      const path = `flow-build/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("flow-media").upload(path, file, { upsert: true });
      if (error) toast.error(error.message);
      else { const { data } = supabase.storage.from("flow-media").getPublicUrl(path); config.url = data.publicUrl; }
    } catch { toast.error("Erro no upload"); }
    setUploading(false);
  };

  return (
    <div className="p-2.5 space-y-1.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <input placeholder={`URL do ${type} (https://...)`} defaultValue={config.url || ""} onChange={(e) => { config.url = e.target.value; }} className={inputCls} />
      <label className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-dashed border-bd text-[11px] font-semibold cursor-pointer transition ${uploading ? "opacity-50" : "text-tx2 hover:border-accent hover:text-accent"}`}>
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} /> : <Upload className="w-3.5 h-3.5" strokeWidth={2} />}
        {uploading ? "Enviando..." : `Enviar ${labels[type]}`}
        <input type="file" accept={type === "image" ? "image/*" : type === "video" ? "video/*" : "audio/*"} onChange={handleUpload} className="hidden" disabled={uploading} />
      </label>
      {config.url && type === "image" && (
        <>
          <img src={config.url} alt="" className="w-full h-24 object-cover rounded-lg border border-bd" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <textarea placeholder="Legenda (opcional)" defaultValue={config.caption || ""} onChange={(e) => { config.caption = e.target.value; }} rows={2} className={`${inputCls} resize-none`} />
        </>
      )}
      {config.url && type === "video" && (
        <>
          <video src={config.url} controls className="w-full h-24 rounded-lg border border-bd" preload="metadata" />
          <textarea placeholder="Legenda (opcional)" defaultValue={config.caption || ""} onChange={(e) => { config.caption = e.target.value; }} rows={2} className={`${inputCls} resize-none`} />
        </>
      )}
      {config.url && type === "audio" && <audio src={config.url} controls className="w-full h-8" />}
    </div>
  );
}

// ── Editor de etiqueta: seleciona uma etiqueta do CRM ou cria uma nova (com coluna) ──
function TagEditor({ config }: { config: any }) {
  const [tags, setTags] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [nName, setNName] = useState("");
  const [nColor, setNColor] = useState("#6366f1");
  const [nCol, setNCol] = useState("");
  const [selected, setSelected] = useState<string>(config.tagId || "");

  const load = useCallback(async () => {
    try {
      const [t, c] = await Promise.all([fetch("/api/crm/tags").then((r) => r.json()), fetch("/api/crm/columns").then((r) => r.json())]);
      if (Array.isArray(t)) {
        setTags(t);
        if (!config.tagId && config.tagName) {
          const match = t.find((x: any) => x.name === config.tagName);
          if (match) { config.tagId = match.id; config.columnKey = match.column_key; setSelected(match.id); }
        }
      }
      if (Array.isArray(c)) setColumns(c);
    } catch { /* ignore */ }
  }, [config]);
  useEffect(() => { load(); }, [load]);

  const pick = (id: string) => {
    setSelected(id);
    const t = tags.find((x) => x.id === id);
    config.tagId = id || undefined;
    config.tagName = t?.name || "";
    config.columnKey = t?.column_key || null;
    config.color = t?.color;
  };

  const create = async () => {
    if (!nName.trim()) return;
    const res = await fetch("/api/crm/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nName.trim(), color: nColor, column_key: nCol || null }) });
    if (res.ok) { const t = await res.json(); setTags((prev) => [...prev, t]); pick(t.id); setCreating(false); setNName(""); toast.success("Etiqueta criada!"); }
    else toast.error("Erro ao criar etiqueta");
  };

  const colLabel = (key: string) => columns.find((c) => c.key === key)?.label;

  return (
    <div className="p-2.5 space-y-1.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <select value={selected} onChange={(e) => pick(e.target.value)} className={inputCls}>
        <option value="">Selecione uma etiqueta...</option>
        {tags.map((t) => <option key={t.id} value={t.id}>{t.name}{t.column_key && colLabel(t.column_key) ? ` · ${colLabel(t.column_key)}` : ""}</option>)}
      </select>
      {!creating ? (
        <button onClick={() => setCreating(true)} className="w-full text-[11px] font-bold text-accent hover:text-accent2 py-1">+ Criar etiqueta</button>
      ) : (
        <div className="space-y-1.5 rounded-lg border border-bd p-2 bg-surface2">
          <input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Nome da etiqueta" className={inputCls} />
          <div className="flex items-center gap-2">
            <input type="color" value={nColor} onChange={(e) => setNColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer bg-transparent flex-shrink-0" />
            <select value={nCol} onChange={(e) => setNCol(e.target.value)} className={inputCls}>
              <option value="">Sem coluna</option>
              {columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => setCreating(false)} className="flex-1 text-[11px] font-semibold text-tx2 rounded border border-bd py-1 hover:bg-hover">Cancelar</button>
            <button onClick={create} className="flex-1 text-[11px] font-bold text-white bg-accent rounded py-1 hover:bg-accent2">Criar</button>
          </div>
        </div>
      )}
    </div>
  );
}

const nodeTypes = { flowNode: FlowNode };
interface FlowStep { id: string; type: string; label: string; config: Record<string, any>; position?: { x: number; y: number } }

type EdgeLite = { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string };

// Fallback de layout: posiciona os nós na ORDEM DE EXECUÇÃO (segue os edges a partir do início).
// Usado só quando o fluxo não tem posições salvas — garante que a ordem visual bate com a real.
function layoutByExecution(steps: FlowStep[], edges: EdgeLite[]): Record<string, { x: number; y: number }> {
  const adj: Record<string, string[]> = {};
  for (const e of edges) (adj[e.source] = adj[e.source] || []).push(e.target);
  const start = steps.find((s) => s.type === "start") || steps.find((s) => !edges.some((e) => e.target === s.id)) || steps[0];
  const pos: Record<string, { x: number; y: number }> = {};
  const seen = new Set<string>();
  let order = 0;
  const visit = (id?: string) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    pos[id] = { x: 300, y: 50 + order * 170 };
    order++;
    for (const t of adj[id] || []) visit(t);
  };
  if (start) visit(start.id);
  for (const s of steps) if (!seen.has(s.id)) { pos[s.id] = { x: 300, y: 50 + order * 170 }; order++; }
  return pos;
}
export default function FlowBuilder({ onPersist, onBack, flowName, initialSteps, initialEdges }: {
  onPersist?: (result: { steps: FlowStep[]; edges: EdgeLite[] }) => Promise<void> | void;
  onBack?: () => void;
  flowName?: string;
  initialSteps?: FlowStep[];
  initialEdges?: EdgeLite[];
}) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const [canUndo, setCanUndo] = useState(false);

  const buildInitialNodes = useMemo((): any[] => {
    if (initialSteps && initialSteps.length > 0) {
      const validPos = (s: any) => s.position && typeof s.position.x === "number" && typeof s.position.y === "number";
      // Sem nenhuma posição salva → calcula layout pela ordem de execução (não pela ordem do array).
      const fallback = initialSteps.some(validPos) ? null : layoutByExecution(initialSteps, initialEdges || []);
      return initialSteps.map((s, i) => ({
        id: s.id, type: "flowNode",
        position: validPos(s) ? { x: s.position!.x, y: s.position!.y } : (fallback?.[s.id] || { x: 300, y: 50 + i * 170 }),
        data: { type: s.type, label: s.label || s.type, color: s.type === "start" ? START.color : (NODE_CONFIGS[s.type]?.color || "#6b7280"), config: { ...s.config } },
        draggable: s.id !== "start",
      }));
    }
    return [{ id: "start", type: "flowNode", position: { x: 300, y: 50 }, data: { type: "start", label: "Início", color: START.color, config: {} }, draggable: false }];
  }, []);

  const buildInitialEdges = useMemo((): any[] => {
    if (initialEdges && initialEdges.length > 0) {
      return initialEdges.map((e) => ({ id: e.id, type: "deletable", source: e.source, target: e.target, sourceHandle: e.sourceHandle || undefined, targetHandle: e.targetHandle || undefined, animated: true }));
    }
    return [];
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(buildInitialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(buildInitialEdges);

  // Refs sempre com o valor atual (para snapshots e auto-save)
  const nodesRef = useRef(nodes); nodesRef.current = nodes;
  const edgesRef = useRef(edges); edgesRef.current = edges;

  // ── Histórico (desfazer) — guarda o estado ANTES de cada mudança ──
  const undoRef = useRef<{ nodes: any[]; edges: any[] }[]>([]);
  const restoringRef = useRef(false);
  const snapshot = useCallback(() => {
    if (restoringRef.current) return;
    undoRef.current.push({ nodes: JSON.parse(JSON.stringify(nodesRef.current)), edges: JSON.parse(JSON.stringify(edgesRef.current)) });
    if (undoRef.current.length > 10) undoRef.current.shift();
    setCanUndo(undoRef.current.length > 0);
  }, []);
  const undo = useCallback(() => {
    const prev = undoRef.current.pop();
    if (!prev) return;
    restoringRef.current = true;
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setCanUndo(undoRef.current.length > 0);
    setTimeout(() => { restoringRef.current = false; }, 60);
  }, [setNodes, setEdges]);

  // Ctrl/Cmd + Z desfaz
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        const t = e.target as HTMLElement;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return; // deixa o undo do campo de texto
        e.preventDefault(); undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  // ── Auto-save (a cada 1.8s, salva se algo mudou — inclusive edições de texto nos nós) ──
  const lastSavedRef = useRef<string>("");
  const serialize = (flow: any) => JSON.stringify({
    steps: flow.nodes.map((n: any) => ({ id: n.id, type: n.data.type, label: n.data.label, config: n.data.config, position: n.position })),
    edges: flow.edges.map((e: any) => ({ id: e.id || "", source: e.source, target: e.target, sourceHandle: e.sourceHandle || undefined, targetHandle: e.targetHandle || undefined })),
  });
  useEffect(() => {
    if (!rfInstance) return;
    lastSavedRef.current = serialize(rfInstance.toObject()); // estado inicial já está salvo
    if (!onPersist) return;
    const i = setInterval(async () => {
      const flow = rfInstance.toObject();
      const ser = serialize(flow);
      if (ser === lastSavedRef.current) return;
      setSaveStatus("saving");
      try {
        const parsed = JSON.parse(ser);
        await onPersist(parsed);
        lastSavedRef.current = ser;
      } catch { /* tenta de novo no próximo tick */ }
      setSaveStatus("saved");
    }, 1800);
    return () => clearInterval(i);
  }, [rfInstance, onPersist]);

  // Voltar: salva o estado final antes de sair
  const handleBack = useCallback(async () => {
    if (rfInstance && onPersist) {
      try { await onPersist(JSON.parse(serialize(rfInstance.toObject()))); } catch {}
    }
    onBack?.();
  }, [rfInstance, onPersist, onBack]);

  // Snapshot antes de remoções por teclado
  const handleNodesChange = useCallback((changes: any[]) => {
    if (changes.some((c) => c.type === "remove")) snapshot();
    onNodesChange(changes);
  }, [onNodesChange, snapshot]);
  const handleEdgesChange = useCallback((changes: any[]) => {
    if (changes.some((c) => c.type === "remove")) snapshot();
    onEdgesChange(changes);
  }, [onEdgesChange, snapshot]);

  const deleteNode = useCallback((nodeId: string) => {
    snapshot();
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, [setNodes, setEdges, snapshot]);

  const duplicateNode = useCallback((nodeId: string) => {
    snapshot();
    setNodes((nds) => {
      const node = nds.find((n) => n.id === nodeId);
      if (!node) return nds;
      const newId = uid();
      return [...nds, { ...node, id: newId, position: { x: node.position.x + 60, y: node.position.y + 90 }, selected: false, data: { ...node.data, config: { ...node.data?.config } } }];
    });
  }, [setNodes]);

  const handleDeleteEdge = useCallback((edgeId: string) => setEdges((eds) => eds.filter((e) => e.id !== edgeId)), [setEdges]);
  useEffect(() => {
    const handler = (e: Event) => handleDeleteEdge((e as CustomEvent).detail);
    document.addEventListener("delete-edge", handler);
    return () => document.removeEventListener("delete-edge", handler);
  }, [handleDeleteEdge]);

  const nodesWithCallbacks = useMemo(() => nodes.map((n) => ({
    ...n, data: { ...n.data, onDelete: n.id !== "start" ? () => deleteNode(n.id) : undefined, onDuplicate: n.id !== "start" ? () => duplicateNode(n.id) : undefined },
  })), [nodes, deleteNode, duplicateNode]);

  const onConnect = useCallback((params: Connection) => { snapshot(); setEdges((eds) => addEdge({ ...params, type: "deletable", animated: true }, eds)); }, [setEdges, snapshot]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/reactflow");
    if (!type || !rfInstance || !reactFlowWrapper.current) return;
    snapshot();
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = rfInstance.project({ x: event.clientX - bounds.left - 100, y: event.clientY - bounds.top - 25 });
    position.x += Math.floor(Math.random() * 60) - 30;
    position.y += Math.floor(Math.random() * 40) - 20;
    const cfg = NODE_CONFIGS[type];
    setNodes((nds) => [...nds, { id: uid(), type: "flowNode", position, data: { type, label: cfg.label, color: cfg.color, config: { ...cfg.defaultData } } }]);
  }, [rfInstance, setNodes]);

  const handleExport = async () => {
    if (!rfInstance) return;
    const flow = rfInstance.toObject();
    const { exportFlowV1 } = await import("@/lib/flow-export");
    const code = exportFlowV1("Fluxo", flow.nodes.map((n: any) => ({ id: n.id, type: n.data.type, label: n.data.label, config: n.data.config, position: n.position })), flow.edges as any);
    try { await navigator.clipboard.writeText(code); toast.success("Código FLOWV1 copiado!"); }
    catch { toast.error("Não foi possível copiar"); }
  };

  const types = Object.keys(NODE_CONFIGS).filter((t) => t !== "condition");

  return (
    <div className="flex h-full w-full bg-bg">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 border-r border-bd bg-surface flex flex-col">
        {/* Cabeçalho: voltar + nome + status de salvamento */}
        <div className="px-3 py-3 border-b border-bd">
          <button onClick={handleBack} className="flex items-center gap-1.5 text-sm font-bold text-tx2 hover:text-tx transition mb-2">
            <ArrowLeft className="w-4 h-4" strokeWidth={2.2} /> Voltar
          </button>
          <p className="text-[13px] font-extrabold text-tx truncate" title={flowName}>{flowName || "Fluxo"}</p>
          <div className="flex items-center gap-1.5 mt-1 text-[11px]">
            {saveStatus === "saving" ? (
              <><Loader2 className="w-3 h-3 animate-spin text-tx3" strokeWidth={2.5} /><span className="text-tx3 font-semibold">Salvando...</span></>
            ) : (
              <><Check className="w-3 h-3 text-success" strokeWidth={3} /><span className="text-success font-semibold">Salvo automaticamente</span></>
            )}
          </div>
        </div>

        {/* Desfazer */}
        <div className="px-3 pt-3">
          <button onClick={undo} disabled={!canUndo} className="w-full rounded-control border border-bd px-3 py-2 text-[12px] font-bold text-tx2 hover:bg-hover hover:text-tx disabled:opacity-40 disabled:hover:bg-transparent transition flex items-center justify-center gap-1.5" title="Desfazer (Ctrl+Z)">
            <Undo2 className="w-4 h-4" strokeWidth={2} /> Voltar alteração
          </button>
        </div>

        {/* Blocos */}
        <div className="p-3 overflow-y-auto flex-1 space-y-1.5">
          <h3 className="text-[10px] font-bold text-tx3 uppercase tracking-wider mb-1 px-1">Blocos · arraste pro canvas</h3>
          {types.map((type) => {
            const cfg = NODE_CONFIGS[type];
            const Icon = cfg.icon;
            return (
              <div key={type} draggable onDragStart={(e) => { e.dataTransfer.setData("application/reactflow", type); e.dataTransfer.effectAllowed = "move"; }}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-control border border-bd bg-surface cursor-grab active:cursor-grabbing hover:border-accent hover:shadow-card transition">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.color + "1f" }}>
                  <Icon className="w-4 h-4" strokeWidth={2} style={{ color: cfg.color }} />
                </span>
                <span className="text-[12px] font-bold text-tx">{cfg.label}</span>
              </div>
            );
          })}
        </div>

        {/* Exportar */}
        <div className="p-3 border-t border-bd">
          <button onClick={handleExport} className="w-full rounded-control border border-bd px-3 py-2.5 text-[12px] font-semibold text-tx2 hover:bg-hover hover:text-tx transition flex items-center justify-center gap-1.5"><Download className="w-4 h-4" strokeWidth={2} /> Exportar FLOWV1</button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 h-full" ref={reactFlowWrapper}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodesWithCallbacks} edges={edges}
            onNodesChange={handleNodesChange} onEdgesChange={handleEdgesChange} onConnect={onConnect}
            onNodeDragStart={() => snapshot()}
            onInit={setRfInstance} onDrop={onDrop} onDragOver={(e) => e.preventDefault()}
            nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView
            deleteKeyCode={["Backspace", "Delete"]} style={{ width: "100%", height: "100%" }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="var(--bd)" />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}
