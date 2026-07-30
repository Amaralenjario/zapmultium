"use client";

interface Operation {
  id: string;
  name: string;
  color: string;
}

export default function OperationPickerModal({
  operations,
  currentOpId,
  onSelect,
  onClose,
}: {
  operations: Operation[];
  currentOpId?: string;
  onSelect: (opId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-xs rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Selecionar operação</h3>
        <div className="space-y-1">
          {operations.map((op) => (
            <button
              key={op.id}
              onClick={() => onSelect(op.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
                op.id === currentOpId
                  ? "bg-gray-100 dark:bg-gray-800"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
              }`}
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: op.color }} />
              <span className="font-medium text-gray-900 dark:text-white">{op.name}</span>
              {op.id === currentOpId && (
                <svg className="w-4 h-4 ml-auto text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              )}
            </button>
          ))}
          {operations.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Nenhuma operação disponível</p>
          )}
        </div>
        <button onClick={onClose} className="w-full mt-2 py-2 text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancelar</button>
      </div>
    </div>
  );
}
