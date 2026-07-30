"use client";

import { useEffect, useState, useRef } from "react";
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTriggering(null);
    setConfirmFlow(null);
    setProgress(null);
    fetch("/api/flows").then((r) => r.json()).then(setFlows).catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const res = await fetch(`/api/flows/progress?conversation_id=${conversationId}`);
        if (!res.ok) return;
        const data = await res.json();
        setProgress(data);
      } catch {}
    };
    fetchProgress();
    const interval = setInterval(fetchProgress, 3000);
    return () => clearInterval(interval);
  }, [conversationId]);

  const handleTrigger = async (flow: FlowCard) => {
    setConfirmFlow(flow);
  };

  const cancelExecution = async (execId: string) => {
    await fetch("/api/flows/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ execution_id: execId }),
    });
    setProgress(null);
    toast.success("Fluxo cancelado");
  };

  const doTrigger = async () => {
    if (!confirmFlow) return;
    const flow = confirmFlow;
    setConfirmFlow(null);
    if (!phoneNumberId || !customerPhone) {
      toast.error("Canal não configurado");
      return;
    }
    setTriggering(flow.id);
    try {
      const res = await fetch("/api/flows/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flow_id: flow.id,
          conversation_id: conversationId,
          customer_phone: customerPhone,
          phone_number_id: phoneNumberId,
        }),
      });
      const result = await res.json();
      if (!result.ok && result.error) toast.error(result.error);
    } catch { toast.error("Erro"); }
    setTriggering(null);
  };

  const stepLabels: Record<string, string> = {
    start: "Início",
    message: "Mensagem",
    wait: "Aguardar",
    condition: "Condição",
  };

  const stepColors: Record<string, string> = {
    start: "#22c55e",
    message: "#3b82f6",
    wait: "#f59e0b",
    condition: "#8b5cf6",
  };

  return (
    <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-[#f0f2f5] dark:bg-[#1a252c]">
      {/* Flow progress indicator */}
      {progress && (
        <div className="px-3 py-1.5 flex items-center gap-2 border-b border-gray-200/50 dark:border-gray-800/50">
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
            <span className="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[180px]">{progress.flowName}</span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] ml-auto">
            {progress.currentStep && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: stepColors[progress.currentStep.type] || "#6b7280" }} />
                <span className="text-gray-500">Agora:</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">{progress.currentStep.label}</span>
              </span>
            )}
            {progress.nextStep ? (
              <>
                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: stepColors[progress.nextStep.type] || "#6b7280" }} />
                  <span className="text-gray-500">Próximo:</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{progress.nextStep.label}</span>
                </span>
              </>
            ) : (
              <>
                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                <span className="text-gray-400">Encerramento do fluxo</span>
              </>
            )}
            {progress.status === "paused" && progress.nextStepAt && (
              <span className="text-[10px] text-amber-500 ml-1">
                em {Math.max(0, Math.ceil((new Date(progress.nextStepAt).getTime() - Date.now()) / 1000))}s
              </span>
            )}
          </div>
        </div>
      )}

      {/* Horizontal flow trigger cards */}
      <div className="px-3 py-1.5">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5 font-semibold">Fluxos</p>
        <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {flows.map((flow) => (
            <button
              key={flow.id}
              disabled={triggering === flow.id}
              onClick={() => handleTrigger(flow)}
              className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-emerald-400 hover:shadow-sm transition text-left disabled:opacity-50"
            >
              {triggering === flow.id ? (
                <div className="animate-spin w-3 h-3 border-[1.5px] border-gray-300 border-t-emerald-500 rounded-full" />
              ) : (
                <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              )}
              <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{flow.name}</span>
            </button>
          ))}
          {flows.length === 0 && (
            <span className="text-[11px] text-gray-400 py-1">Nenhum fluxo disponível</span>
          )}
          </div>
          <button onClick={() => progress && cancelExecution(progress.id)} className="ml-1 p-0.5 text-gray-400 hover:text-red-500 transition" title="Cancelar fluxo">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

      {confirmFlow && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setConfirmFlow(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl p-5 mb-4 animate-in" onClick={(e) => e.stopPropagation()}>
            <svg className="w-10 h-10 mx-auto mb-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className="text-center text-sm text-gray-700 dark:text-gray-300 mb-1">
              Tem certeza que deseja disparar o fluxo
            </p>
            <p className="text-center text-base font-bold text-gray-900 dark:text-white mb-4">
              &ldquo;{confirmFlow.name}&rdquo;?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmFlow(null)} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                Cancelar
              </button>
              <button onClick={doTrigger} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500">
                Sim, disparar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
