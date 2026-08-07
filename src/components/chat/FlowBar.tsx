"use client";

import { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Play, Search, X, AlertTriangle, GripVertical, ListOrdered, ChevronUp, ChevronDown } from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove,
  horizontalListSortingStrategy, verticalListSortingStrategy, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import toast from "react-hot-toast";

interface FlowProgress {
  id: string;
  flowName: string;
  status: string;
  currentStep: { id: string; type: string; label: string } | null;
  nextStep: { id: string; type: string; label: string } | null;
  totalSteps: number;
  currentStepIndex: number;
  nextStepAt: string | null;
}

interface FlowCard {
  id: string;
  name: string;
  status: string;
  config: any;
}

// ── Chip sortável (barra horizontal) ──
function SortableChip({ flow, triggering, onTrigger }: { flow: FlowCard; triggering: boolean; onTrigger: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: flow.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex-shrink-0 flex items-center rounded-lg border bg-surface cursor-grab active:cursor-grabbing touch-none select-none transition-colors ${isDragging ? "border-accent shadow-pop" : "border-bd hover:border-accent/60"}`}
    >
      <span className="pl-1.5 text-tx3">
        <GripVertical className="w-3.5 h-3.5" strokeWidth={2} />
      </span>
      <button
        disabled={triggering}
        onClick={onTrigger}
        className="flex items-center gap-1.5 pl-1 pr-2.5 py-1.5 text-left disabled:opacity-50"
      >
        {triggering ? (
          <span className="block w-3.5 h-3.5 border-[1.5px] border-accent/40 border-t-accent rounded-full animate-spin" />
        ) : (
          <span className="w-5 h-5 rounded-full bg-accentsoft flex items-center justify-center flex-shrink-0">
            <Play className="w-2.5 h-2.5 text-accent" fill="currentColor" strokeWidth={0} />
          </span>
        )}
        <span className="text-[11px] font-semibold text-tx whitespace-nowrap">{flow.name}</span>
      </button>
    </div>
  );
}

// ── Linha sortável (popup vertical) ──
function SortableRow({ flow, index, total, onUp, onDown }: { flow: FlowCard; index: number; total: number; onUp: () => void; onDown: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: flow.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 20 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-2 py-2 rounded-control border bg-surface ${isDragging ? "border-accent shadow-pop" : "border-bd"}`}
    >
      <span {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none text-tx3 hover:text-tx flex-shrink-0" title="Arraste para reordenar">
        <GripVertical className="w-4 h-4" strokeWidth={2} />
      </span>
      <span className="w-6 h-6 rounded-full bg-surface2 flex items-center justify-center text-[10px] font-bold text-tx3 flex-shrink-0">{index + 1}</span>
      <span className="text-[13px] font-semibold text-tx truncate flex-1 min-w-0">{flow.name}</span>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button onClick={onUp} disabled={index === 0} className="p-1 rounded-lg text-tx3 hover:text-accent hover:bg-hover disabled:opacity-20 disabled:hover:bg-transparent transition" title="Subir">
          <ChevronUp className="w-4 h-4" strokeWidth={2.2} />
        </button>
        <button onClick={onDown} disabled={index === total - 1} className="p-1 rounded-lg text-tx3 hover:text-accent hover:bg-hover disabled:opacity-20 disabled:hover:bg-transparent transition" title="Descer">
          <ChevronDown className="w-4 h-4" strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}

export default function FlowBar({
  conversationId,
  phoneNumberId,
  customerPhone,
}: {
  conversationId: string;
  phoneNumberId: string;
  customerPhone: string;
}) {
  const [flows, setFlows] = useState<FlowCard[]>([]);
  const [progress, setProgress] = useState<FlowProgress | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [confirmFlow, setConfirmFlow] = useState<FlowCard | null>(null);
  const [flowSearch, setFlowSearch] = useState("");
  const [showReorder, setShowReorder] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const momentumRef = useRef(0);
  const animRef = useRef<number>(0);

  const isSearching = !!flowSearch.trim();
  const filteredFlows = isSearching
    ? flows.filter(f => f.name.toLowerCase().includes(flowSearch.trim().toLowerCase()))
    : flows;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    setTriggering(null);
    setConfirmFlow(null);
    setProgress(null);
    fetch("/api/flows").then((r) => r.json()).then(setFlows).catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      momentumRef.current += e.deltaY;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      const animate = () => {
        const current = momentumRef.current;
        const step = current * 0.15;
        if (Math.abs(current) < 0.5) { momentumRef.current = 0; animRef.current = 0; return; }
        momentumRef.current -= step;
        el.scrollLeft += step;
        animRef.current = requestAnimationFrame(animate);
      };
      animRef.current = requestAnimationFrame(animate);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => { el.removeEventListener("wheel", handler); if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const res = await fetch(`/api/flows/progress?conversation_id=${conversationId}`);
        if (!res.ok) return;
        setProgress(await res.json());
      } catch {}
    };
    fetchProgress();
    const interval = setInterval(fetchProgress, 3000);
    return () => clearInterval(interval);
  }, [conversationId]);

  const handleTrigger = (flow: FlowCard) => setConfirmFlow(flow);

  const cancelExecution = async (execId: string) => {
    await fetch("/api/flows/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ execution_id: execId }) });
    setProgress(null);
    toast.success("Fluxo cancelado");
  };

  const doTrigger = async () => {
    if (!confirmFlow) return;
    const flow = confirmFlow;
    setTriggering(flow.id);
    setConfirmFlow(null);
    if (!phoneNumberId || !customerPhone) { toast.error("Canal não configurado"); setTriggering(null); return; }
    try {
      const res = await fetch("/api/flows/trigger", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow_id: flow.id, conversation_id: conversationId, customer_phone: customerPhone, phone_number_id: phoneNumberId }),
      });
      const result = await res.json();
      if (!result.ok && result.error) toast.error(result.error);
      else window.dispatchEvent(new CustomEvent("flow-triggered"));
    } catch { toast.error("Erro"); }
    setTriggering(null);
  };

  // Aplica nova ordem (otimista) e persiste; reverte se falhar
  const commitOrder = async (newFlows: FlowCard[], movedId: string) => {
    const prev = flows;
    setFlows(newFlows);
    const newIndex = newFlows.findIndex((f) => f.id === movedId);
    try {
      const res = await fetch("/api/flows/reorder", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow_id: movedId, target_index: newIndex }),
      });
      if (!res.ok) { setFlows(prev); toast.error("Não foi possível salvar a ordem"); }
    } catch { setFlows(prev); toast.error("Erro ao salvar ordem"); }
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = flows.findIndex((f) => f.id === active.id);
    const newI = flows.findIndex((f) => f.id === over.id);
    if (oldI < 0 || newI < 0) return;
    commitOrder(arrayMove(flows, oldI, newI), String(active.id));
  };

  const moveByButton = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= flows.length) return;
    commitOrder(arrayMove(flows, idx, target), flows[idx].id);
  };

  const stepColors: Record<string, string> = { start: "#22c55e", message: "#3b82f6", wait: "#f59e0b", condition: "#8b5cf6" };
  const scrollBy = (dx: number) => scrollRef.current?.scrollBy({ left: dx, behavior: "smooth" });

  return (
    <div className="flex-shrink-0 border-t border-bd bg-surface2 overflow-hidden max-w-full">
      {/* Progresso do fluxo em execução */}
      {progress && (
        <div className="px-3 py-1.5 flex items-center gap-2 border-b border-line">
          <div className="flex items-center gap-1.5 text-[11px] min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse flex-shrink-0" />
            <span className="font-bold text-tx truncate max-w-[160px]">{progress.flowName}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] ml-auto min-w-0">
            {progress.currentStep && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: stepColors[progress.currentStep.type] || "#6b7280" }} />
                <span className="text-tx3">Agora:</span>
                <span className="font-semibold text-tx2">{progress.currentStep.label}</span>
              </span>
            )}
            {progress.nextStep ? (
              <>
                <ChevronRight className="w-3 h-3 text-tx3" strokeWidth={2} />
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: stepColors[progress.nextStep.type] || "#6b7280" }} />
                  <span className="text-tx3">Próximo:</span>
                  <span className="font-semibold text-tx2">{progress.nextStep.label}</span>
                </span>
              </>
            ) : (
              <>
                <ChevronRight className="w-3 h-3 text-tx3" strokeWidth={2} />
                <span className="text-tx3">Encerramento do fluxo</span>
              </>
            )}
            {progress.status === "paused" && progress.nextStepAt && (
              <span className="text-[10px] text-amber-500 ml-1 flex-shrink-0">
                em {Math.max(0, Math.ceil((new Date(progress.nextStepAt).getTime() - Date.now()) / 1000))}s
              </span>
            )}
          </div>
          <button onClick={() => cancelExecution(progress.id)} className="ml-1 p-1 rounded-full text-tx3 hover:text-red-500 hover:bg-hover transition flex-shrink-0" title="Cancelar fluxo">
            <X className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Disparar fluxos */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-[10px] text-tx3 uppercase tracking-wider font-bold flex-shrink-0">Fluxos</p>
          <div className="relative flex-1 max-w-[200px]">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-tx3" strokeWidth={2} />
            <input
              type="text"
              value={flowSearch}
              onChange={(e) => setFlowSearch(e.target.value)}
              placeholder="Buscar fluxo..."
              className="w-full rounded-full border border-bd bg-surface pl-6 pr-2 py-1 text-[11px] text-tx placeholder:text-tx3 focus:border-accent focus:outline-none"
            />
          </div>
          <button
            onClick={() => setShowReorder(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-tx2 hover:text-accent hover:bg-hover transition flex-shrink-0"
            title="Reordenar fluxos"
          >
            <ListOrdered className="w-3.5 h-3.5" strokeWidth={2} />
            <span className="hidden sm:inline">Reordenar</span>
          </button>
          {!isSearching && flows.length > 3 && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={() => scrollBy(-200)} className="p-1 rounded-lg text-tx3 hover:text-tx hover:bg-hover transition" title="Rolar para esquerda">
                <ChevronLeft className="w-4 h-4" strokeWidth={2} />
              </button>
              <button onClick={() => scrollBy(200)} className="p-1 rounded-lg text-tx3 hover:text-tx hover:bg-hover transition" title="Rolar para direita">
                <ChevronRight className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          )}
        </div>

        {isSearching ? (
          // Durante a busca: sem arrastar (índices não batem), só disparar
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filteredFlows.length === 0 && <span className="text-[11px] text-tx3 py-1.5">Nenhum fluxo encontrado</span>}
            {filteredFlows.map((flow) => (
              <div key={flow.id} className="flex-shrink-0 flex items-center rounded-lg border border-bd bg-surface">
                <button disabled={triggering === flow.id} onClick={() => handleTrigger(flow)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-left disabled:opacity-50">
                  <span className="w-5 h-5 rounded-full bg-accentsoft flex items-center justify-center flex-shrink-0">
                    <Play className="w-2.5 h-2.5 text-accent" fill="currentColor" strokeWidth={0} />
                  </span>
                  <span className="text-[11px] font-semibold text-tx whitespace-nowrap">{flow.name}</span>
                </button>
              </div>
            ))}
          </div>
        ) : flows.length === 0 ? (
          <div className="py-1.5"><span className="text-[11px] text-tx3">Nenhum fluxo disponível</span></div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={flows.map((f) => f.id)} strategy={horizontalListSortingStrategy}>
              <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-1">
                {flows.map((flow) => (
                  <SortableChip key={flow.id} flow={flow} triggering={triggering === flow.id} onTrigger={() => handleTrigger(flow)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Popup de reordenação dedicado */}
      {showReorder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowReorder(false)}>
          <div className="w-full max-w-md rounded-card border border-bd bg-surface shadow-pop flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-bd flex-shrink-0">
              <div>
                <h3 className="text-sm font-bold text-tx flex items-center gap-2"><ListOrdered className="w-4 h-4 text-accent" strokeWidth={2} /> Reordenar fluxos</h3>
                <p className="text-[11px] text-tx3 mt-0.5">Arraste pela alça ou use as setas ↑ ↓</p>
              </div>
              <button onClick={() => setShowReorder(false)} className="p-1.5 rounded-lg text-tx3 hover:text-tx hover:bg-hover transition">
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
            <div className="p-3 overflow-y-auto space-y-1.5">
              {flows.length === 0 ? (
                <p className="text-sm text-tx3 text-center py-8">Nenhum fluxo</p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={flows.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                    {flows.map((flow, idx) => (
                      <SortableRow
                        key={flow.id}
                        flow={flow}
                        index={idx}
                        total={flows.length}
                        onUp={() => moveByButton(idx, -1)}
                        onDown={() => moveByButton(idx, 1)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
            <div className="px-5 py-3 border-t border-bd flex-shrink-0">
              <button onClick={() => setShowReorder(false)} className="w-full rounded-control bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-accent2 transition">
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmFlow && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setConfirmFlow(null)}>
          <div className="w-full max-w-sm rounded-card border border-bd bg-surface shadow-pop p-5 mb-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-amber-500/15 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-500" strokeWidth={1.8} />
            </div>
            <p className="text-center text-sm text-tx2 mb-1">Tem certeza que deseja disparar o fluxo</p>
            <p className="text-center text-base font-bold text-tx mb-4">&ldquo;{confirmFlow.name}&rdquo;?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmFlow(null)} className="flex-1 rounded-control border border-bd px-4 py-2.5 text-sm font-semibold text-tx2 hover:bg-hover transition">Cancelar</button>
              <button onClick={doTrigger} className="flex-1 rounded-control bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-accent2 transition">Sim, disparar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
