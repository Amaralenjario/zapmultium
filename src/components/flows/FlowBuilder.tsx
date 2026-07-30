"use client";

import { useCallback, useState, useRef } from "react";
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
} from "reactflow";
import "reactflow/dist/style.css";

const NODE_CONFIGS: Record<string, { label: string; color: string; defaultData: any }> = {
  message: { label: "Mensagem", color: "#3b82f6", defaultData: { text: "" } },
  wait: { label: "Aguardar", color: "#f59e0b", defaultData: { delay: 5 } },
  condition: { label: "Condição", color: "#8b5cf6", defaultData: { variable: "", value: "" } },
};

let nodeId = 0;
function getNextId() { nodeId++; return nodeId; }

function FlowNode({ data, id }: any) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(data.config?.text || "");
  const [delay, setDelay] = useState(data.config?.delay || 1);
  const isStart = data.type === "start";

  return (
    <div className="rounded-xl border-2 bg-white dark:bg-gray-900 shadow-lg min-w-[220px] overflow-hidden group" style={{ borderColor: data.color }}>
      {!isStart && <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white dark:!border-gray-900" />}
      <div className="flex items-center gap-2 px-3 py-2 text-white text-sm font-semibold" style={{ backgroundColor: data.color }}>
        {data.type === "start" && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        {data.type === "message" && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>}
        {data.type === "wait" && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        {data.type === "condition" && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>}
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

      {editing && data.type === "message" && (
        <div className="p-2">
          <textarea value={text} onChange={(e) => { setText(e.target.value); data.config.text = e.target.value; }} onKeyDown={(e) => e.stopPropagation()} placeholder="Digite a mensagem..." className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-white resize-none" rows={2} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      {editing && data.type === "wait" && (
        <div className="p-2 flex items-center gap-2 text-xs">
          <span className="text-gray-500">Aguardar</span>
          <input type="number" min={0} max={60} value={delay} onChange={(e) => { const v = Math.min(60, Math.max(0, parseInt(e.target.value) || 0)); setDelay(v); data.config.delay = v; }} onKeyDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} className="w-14 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-1 py-0.5 text-center text-gray-900 dark:text-white" />
          <span className="text-gray-500">seg</span>
        </div>
      )}
      {editing && data.type === "condition" && (
        <div className="p-2 space-y-1 text-xs">
          <input placeholder="Nome da variável" onChange={(e) => { data.config.variable = e.target.value; }} onKeyDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} className="w-full rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 text-gray-900 dark:text-white" />
          <input placeholder="Valor esperado" onChange={(e) => { data.config.value = e.target.value; }} onKeyDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} className="w-full rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 text-gray-900 dark:text-white" />
        </div>
      )}

      <div className="px-3 py-1.5 text-[10px] text-gray-400 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between cursor-pointer" onDoubleClick={() => setEditing(!editing)}>
        Duplo clique para {editing ? "fechar" : "editar"}
      </div>
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

const nodeTypes = { flowNode: FlowNode };

interface FlowStep { id: string; type: string; label: string; config: Record<string, any>; }

export default function FlowBuilder({ onSave, initialSteps, initialEdges }: { onSave?: (result: { steps: FlowStep[]; edges: { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }[] }) => void; initialSteps?: FlowStep[]; initialEdges?: { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }[] }) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  const buildInitialNodes = (): any[] => {
    if (initialSteps && initialSteps.length > 0) {
      return initialSteps.map((s, i) => ({
        id: s.id,
        type: "flowNode",
        position: { x: 300, y: 50 + i * 150 },
        data: { type: s.type, label: s.label || s.type, color: NODE_CONFIGS[s.type]?.color || "#6b7280", config: s.config || {} },
        draggable: s.id !== "start",
      }));
    }
    return [{
      id: "start", type: "flowNode",
      position: { x: 300, y: 50 },
      data: { type: "start", label: "Início", color: "#22c55e", config: {} },
      draggable: false,
    }];
  };

  const buildInitialEdges = (): any[] => {
    if (initialEdges && initialEdges.length > 0) {
      return initialEdges.map((e) => ({
        id: e.id, source: e.source, target: e.target,
        sourceHandle: e.sourceHandle || undefined, targetHandle: e.targetHandle || undefined,
        animated: true, style: { stroke: "#22c55e", strokeWidth: 2 },
      }));
    }
    return [];
  };

  const [nodes, setNodes, onNodesChange] = useNodesState(buildInitialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(buildInitialEdges());

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, [setNodes, setEdges]);

  const duplicateNode = useCallback((nodeId: string) => {
    setNodes((nds) => {
      const node = nds.find((n) => n.id === nodeId);
      if (!node) return nds;
      const newId = getNextId();
      const newNode = {
        ...node,
        id: `node-${newId}`,
        position: { x: node.position.x + 50, y: node.position.y + 80 },
        selected: false,
      };
      return [...nds, newNode];
    });
  }, [setNodes]);

  // Inject callbacks into nodes
  const nodesWithCallbacks = nodes.map((n) => ({
    ...n,
    data: { ...n.data, onDelete: n.id !== "start" ? () => deleteNode(n.id) : undefined, onDuplicate: n.id !== "start" ? () => duplicateNode(n.id) : undefined },
  }));

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: "#22c55e", strokeWidth: 2 } }, eds)), [setEdges]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/reactflow");
    if (!type || !rfInstance || !reactFlowWrapper.current) return;
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = rfInstance.project({ x: event.clientX - bounds.left - 110, y: event.clientY - bounds.top - 30 });
    const newId = getNextId();
    const cfg = NODE_CONFIGS[type];
    const newNode: any = {
      id: `node-${newId}`, type: "flowNode", position,
      data: { type, label: cfg.label, color: cfg.color, config: { ...cfg.defaultData }, onDelete: () => deleteNode(`node-${newId}`), onDuplicate: () => duplicateNode(`node-${newId}`) },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [rfInstance, setNodes, deleteNode, duplicateNode]);

  const handleSave = () => {
    if (!rfInstance) return;
    const flow = rfInstance.toObject();
    const steps: FlowStep[] = flow.nodes.map((n) => ({ id: n.id, type: n.data.type, label: n.data.label, config: n.data.config }));
    const edges: { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }[] = flow.edges.map((e) => ({
      id: e.id || "", source: e.source, target: e.target, sourceHandle: e.sourceHandle || undefined, targetHandle: e.targetHandle || undefined
    }));
    onSave?.({ steps, edges });
  };

  const types = ["message", "wait", "condition"];

  return (
    <div className="flex h-full w-full absolute inset-0">
      <div className="w-52 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 space-y-2 overflow-y-auto">
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Blocos</h3>
        {types.map((type) => {
          const cfg = NODE_CONFIGS[type];
          return (
            <div key={type} draggable onDragStart={(e) => { e.dataTransfer.setData("application/reactflow", type); e.dataTransfer.effectAllowed = "move"; }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing hover:shadow-md transition bg-white dark:bg-gray-800" style={{ borderColor: cfg.color }}>
              {type === "message" && <svg className="w-4 h-4" style={{ color: cfg.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>}
              {type === "wait" && <svg className="w-4 h-4" style={{ color: cfg.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              {type === "condition" && <svg className="w-4 h-4" style={{ color: cfg.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>}
              <span className="text-xs font-medium text-gray-900 dark:text-white">{cfg.label}</span>
            </div>
          );
        })}
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
          <button onClick={handleSave} className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition">Salvar fluxo</button>
        </div>
      </div>

      <div className="flex-1" ref={reactFlowWrapper}>
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
            fitView
            deleteKeyCode={["Backspace", "Delete"]}
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
