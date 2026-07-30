"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  ReactFlowProvider,
  ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";

const NODE_CONFIGS: Record<string, { label: string; icon: string; color: string; bg: string; defaultData: any }> = {
  message: { label: "Mensagem", icon: "💬", color: "#3b82f6", bg: "#3b82f610", defaultData: { text: "" } },
  wait: { label: "Aguardar", icon: "⏳", color: "#f59e0b", bg: "#f59e0b10", defaultData: { delay: 1 } },
  condition: { label: "Condição", icon: "🔀", color: "#8b5cf6", bg: "#8b5cf610", defaultData: { variable: "", value: "" } },
};

let nodeId = 0;

function createNode(type: string, position: { x: number; y: number }) {
  nodeId++;
  const cfg = NODE_CONFIGS[type];
  return {
    id: `node-${nodeId}`,
    type: "flowNode",
    position,
    data: { type, label: cfg.label, icon: cfg.icon, color: cfg.color, bg: cfg.bg, config: { ...cfg.defaultData } },
  };
}

function FlowNode({ data }: any) {
  const [editing, setEditing] = useState(false);

  return (
    <div
      className="rounded-2xl border-2 bg-white dark:bg-gray-900 shadow-lg min-w-[200px] overflow-hidden"
      style={{ borderColor: data.color }}
      onDoubleClick={() => setEditing(!editing)}
    >
      <div className="flex items-center gap-2 px-3 py-2 text-white text-sm font-semibold" style={{ backgroundColor: data.color }}>
        <span>{data.icon}</span>
        <span>{data.label}</span>
      </div>

      {editing && data.type === "message" && (
        <div className="p-2">
          <textarea
            value={data.config.text || ""}
            onChange={(e) => { data.config.text = e.target.value; setEditing(true); }}
            placeholder="Digite a mensagem..."
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-white resize-none"
            rows={2}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      {editing && data.type === "wait" && (
        <div className="p-2 flex items-center gap-2 text-xs">
          <span className="text-gray-500">Aguardar</span>
          <input
            type="number"
            value={data.config.delay || 1}
            onChange={(e) => { data.config.delay = parseInt(e.target.value) || 1; setEditing(true); }}
            className="w-12 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-1 py-0.5 text-center text-gray-900 dark:text-white"
          />
          <span className="text-gray-500">min</span>
        </div>
      )}
      {editing && data.type === "condition" && (
        <div className="p-2 space-y-1 text-xs">
          <input placeholder="Variável" className="w-full rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 text-gray-900 dark:text-white" />
          <input placeholder="Valor" className="w-full rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 text-gray-900 dark:text-white" />
        </div>
      )}

      <div className="px-3 py-1 text-[10px] text-gray-400 border-t border-gray-100 dark:border-gray-800">
        Duplo clique para {editing ? "fechar" : "editar"}
      </div>
    </div>
  );
}

const nodeTypes = { flowNode: FlowNode };

const initialNodes: Node[] = [
  {
    id: "start",
    type: "flowNode",
    position: { x: 300, y: 50 },
    data: { type: "start", label: "Início", icon: "▶", color: "#22c55e", bg: "#22c55e10", config: {} },
    draggable: false,
  },
];

interface FlowStep {
  id: string;
  type: string;
  label: string;
  config: Record<string, any>;
}

export default function FlowBuilder({ onSave, initialSteps }: { onSave?: (steps: FlowStep[]) => void; initialSteps?: FlowStep[] }) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  const buildInitialNodes = (): Node[] => {
    if (initialSteps && initialSteps.length > 0) {
      return initialSteps.map((s, i) => {
        const cfg = NODE_CONFIGS[s.type];
        return {
          id: s.id,
          type: "flowNode",
          position: { x: 300, y: 50 + i * 150 },
          data: {
            type: s.type,
            label: s.label || s.type,
            icon: cfg?.icon || "⬜",
            color: cfg?.color || "#6b7280",
            bg: cfg?.bg || "#6b728010",
            config: s.config || {},
          },
          draggable: s.id !== "start",
        };
      });
    }
    return initialNodes;
  };

  const [nodes, setNodes, onNodesChange] = useNodesState(buildInitialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: "#22c55e", strokeWidth: 2 } }, eds)), [setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type || !rfInstance || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = rfInstance.project({
        x: event.clientX - bounds.left - 100,
        y: event.clientY - bounds.top - 30,
      });

      const newNode = createNode(type, position);
      setNodes((nds) => nds.concat(newNode));
    },
    [rfInstance, setNodes]
  );

  const handleSave = () => {
    if (!rfInstance) return;
    const flow = rfInstance.toObject();
    const steps: FlowStep[] = flow.nodes.map((n) => ({
      id: n.id,
      type: n.data.type,
      label: n.data.label,
      config: n.data.config,
    }));
    onSave?.(steps);
  };

  const nodeTypes_list = ["message", "wait", "condition"];

  return (
    <div className="flex h-[calc(100vh-12rem)] -m-8">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Blocos</h3>
        {nodeTypes_list.map((type) => {
          const cfg = NODE_CONFIGS[type];
          return (
            <div
              key={type}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData("application/reactflow", type); e.dataTransfer.effectAllowed = "move"; }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 cursor-grab active:cursor-grabbing hover:shadow-md transition bg-white dark:bg-gray-800"
              style={{ borderColor: cfg.color }}
            >
              <span className="text-lg">{cfg.icon}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{cfg.label}</span>
            </div>
          );
        })}

        <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={handleSave} className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition">
            Salvar fluxo
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1" ref={reactFlowWrapper}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[20, 20]}
          >
            <Controls className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 !rounded-xl !shadow-lg" />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
            <MiniMap className="!rounded-xl !shadow-lg !border-gray-200 dark:!border-gray-700" nodeColor={(n) => n.data?.color || "#6b7280"} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}
