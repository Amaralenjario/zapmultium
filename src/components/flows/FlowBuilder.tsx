"use client";

import { useState } from "react";

interface FlowStep {
  id: string;
  type: "start" | "message" | "wait" | "condition" | "end";
  label: string;
  config: { text?: string; delay?: number; variable?: string };
}

const NODE_COLORS: Record<string, string> = {
  start: "#22c55e",
  message: "#3b82f6",
  wait: "#f59e0b",
  condition: "#8b5cf6",
  end: "#ef4444",
};

const NODE_ICONS: Record<string, string> = {
  start: "▶",
  message: "💬",
  wait: "⏳",
  condition: "🔀",
  end: "⏹",
};

export default function FlowBuilder({ onSave }: { onSave?: (steps: FlowStep[]) => void }) {
  const [steps, setSteps] = useState<FlowStep[]>([
    { id: "start", type: "start", label: "Início", config: {} },
  ]);
  const [editing, setEditing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>("start");

  const addStep = (type: FlowStep["type"], afterId: string) => {
    const id = Date.now().toString();
    const labels: Record<string, string> = {
      message: "Enviar mensagem",
      wait: "Aguardar",
      condition: "Condição",
      end: "Fim",
    };
    const newStep: FlowStep = {
      id,
      type,
      label: labels[type] || type,
      config: type === "message" ? { text: "" } : type === "wait" ? { delay: 1 } : {},
    };
    const idx = steps.findIndex((s) => s.id === afterId);
    const newSteps = [...steps];
    newSteps.splice(idx + 1, 0, newStep);
    setSteps(newSteps);
    setExpanded(id);
  };

  const removeStep = (id: string) => {
    if (id === "start") return;
    setSteps(steps.filter((s) => s.id !== id));
  };

  const updateConfig = (id: string, config: Partial<FlowStep["config"]>) => {
    setSteps(steps.map((s) => (s.id === id ? { ...s, config: { ...s.config, ...config } } : s)));
  };

  const moveStep = (id: string, direction: "up" | "down") => {
    const idx = steps.findIndex((s) => s.id === id);
    if (idx === -1 || idx === 0) return;
    if (direction === "down" && idx === steps.length - 1) return;
    const newSteps = [...steps];
    const target = direction === "up" ? idx - 1 : idx + 1;
    [newSteps[idx], newSteps[target]] = [newSteps[target], newSteps[idx]];
    setSteps(newSteps);
  };

  const availableTypes: FlowStep["type"][] = ["message", "wait", "condition", "end"];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fluxos</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Construtor de fluxos de atendimento</p>
        </div>
        <button onClick={() => onSave?.(steps)} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition shadow-lg shadow-emerald-500/25">
          Salvar fluxo
        </button>
      </div>

      <div className="max-w-lg mx-auto">
        {steps.map((step, i) => {
          const color = NODE_COLORS[step.type];
          const isLast = i === steps.length - 1;
          const isExpanded = expanded === step.id;
          const showMenu = step.type !== "start" && step.type !== "end";

          return (
            <div key={step.id} className="relative">
              {/* Connection line */}
              {i > 0 && (
                <div className="flex justify-center py-1">
                  <div className="w-0.5 h-6 bg-gray-300 dark:bg-gray-600 rounded" />
                </div>
              )}

              {/* Node */}
              <div
                className="relative rounded-2xl border-2 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition cursor-pointer"
                style={{ borderColor: color }}
                onClick={() => setExpanded(isExpanded ? null : step.id)}
              >
                <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: `${color}10` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm" style={{ backgroundColor: color }}>
                    {NODE_ICONS[step.type]}
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white flex-1">{step.label}</span>
                  {step.type === "message" && step.config.text && (
                    <span className="text-[11px] text-gray-400 truncate max-w-[120px]">{step.config.text}</span>
                  )}
                  {step.type === "wait" && step.config.delay && (
                    <span className="text-[11px] text-gray-400">{step.config.delay}min</span>
                  )}
                  {showMenu && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); moveStep(step.id, "up"); }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Mover para cima">▲</button>
                      <button onClick={(e) => { e.stopPropagation(); moveStep(step.id, "down"); }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Mover para baixo">▼</button>
                      <button onClick={(e) => { e.stopPropagation(); removeStep(step.id); }} className="p-1 text-red-400 hover:text-red-500" title="Remover">✕</button>
                    </>
                  )}
                </div>

                {/* Expanded config */}
                {isExpanded && step.type === "message" && (
                  <div className="px-4 pb-3 pt-1 space-y-2">
                    <textarea
                      value={step.config.text || ""}
                      onChange={(e) => updateConfig(step.id, { text: e.target.value })}
                      placeholder="Digite a mensagem que será enviada..."
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none"
                      rows={3}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
                {isExpanded && step.type === "wait" && (
                  <div className="px-4 pb-3 pt-1 flex items-center gap-2">
                    <span className="text-sm text-gray-500">Aguardar</span>
                    <input
                      type="number"
                      value={step.config.delay || 1}
                      onChange={(e) => updateConfig(step.id, { delay: parseInt(e.target.value) || 1 })}
                      className="w-16 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-sm text-center text-gray-900 dark:text-white focus:border-yellow-500 focus:outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-sm text-gray-500">minuto(s)</span>
                  </div>
                )}
              </div>

              {/* Add button below each node */}
              {!isLast && (
                <div className="flex justify-center -mb-3 relative z-10">
                  <div className="flex gap-1 bg-white dark:bg-gray-900 px-1 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm">
                    {availableTypes.filter(t => t !== "end" || isLast).map((type) => (
                      <button
                        key={type}
                        onClick={() => addStep(type, step.id)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs hover:scale-110 transition"
                        style={{ backgroundColor: NODE_COLORS[type] + "20", color: NODE_COLORS[type] }}
                        title={`Adicionar ${type}`}
                      >
                        {NODE_ICONS[type]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
