"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Plus, Trash2, Copy, ExternalLink, MessageCircle, AlertTriangle, Repeat2, FolderOpen, User, RefreshCw, Link2, Server } from "lucide-react";
import CreateChannelModal from "@/components/whatsapp/CreateChannelModal";
import OperationPickerModal from "@/components/whatsapp/OperationPickerModal";
import SellerPickerModal from "@/components/whatsapp/SellerPickerModal";
import EvoAccountsModal from "@/components/whatsapp/EvoAccountsModal";
import toast from "react-hot-toast";

// Link do webhook (Edge Function no "banco de dados" Supabase) pra colar num canal novo no EvoHub.
const WEBHOOK_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL || ""}/functions/v1/evohub-webhook`;

interface Channel {
  id: string;
  name: string;
  status: string;
  token: string;
  displayPhone?: string;
  profilePicture?: string;
  created_at: string;
}

// Avatar do número: mostra a foto de perfil do WhatsApp; se faltar/expirar, cai no ícone.
function ChannelAvatar({ src, active }: { src?: string; active: boolean }) {
  const [err, setErr] = useState(false);
  const show = src && !err;
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${active ? "bg-success-soft text-success" : "bg-surface2 text-tx3"}`}>
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-full h-full object-cover" onError={() => setErr(true)} />
      ) : (
        <MessageCircle className="w-[1.15rem] h-[1.15rem]" strokeWidth={2} />
      )}
    </div>
  );
}

const KNOWN_PHONES: Record<string, string> = {
  "5145a0c0-a358-43e5-8269-c5ace26ca023": "897878513398151",
  "effa72d1-47f6-445b-acbc-7693ef21ee24": "976034132269824",
  "c5505ddf-f9ef-4837-9337-45ed3de40d6a": "892228177298374",
  "346e4eef-bc78-41ec-a7ae-ec7ec75bf177": "1034222499765101",
  "b1c6879b-e962-4f50-95f7-14f1a04601a5": "1234821229708132",
};

const STATUS_CONFIG: Record<string, { label: string; dot: string; cls: string }> = {
  active: { label: "Conectado", dot: "bg-success", cls: "bg-success-soft text-success" },
  inactive: { label: "Pendente", dot: "bg-amber-500", cls: "bg-amber-500/12 text-amber-600 dark:text-amber-400" },
  connecting: { label: "Conectando", dot: "bg-accent animate-pulse", cls: "bg-accentsoft text-accent" },
  banned: { label: "Banido", dot: "bg-red-500", cls: "bg-red-500/12 text-red-600 dark:text-red-400" },
  disconnected: { label: "Desconectado", dot: "bg-tx3", cls: "bg-surface2 text-tx2" },
};
function getStatus(s: string) { return STATUS_CONFIG[s] || { label: s, dot: "bg-tx3", cls: "bg-surface2 text-tx2" }; }
function daysAgo(date: string) { return Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 86400000)); }

const NO_OP = "__none__";

export default function WhatsappPageClient({
  initialChannels,
  phoneMap: initialPhoneMap,
}: {
  initialChannels: Channel[];
  phoneMap: Record<string, { phoneId: string; opName: string; opColor: string; opId: string }>;
}) {
  const [showModal, setShowModal] = useState(false);
  const [createForOp, setCreateForOp] = useState<{ id: string; name: string } | null>(null);
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [phoneMap, setPhoneMap] = useState(initialPhoneMap);
  const [deleteTarget, setDeleteTarget] = useState<Channel | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [operations, setOperations] = useState<{ id: string; name: string; color: string }[]>([]);
  const [pickerFor, setPickerFor] = useState<Channel | null>(null);
  const [sellers, setSellers] = useState<{ id: string; name: string; evohub_channel_id: string | null }[]>([]);
  const [sellerPickerFor, setSellerPickerFor] = useState<Channel | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);

  const fetchChannels = useCallback(async () => {
    const res = await fetch("/api/evohub/channels");
    if (res.ok) {
      const data = await res.json();
      if (data.channels?.length > 0) setChannels(data.channels);
      if (data.phoneMap) setPhoneMap(data.phoneMap);
    }
  }, []);

  const fetchSellers = useCallback(async () => {
    try { const res = await fetch("/api/sellers"); if (res.ok) setSellers(await res.json()); } catch {}
  }, []);

  useEffect(() => { fetchChannels(); fetchSellers(); fetch("/api/operations").then(r => r.json()).then(setOperations); }, [fetchChannels, fetchSellers]);

  // canal -> vendedor atribuído (1 por número).
  const channelToSeller = useMemo(() => {
    const map: Record<string, { id: string; name: string }> = {};
    for (const s of sellers) if (s.evohub_channel_id) map[s.evohub_channel_id] = { id: s.id, name: s.name };
    return map;
  }, [sellers]);

  // Sincroniza (puxa) os canais do EvoHub + vendedores na hora.
  const handleSync = async () => {
    setSyncing(true);
    await Promise.all([fetchChannels(), fetchSellers()]);
    setSyncing(false);
    toast.success("Sincronizado!");
  };

  const assignSeller = async (channelId: string, userId: string | null) => {
    const res = await fetch("/api/evohub/channels/assign-seller", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evohub_channel_id: channelId, user_id: userId }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || "Erro ao trocar vendedor"); return; }
    toast.success(userId ? "Vendedor atribuído!" : "Vendedor removido");
    fetchSellers();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch("/api/evohub/delete-channel", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId: deleteTarget.id }) });
    if (!res.ok) { toast.error("Erro"); setDeleting(false); return; }
    toast.success("Excluída!");
    setChannels(prev => prev.filter(c => c.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
  };

  const changeOperation = async (channelId: string, newOpId: string, channelName: string) => {
    const phoneId = phoneMap[channelId]?.phoneId || KNOWN_PHONES[channelId] || "";
    const res = await fetch(`/api/operations/${newOpId}/channels`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evohub_channel_id: channelId, evohub_channel_name: channelName, phone_number_id: phoneId || null }),
    });
    if (!res.ok) { const d = await res.json(); toast.error(d.error || "Erro"); return; }
    toast.success("Operação alterada!");
    fetchChannels();
  };

  // Vincula um canal (recém-criado) a uma operação — telefone entra depois, ao conectar
  const assignChannelToOp = async (channelId: string, channelName: string, opId: string) => {
    await fetch(`/api/operations/${opId}/channels`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evohub_channel_id: channelId, evohub_channel_name: channelName, phone_number_id: null }),
    });
  };

  const openConnect = (op?: { id: string; name: string }) => { setCreateForOp(op || null); setShowModal(true); };
  const handleChannelCreated = async (ch: { id: string; name: string }) => {
    if (createForOp) { await assignChannelToOp(ch.id, ch.name, createForOp.id); }
    fetchChannels();
    setShowModal(false);
    setCreateForOp(null);
  };

  const connected = channels.filter(c => c.status === "active").length;

  // Agrupa por operação — TODAS as operações viram pasta (mesmo vazias)
  const groups = useMemo(() => {
    const map: Record<string, { key: string; name: string; color: string; opId: string | null; channels: Channel[] }> = {};
    // 1) cria uma pasta pra cada operação existente
    for (const op of operations) {
      map[op.id] = { key: op.id, name: op.name, color: op.color, opId: op.id, channels: [] };
    }
    // 2) distribui os canais
    for (const ch of channels) {
      const m = phoneMap[ch.id];
      const key = m?.opId && map[m.opId] ? m.opId : (m?.opId || NO_OP);
      if (!map[key]) map[key] = { key, name: m?.opName || "Sem operação", color: m?.opColor || "var(--tx3)", opId: key === NO_OP ? null : key, channels: [] };
      map[key].channels.push(ch);
    }
    return Object.values(map).sort((a, b) => {
      if (a.key === NO_OP) return 1;
      if (b.key === NO_OP) return -1;
      return a.name.localeCompare(b.name);
    });
  }, [channels, phoneMap, operations]);

  const renderCard = (ch: Channel, opColor: string) => {
    const st = getStatus(ch.status);
    const isActive = ch.status === "active";
    const link = `https://app.evohub.evolutionfoundation.com.br/connect/${ch.token}`;
    const phone = (ch as any).displayPhone;
    const days = daysAgo(ch.created_at);
    const seller = channelToSeller[ch.id];

    return (
      <div key={ch.id} className="group rounded-card border border-bd bg-surface p-4 hover:shadow-pop transition-all" style={{ borderLeftWidth: "3px", borderLeftColor: opColor }}>
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <ChannelAvatar src={ch.profilePicture} active={isActive} />
            <p className="font-bold text-sm text-tx truncate">{ch.name}</p>
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 flex-shrink-0 ${st.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}
          </span>
        </div>

        <div className="space-y-2 text-sm">
          {phone && (
            <div className="flex items-center justify-between">
              <span className="text-tx3 text-xs">Telefone</span>
              <span className="font-bold text-tx text-xs tabular-nums">{phone}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-tx3 text-xs">Criado</span>
            <span className="text-xs text-tx2">{new Date(ch.created_at).toLocaleDateString("pt-BR")}<span className="text-tx3 ml-1">· {days} dia{days > 1 ? "s" : ""}</span></span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-tx3 text-xs">Vendedor</span>
            <button onClick={() => setSellerPickerFor(ch)} className="flex items-center gap-1 text-xs font-bold text-tx hover:text-accent transition max-w-[60%]" title="Trocar vendedor">
              <User className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
              <span className="truncate">{seller ? seller.name : <span className="text-tx3 font-semibold">Definir</span>}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-line">
          {!isActive ? (
            <>
              <a href={link} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1 text-[11px] font-bold text-tx2 hover:text-tx py-1.5 rounded-lg hover:bg-hover transition"><ExternalLink className="w-3.5 h-3.5" strokeWidth={2} /> Abrir</a>
              <button onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado!"); }} className="flex-1 flex items-center justify-center gap-1 text-[11px] font-bold text-accent py-1.5 rounded-lg hover:bg-accentsoft transition"><Copy className="w-3.5 h-3.5" strokeWidth={2} /> Copiar</button>
            </>
          ) : (
            <span className="flex-1 text-center text-[11px] text-tx3 py-1.5">{days} dia{days > 1 ? "s" : ""} ativo</span>
          )}
          <button onClick={() => setPickerFor(ch)} className="p-1.5 text-tx3 hover:text-accent hover:bg-accentsoft rounded-lg transition flex-shrink-0" title="Trocar operação"><Repeat2 className="w-4 h-4" strokeWidth={2} /></button>
          <button onClick={() => setDeleteTarget(ch)} className="p-1.5 text-tx3 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition flex-shrink-0" title="Excluir"><Trash2 className="w-4 h-4" strokeWidth={2} /></button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-tx">WhatsApps</h1>
          <p className="text-tx2 text-sm mt-0.5">
            {channels.length} {channels.length === 1 ? "instância" : "instâncias"}
            {connected > 0 && <span className="text-success font-semibold"> · {connected} conectada{connected > 1 ? "s" : ""}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setShowAccounts(true)} className="inline-flex items-center gap-2 rounded-control border border-bd px-3 py-2.5 text-sm font-bold text-tx2 hover:border-accent hover:text-accent transition" title="Gerenciar contas EvoHub">
            <Server className="w-4 h-4" strokeWidth={2} /> <span className="hidden sm:inline">Contas EvoHub</span>
          </button>
          <button onClick={() => { navigator.clipboard.writeText(WEBHOOK_URL); toast.success("Link do webhook copiado!"); }} className="inline-flex items-center gap-2 rounded-control border border-bd px-3 py-2.5 text-sm font-bold text-tx2 hover:border-accent hover:text-accent transition" title={WEBHOOK_URL}>
            <Link2 className="w-4 h-4" strokeWidth={2} /> <span className="hidden sm:inline">Copiar webhook</span>
          </button>
          <button onClick={handleSync} disabled={syncing} className="inline-flex items-center gap-2 rounded-control border border-bd px-3 py-2.5 text-sm font-bold text-tx2 hover:border-accent hover:text-accent transition disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} strokeWidth={2} /> <span className="hidden sm:inline">Sincronizar</span>
          </button>
          <button onClick={() => openConnect()} className="inline-flex items-center gap-2 rounded-control bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-accent2 transition">
            <Plus className="w-4 h-4" strokeWidth={2.2} /> <span className="hidden sm:inline">Conectar</span> WhatsApp
          </button>
        </div>
      </div>

      {/* Barra de ajuda: link do webhook visível pra colar num canal novo (autoatendimento) */}
      <div className="mb-6 rounded-card border border-bd bg-surface2/60 p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-control bg-accentsoft flex items-center justify-center flex-shrink-0"><Link2 className="w-4 h-4 text-accent" strokeWidth={2} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-tx2 uppercase tracking-wide">Webhook (recebimento de mensagens)</p>
          <p className="text-[12px] text-tx3 font-mono truncate">{WEBHOOK_URL}</p>
        </div>
        <button onClick={() => { navigator.clipboard.writeText(WEBHOOK_URL); toast.success("Copiado!"); }} className="flex items-center gap-1 text-[11px] font-bold text-accent px-2.5 py-1.5 rounded-lg hover:bg-accentsoft transition flex-shrink-0"><Copy className="w-3.5 h-3.5" strokeWidth={2} /> Copiar</button>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-20 text-tx3 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-accentsoft flex items-center justify-center mb-4"><MessageCircle className="w-8 h-8 text-accent" strokeWidth={1.6} /></div>
          <p className="text-lg font-bold text-tx2">Nenhuma operação ou WhatsApp ainda</p>
          <p className="text-sm mt-1">Crie uma operação ou conecte um número para começar</p>
        </div>
      ) : (
        <div className="space-y-7">
          {groups.map((g) => (
            <section key={g.key}>
              {/* Cabeçalho da pasta (operação) */}
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 rounded-control flex items-center justify-center flex-shrink-0" style={{ backgroundColor: g.color === "var(--tx3)" ? "var(--surface2)" : g.color + "1f" }}>
                  <FolderOpen className="w-4 h-4" strokeWidth={2} style={{ color: g.color }} />
                </span>
                <h2 className="text-sm font-extrabold tracking-[-0.01em]" style={{ color: g.key === NO_OP ? "var(--tx2)" : g.color }}>{g.name}</h2>
                <span className="text-[11px] font-bold text-tx2 bg-surface2 rounded-full px-2 py-0.5">{g.channels.length}</span>
                <div className="flex-1 h-px" style={{ background: g.color === "var(--tx3)" ? "var(--line)" : g.color + "26" }} />
                {g.opId && (
                  <button onClick={() => openConnect({ id: g.opId!, name: g.name })} className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full transition flex-shrink-0" style={{ color: g.color, backgroundColor: g.color + "1a" }} title={`Conectar WhatsApp em ${g.name}`}>
                    <Plus className="w-3.5 h-3.5" strokeWidth={2.5} /> Conectar
                  </button>
                )}
              </div>
              {g.channels.length === 0 ? (
                <button onClick={() => g.opId && openConnect({ id: g.opId, name: g.name })} disabled={!g.opId} className="w-full rounded-card border border-dashed border-bd hover:border-accent hover:bg-hover disabled:hover:bg-transparent disabled:cursor-default transition p-6 flex flex-col items-center gap-1 text-tx3">
                  <Plus className="w-5 h-5" strokeWidth={2} />
                  <span className="text-xs font-semibold">{g.opId ? `Conectar um WhatsApp em ${g.name}` : "Nenhum número"}</span>
                </button>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {g.channels.map((ch) => renderCard(ch, g.color))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="w-full max-w-sm rounded-card border border-bd bg-surface shadow-pop p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/12 flex items-center justify-center"><AlertTriangle className="w-6 h-6 text-red-500" strokeWidth={2} /></div>
              <h3 className="text-lg font-bold text-tx">Excluir {deleteTarget.name}?</h3>
              <p className="text-sm text-tx2 mt-1">Esta ação é permanente e não pode ser desfeita.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 rounded-control border border-bd px-4 py-2.5 text-sm font-semibold text-tx2 hover:bg-hover transition">Cancelar</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 rounded-control bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50 transition">{deleting ? "Excluindo..." : "Sim, excluir"}</button>
            </div>
          </div>
        </div>
      )}

      {showModal && <CreateChannelModal operationName={createForOp?.name} onClose={() => { setShowModal(false); setCreateForOp(null); }} onCreated={handleChannelCreated} />}
      {pickerFor && (
        <OperationPickerModal
          operations={operations.filter(o => o.id !== phoneMap[pickerFor.id]?.opId)}
          currentOpId={phoneMap[pickerFor.id]?.opId}
          onSelect={(opId) => { changeOperation(pickerFor.id, opId, pickerFor.name); setPickerFor(null); }}
          onClose={() => setPickerFor(null)}
        />
      )}
      {sellerPickerFor && (
        <SellerPickerModal
          sellers={sellers.filter(s => s.id).map(s => ({ id: s.id, name: s.name }))}
          currentSellerId={channelToSeller[sellerPickerFor.id]?.id || null}
          channelName={sellerPickerFor.name}
          onSelect={(userId) => { assignSeller(sellerPickerFor.id, userId); setSellerPickerFor(null); }}
          onClose={() => setSellerPickerFor(null)}
        />
      )}
      {showAccounts && (
        <EvoAccountsModal onClose={() => setShowAccounts(false)} onChanged={handleSync} />
      )}
    </div>
  );
}
