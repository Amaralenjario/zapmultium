"use client";

import { Check, User, UserX } from "lucide-react";

interface Seller { id: string; name: string; }

export default function SellerPickerModal({
  sellers, currentSellerId, channelName, onSelect, onClose,
}: {
  sellers: Seller[];
  currentSellerId?: string | null;
  channelName?: string;
  onSelect: (userId: string | null) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-xs rounded-card border border-bd bg-surface shadow-pop p-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-tx mb-0.5">Vendedor do número</h3>
        {channelName && <p className="text-[11px] text-tx3 mb-3 truncate">{channelName}</p>}
        <div className="space-y-1 max-h-72 overflow-y-auto">
          <button
            onClick={() => onSelect(null)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-control text-sm transition ${!currentSellerId ? "bg-accentsoft" : "hover:bg-hover"}`}
          >
            <span className="w-6 h-6 rounded-full bg-surface2 flex items-center justify-center flex-shrink-0"><UserX className="w-3.5 h-3.5 text-tx3" strokeWidth={2} /></span>
            <span className="font-semibold text-tx2">Sem vendedor</span>
            {!currentSellerId && <Check className="w-4 h-4 ml-auto text-accent" strokeWidth={2.5} />}
          </button>
          {sellers.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-control text-sm transition ${s.id === currentSellerId ? "bg-accentsoft" : "hover:bg-hover"}`}
            >
              <span className="w-6 h-6 rounded-full bg-accentsoft flex items-center justify-center flex-shrink-0"><User className="w-3.5 h-3.5 text-accent" strokeWidth={2} /></span>
              <span className="font-bold text-tx truncate">{s.name}</span>
              {s.id === currentSellerId && <Check className="w-4 h-4 ml-auto text-accent flex-shrink-0" strokeWidth={2.5} />}
            </button>
          ))}
          {sellers.length === 0 && <p className="text-sm text-tx3 text-center py-4">Nenhum vendedor cadastrado</p>}
        </div>
        <button onClick={onClose} className="w-full mt-2 py-2 text-xs font-semibold text-tx3 hover:text-tx rounded-lg hover:bg-hover transition">Cancelar</button>
      </div>
    </div>
  );
}
