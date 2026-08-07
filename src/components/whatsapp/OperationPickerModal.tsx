"use client";

import { Check } from "lucide-react";

interface Operation { id: string; name: string; color: string; }

export default function OperationPickerModal({
  operations, currentOpId, onSelect, onClose,
}: {
  operations: Operation[];
  currentOpId?: string;
  onSelect: (opId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-xs rounded-card border border-bd bg-surface shadow-pop p-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-tx mb-3">Selecionar operação</h3>
        <div className="space-y-1">
          {operations.map((op) => (
            <button
              key={op.id}
              onClick={() => onSelect(op.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-control text-sm transition ${op.id === currentOpId ? "bg-accentsoft" : "hover:bg-hover"}`}
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: op.color }} />
              <span className="font-bold text-tx">{op.name}</span>
              {op.id === currentOpId && <Check className="w-4 h-4 ml-auto text-accent" strokeWidth={2.5} />}
            </button>
          ))}
          {operations.length === 0 && <p className="text-sm text-tx3 text-center py-4">Nenhuma operação disponível</p>}
        </div>
        <button onClick={onClose} className="w-full mt-2 py-2 text-xs font-semibold text-tx3 hover:text-tx rounded-lg hover:bg-hover transition">Cancelar</button>
      </div>
    </div>
  );
}
