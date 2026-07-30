"use client";

import { useCallback, useState, useRef, useMemo, useEffect } from "react";
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  BackgroundVariant,
  ReactFlowProvider,
  ReactFlowInstance,
  Handle,
  Position,
  getBezierPath,
  EdgeProps,
  BaseEdge,
  EdgeLabelRenderer,
} from "reactflow";
import "reactflow/dist/style.css";

const NODE_CONFIGS: Record<string, { label: string; color: string; defaultData: any }> = {
  message: { label: "Mensagem", color: "#3b82f6", defaultData: { text: "" } },
  image: { label: "Imagem", color: "#ec4899", defaultData: { url: "" } },
  video: { label: "Vídeo", color: "#ef4444", defaultData: { url: "" } },
  audio: { label: "Áudio", color: "#14b8a6", defaultData: { url: "" } },
  wait: { label: "Aguardar", color: "#f59e0b", defaultData: { delay: 5 } },
  condition: { label: "Condição", color: "#8b5cf6", defaultData: { variable: "", value: "" } },
};

let idCounter = 0;
function uid() { idCounter++; return `node-${idCounter}`; }

// ── Custom Edge with delete button ──
function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style }: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const [hover, setHover] = useState(false);

  const handleDelete = () => {
    document.dispatchEvent(new CustomEvent("delete-edge", { detail: id }));
  };

  return (
    <>
      <g onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, stroke: hover ? "#ef4444" : "#22c55e", strokeWidth: hover ? 3 : 2 }} />
        <EdgeLabelRenderer>
          <button
            onClick={handleDelete}
            className="nodrag nopan"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
              opacity: hover ? 1 : 0,
              transition: "opacity 0.15s",
            }}
          >
            <svg className="w-5 h-5 text-red-500 hover:text-red-600 drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
            </svg>
          </button>
        </EdgeLabelRenderer>
      </g>
    </>
  );
}

const edgeTypes = { deletable: DeletableEdge };

// ── Flow Node - always editable, previews inline ──
function FlowNode({ data, id }: any) {
  const isStart = data.type === "start";
  const cfg = data.config || {};

  return (
    <div className="rounded-xl border-2 bg-white dark:bg-gray-900 shadow-lg min-w-[220px] overflow-visible group" style={{ borderColor: data.color }}>
      {!isStart && <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white dark:!border-gray-900" />}

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 text-white text-sm font-semibold" style={{ backgroundColor: data.color }}>
        {data.type === "start" && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        {data.type === "message" && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>}
        {data.type === "wait" && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        {data.type === "condition" && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>}
        {data.type === "image" && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
        {data.type === "audio" && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>}
        {data.type === "video" && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
        {data.label}
        {!isStart && (
          <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
            <button onClick={(e) => { e.stopPropagation(); data.onDuplicate?.(); }} className="p-1 hover:bg-white/20 rounded" title="Duplicar">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </button>
            <button onClick={(e) => { e.stopPropagation(); data.onDelete?.(); }} className="p-1 hover:bg-white/20 rounded" title="Excluir">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        )}
      </div>

      {/* Body - always editable */}
      {data.type === "message" && (
        <div className="p-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <textarea
            defaultValue={cfg.text || ""}
            onChange={(e) => { data.config.text = e.target.value; }}
            placeholder="Digite a mensagem..."
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-xs resize-none"
            rows={2}
          />
        </div>
      )}

      {data.type === "wait" && (
        <div className="p-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <span className="text-xs text-gray-500">Aguardar</span>
          <input
            type="number" min={1} max={60} defaultValue={cfg.delay || 5}
            onChange={(e) => { data.config.delay = Math.min(60, Math.max(1, parseInt(e.target.value) || 5)); }}
            className="w-14 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-1 py-0.5 text-center text-xs"
          />
          <span className="text-xs text-gray-500">seg</span>
        </div>
      )}

      {data.type === "condition" && (
        <div className="p-2 space-y-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <input placeholder="Variável" defaultValue={cfg.variable || ""} onChange={(e) => { data.config.variable = e.target.value; }} className="w-full rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 text-xs" />
          <input placeholder="Valor esperado" defaultValue={cfg.value || ""} onChange={(e) => { data.config.value = e.target.value; }} className="w-full rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 text-xs" />
        </div>
      )}

      {(data.type === "image" || data.type === "video" || data.type === "audio") && (
        <MediaEditor type={data.type} config={data.config} />
      )}

      {/* Source handles */}
      {data.type === "condition" && (
        <>
          <Handle type="source" position={Position.Bottom} id="true" className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white dark:!border-gray-900 !left-[30%]" />
          <Handle type="source" position={Position.Bottom} id="false" className="!w-3 !h-3 !bg-red-500 !border-2 !border-white dark:!border-gray-900 !left-[70%]" />
        </>
      )}
      {data.type !== "condition" && <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white dark:!border-gray-900" />}
    </div>
  );
}

// ── Media editor with file upload + preview ──
function MediaEditor({ type, config }: { type: string; config: any }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const labels: Record<string, string> = { image: "Imagem (max 5MB)", audio: "Áudio (max 16MB)", video: "Vídeo (max 16MB)" };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    try {
      const res = await fetch("/api/flows/media", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) { config.url = data.url; }
      else { alert(data.error || "Erro no upload"); }
    } catch { alert("Erro no upload"); }
    setUploading(false);
  };

  return (
    <div className="p-2 space-y-1.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <input
        placeholder={`URL do ${type} (https://...)`}
        defaultValue={config.url || ""}
        onChange={(e) => { config.url = e.target.value; }}
        className="w-full rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 text-xs"
      />
      <label className={`flex items-center justify-center gap-1 px-2 py-1 rounded border border-dashed text-[10px] cursor-pointer transition ${uploading ? "opacity-50" : "hover:border-emerald-400 hover:text-emerald-500"} border-gray-300 dark:border-gray-600 text-gray-500`}>
        {uploading ? "Enviando..." : `📁 Upload ${labels[type]}`}
        <input ref={fileRef} type="file" accept={type === "image" ? "image/*" : type === "video" ? "video/*" : "audio/*"} onChange={handleUpload} className="hidden" disabled={uploading} />
      </label>
      {config.url && type === "image" && (
        <img src={config.url} alt="" className="w-full h-24 object-cover rounded border border-gray-200" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      )}
      {config.url && type === "video" && (
        <video src={config.url} controls className="w-full h-24 rounded border border-gray-200" preload="metadata" />
      )}
      {config.url && type === "audio" && (
        <audio src={config.url} controls className="w-full h-8" />
      )}
    </div>
  );
}

const nodeTypes = { flowNode: FlowNode };

interface FlowStep { id: string; type: string; label: string; config: Record<string, any>; }

export default function FlowBuilder({ onSave, initialSteps, initialEdges }: {
  onSave?: (result: { steps: FlowStep[]; edges: { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }[] }) => void;
  initialSteps?: FlowStep[];
  initialEdges?: { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }[];
}) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  const buildInitialNodes = useMemo((): any[] => {
    if (initialSteps && initialSteps.length > 0) {
      return initialSteps.map((s, i) => ({
        id: s.id,
        type: "flowNode",
        position: { x: 300, y: 50 + i * 150 },
        data: { type: s.type, label: s.label || s.type, color: NODE_CONFIGS[s.type]?.color || "#6b7280", config: { ...s.config } },
        draggable: s.id !== "start",
      }));
    }
    return [{
      id: "start", type: "flowNode",
      position: { x: 300, y: 50 },
      data: { type: "start", label: "Início", color: "#22c55e", config: {} },
      draggable: false,
    }];
  }, []);  // only on mount

  const buildInitialEdges = useMemo((): any[] => {
    if (initialEdges && initialEdges.length > 0) {
      return initialEdges.map((e) => ({
        id: e.id, type: "deletable", source: e.source, target: e.target,
        sourceHandle: e.sourceHandle || undefined, targetHandle: e.targetHandle || undefined,
        animated: true, style: { stroke: "#22c55e", strokeWidth: 2 },
      }));
    }
    return [];
  }, []);  // only on mount

  const [nodes, setNodes, onNodesChange] = useNodesState(buildInitialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(buildInitialEdges);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, [setNodes, setEdges]);

  const duplicateNode = useCallback((nodeId: string) => {
    setNodes((nds) => {
      const node = nds.find((n) => n.id === nodeId);
      if (!node) return nds;
      const newId = uid();
      return [...nds, {
        ...node,
        id: newId,
        position: { x: node.position.x + 50, y: node.position.y + 80 },
        selected: false,
        data: { ...node.data, config: { ...node.data?.config }, onDelete: () => deleteNode(newId), onDuplicate: () => duplicateNode(newId) },
      }];
    });
  }, [setNodes]);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
  }, [setEdges]);

  // Listen for edge delete custom events
  useEffect(() => {
    const handler = (e: Event) => handleDeleteEdge((e as CustomEvent).detail);
    document.addEventListener("delete-edge", handler);
    return () => document.removeEventListener("delete-edge", handler);
  }, [handleDeleteEdge]);

  // Inject callbacks
  const nodesWithCallbacks = useMemo(() => nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      onDelete: n.id !== "start" ? () => deleteNode(n.id) : undefined,
      onDuplicate: n.id !== "start" ? () => duplicateNode(n.id) : undefined,
    },
  })), [nodes, deleteNode, duplicateNode]);

  const onConnect = useCallback((params: Connection) =>
    setEdges((eds) => addEdge({ ...params, type: "deletable", animated: true, style: { stroke: "#22c55e", strokeWidth: 2 } }, eds)),
  [setEdges]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/reactflow");
    if (!type || !rfInstance || !reactFlowWrapper.current) return;
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = rfInstance.project({
      x: event.clientX - bounds.left - 100,
      y: event.clientY - bounds.top - 25,
    });
    // Random offset to prevent overlapping
    position.x += Math.floor(Math.random() * 60) - 30;
    position.y += Math.floor(Math.random() * 40) - 20;
    const newId = uid();
    const cfg = NODE_CONFIGS[type];
    const newNode: any = {
      id: newId, type: "flowNode", position,
      data: { type, label: cfg.label, color: cfg.color, config: { ...cfg.defaultData } },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [rfInstance, setNodes]);

  const handleSave = () => {
    if (!rfInstance) return;
    const flow = rfInstance.toObject();
    const steps: FlowStep[] = flow.nodes.map((n) => ({ id: n.id, type: n.data.type, label: n.data.label, config: n.data.config }));
    const edges: { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }[] = flow.edges.map((e) => ({
      id: e.id || "", source: e.source, target: e.target, sourceHandle: e.sourceHandle || undefined, targetHandle: e.targetHandle || undefined
    }));
    onSave?.({ steps, edges });
  };

  const types = ["message", "image", "video", "audio", "wait", "condition"];

  return (
    <div className="flex h-full w-full">
      {/* Sidebar */}
      <div className="w-44 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2.5 space-y-1.5 overflow-y-auto">
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Blocos</h3>
        {types.map((type) => {
          const cfg = NODE_CONFIGS[type];
          return (
            <div
              key={type}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData("application/reactflow", type); e.dataTransfer.effectAllowed = "move"; }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-grab active:cursor-grabbing hover:shadow-md transition bg-white dark:bg-gray-800"
              style={{ borderColor: cfg.color }}
            >
              {type === "message" && <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: cfg.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>}
              {type === "wait" && <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: cfg.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              {type === "condition" && <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: cfg.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>}
              {type === "image" && <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: cfg.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
              {type === "audio" && <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: cfg.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>}
              {type === "video" && <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: cfg.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
              <span className="text-[11px] font-medium text-gray-900 dark:text-white">{cfg.label}</span>
            </div>
          );
        })}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          <button onClick={handleSave} className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-emerald-500 transition">
            Salvar fluxo
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 h-full" ref={reactFlowWrapper}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodesWithCallbacks}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            deleteKeyCode={["Backspace", "Delete"]}
            style={{ width: "100%", height: "100%" }}
          >
            <Controls className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 !rounded-lg !shadow-lg" />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
            <MiniMap className="!rounded-lg !shadow-lg !border-gray-200 dark:!border-gray-700" nodeColor={(n: any) => n.data?.color || "#6b7280"} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}
