"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Tag, Plus, X, Trash2, Pencil, GripVertical, TagsIcon, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/chat/Avatar";
import toast from "react-hot-toast";

interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: string;
  status: string;
  priority: string;
  notes: string | null;
  created_at: string;
  lead_tags?: { tag_id: string; tag: { id: string; name: string; color: string } }[];
  _customer_id?: string;
}
interface Column { id: string; key: string; label: string; color: string; position: number; }
interface CrmTag { id: string; name: string; color: string; column_key: string | null; }

type DragItem =
  | { type: "lead"; lead: Lead }
  | { type: "column"; colId: string }
  | { type: "tag"; tagId: string }
  | null;

const priorityLabels: Record<string, string> = { urgent: "Urgente", high: "Alta", normal: "Normal", low: "Baixa" };
const sourceLabels: Record<string, string> = { whatsapp: "WhatsApp", instagram: "Instagram", site: "Site", linkedin: "LinkedIn", indicacao: "Indicação" };
const RENDER_CAP = 100; // máximo de cards renderizados por coluna (o total real aparece no cabeçalho)
const PHONE_MAP_FALLBACK: Record<string, string> = {
  "5145a0c0-a358-43e5-8269-c5ace26ca023": "897878513398151",
  "effa72d1-47f6-445b-acbc-7693ef21ee24": "976034132269824",
  "c5505ddf-f9ef-4837-9337-45ed3de40d6a": "892228177298374",
  "346e4eef-bc78-41ec-a7ae-ec7ec75bf177": "1034222499765101",
  "b1c6879b-e962-4f50-95f7-14f1a04601a5": "1234821229708132",
  "0bce92b7-b6a9-4859-ac87-bc2ed01719e1": "1077309398802921",
  "004d0718-04ae-4af5-b55b-aaa5136d1138": "1050317928161978",
};

export default function CrmKanban() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [tags, setTags] = useState<CrmTag[]>([]);
  const [opColors, setOpColors] = useState<Record<string, { color: string; name: string }>>({});
  const [custPhoneMap, setCustPhoneMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [permReady, setPermReady] = useState(false);
  const [dragItem, setDragItem] = useState<DragItem>(null);
  const [dropCol, setDropCol] = useState<string | null>(null);
  const [showTags, setShowTags] = useState(false);
  const [showNewCol, setShowNewCol] = useState(false);
  const [showNewTag, setShowNewTag] = useState(false);
  const [newColLabel, setNewColLabel] = useState("");
  const [newColColor, setNewColColor] = useState("#6366f1");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [newTagColumn, setNewTagColumn] = useState("");
  const [tagging, setTagging] = useState<{ leadId: string; leadName: string } | null>(null);
  const [editingTag, setEditingTag] = useState<CrmTag | null>(null);
  const supabase = createClient();

  // Busca TODAS as linhas (pagina de 1000 em 1000, sem o cap silencioso do Supabase)
  const fetchAllRows = useCallback(async (table: string, cols: string, orderCol?: string): Promise<any[]> => {
    const all: any[] = [];
    let from = 0;
    const page = 1000;
    for (let i = 0; i < 20; i++) {
      let q = supabase.from(table).select(cols).range(from, from + page - 1);
      if (orderCol) q = q.order(orderCol, { ascending: false });
      const { data } = await q;
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < page) break;
      from += page;
    }
    return all;
  }, [supabase]);

  const fetchAll = useCallback(async () => {
    // Escopo do vendedor
    let sellerPhoneIds: string[] | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        if (profile?.role !== "admin" && profile?.role !== "supervisor") {
          const { data: sc } = await supabase.from("seller_channels").select("evohub_channel_id").eq("user_id", user.id);
          if (sc && sc.length > 0) {
            const channelIds = sc.map((s) => s.evohub_channel_id);
            const phoneIdMap: Record<string, string> = { ...PHONE_MAP_FALLBACK };
            const { data: oc } = await supabase.from("operations_channels").select("evohub_channel_id, phone_number_id").eq("is_active", true);
            for (const row of oc || []) if (row.phone_number_id) phoneIdMap[row.evohub_channel_id] = row.phone_number_id;
            sellerPhoneIds = channelIds.map((cid) => phoneIdMap[cid]).filter(Boolean);
          } else {
            sellerPhoneIds = [];
          }
        }
      }
    } finally {
      setPermReady(true);
    }

    const [realLeads, customers, convs, colsRes, tagsRes, opRes] = await Promise.all([
      supabase.from("leads").select("*, lead_tags(tag_id, tag:crm_tags(id, name, color))").order("created_at", { ascending: false }),
      fetchAllRows("customers", "id, name, phone, last_interaction_at", "last_interaction_at"),
      fetchAllRows("conversations", "customer_id, metadata"),
      fetch("/api/crm/columns").then((r) => r.json()),
      fetch("/api/crm/tags").then((r) => r.json()),
      supabase.from("operations_channels").select("phone_number_id, operation:operation_id(name, color)").eq("is_active", true),
    ]);

    // customer_id -> phone_number_id
    const cpMap: Record<string, string> = {};
    for (const c of convs || []) {
      const pid = (c as any).metadata?.phone_number_id;
      if (pid && (c as any).customer_id) cpMap[(c as any).customer_id] = pid;
    }
    // phone_number_id -> operação
    const opMap: Record<string, { color: string; name: string }> = {};
    for (const oc of opRes.data || []) {
      const op = Array.isArray(oc.operation) ? oc.operation[0] : oc.operation;
      if (oc.phone_number_id && op) opMap[oc.phone_number_id] = { color: op.color, name: op.name };
    }
    setOpColors(opMap);
    setCustPhoneMap(cpMap);

    const existingLeads: Lead[] = realLeads.data || [];
    const existingPhones = new Set(existingLeads.map((l) => l.phone));

    const custToLead = (c: any): Lead => ({
      id: `customer_${c.phone}`, name: c.name || c.phone, phone: c.phone, email: null,
      source: "whatsapp", status: "new", priority: "normal", notes: null,
      created_at: c.last_interaction_at || new Date().toISOString(), lead_tags: [], _customer_id: c.id,
    });

    if (sellerPhoneIds !== null) {
      const allowed = new Set<string>();
      for (const [custId, phoneId] of Object.entries(cpMap)) if (sellerPhoneIds.includes(phoneId)) allowed.add(custId);
      const filteredCustomers = (customers || []).filter((c: any) => allowed.has(c.id));
      const allowedPhones = new Set(filteredCustomers.map((c: any) => c.phone));
      const filteredLeads = existingLeads.filter((l) => allowedPhones.has(l.phone));
      setLeads([...filteredLeads, ...filteredCustomers.filter((c: any) => !existingPhones.has(c.phone)).map(custToLead)]);
    } else {
      const customersAsLeads = (customers || []).filter((c: any) => c.phone && !existingPhones.has(c.phone)).map(custToLead);
      setLeads([...existingLeads, ...customersAsLeads]);
    }
    if (Array.isArray(colsRes)) setColumns(colsRes);
    if (Array.isArray(tagsRes)) setTags(tagsRes);
    setLoading(false);
  }, [supabase, fetchAllRows]);

  // Ref do drag pra o auto-refresh não interromper o arraste.
  const dragRef = useRef<DragItem>(null);
  dragRef.current = dragItem;

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    const i = setInterval(() => { if (!dragRef.current) fetchAll(); }, 8000);
    const onTagged = () => fetchAll();
    window.addEventListener("lead-tagged", onTagged);
    return () => { clearInterval(i); window.removeEventListener("lead-tagged", onTagged); };
  }, [fetchAll]);

  // ── Mover LEAD para uma coluna (cria lead real se for contato ainda não rastreado) ──
  const moveLead = async (lead: Lead, targetKey: string) => {
    if (lead.status === targetKey) return;
    // OTIMISTA: move na hora no estado local (o card muda de coluna imediatamente).
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, status: targetKey } : l));
    try {
      if (String(lead.id).startsWith("customer_")) {
        const { data: existing } = await supabase.from("leads").select("id").eq("phone", lead.phone).maybeSingle();
        if (existing) await supabase.from("leads").update({ status: targetKey }).eq("id", existing.id);
        else await supabase.from("leads").insert({ name: lead.name, phone: lead.phone, status: targetKey, source: "whatsapp", customer_id: lead._customer_id || null, funnel_stage: "captura", priority: "normal" });
      } else {
        const { error } = await supabase.from("leads").update({ status: targetKey }).eq("id", lead.id);
        if (error) throw error;
      }
    } catch { toast.error("Erro ao mover lead"); fetchAll(); }
  };

  // ── Mover ETIQUETA para outra coluna → os leads com ela vão junto ──
  const moveTagToColumn = async (tagId: string, targetKey: string) => {
    const tag = tags.find((t) => t.id === tagId);
    if (!tag || tag.column_key === targetKey) return;
    setTags((prev) => prev.map((t) => t.id === tagId ? { ...t, column_key: targetKey } : t)); // otimista
    setLeads((prev) => prev.map((l) => (l.lead_tags || []).some((lt) => lt.tag_id === tagId) ? { ...l, status: targetKey } : l)); // move os leads da etiqueta na hora
    try {
      await fetch("/api/crm/tags", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: tagId, column_key: targetKey }) });
      const { data: lt } = await supabase.from("lead_tags").select("lead_id").eq("tag_id", tagId);
      const ids = (lt || []).map((x: any) => x.lead_id);
      if (ids.length) await supabase.from("leads").update({ status: targetKey }).in("id", ids);
      toast.success(`Etiqueta e ${ids.length} lead(s) movidos`);
      fetchAll();
    } catch { toast.error("Erro ao mover etiqueta"); fetchAll(); }
  };

  // ── Reordenar COLUNAS ──
  const reorderColumnTo = async (draggedId: string, targetId: string) => {
    const from = columns.findIndex((c) => c.id === draggedId);
    const to = columns.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const arr = [...columns];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    setColumns(arr.map((c, i) => ({ ...c, position: i })));
    try {
      await Promise.all(arr.map((c, i) => c.position !== i
        ? fetch(`/api/crm/columns/${c.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position: i }) })
        : null).filter(Boolean));
    } catch { toast.error("Erro ao reordenar"); fetchAll(); }
  };

  const handleDropOnColumn = (col: Column) => {
    const item = dragRef.current || dragItem; // ref = sempre o valor atual (evita closure defasado)
    dragRef.current = null;
    setDragItem(null); setDropCol(null);
    if (!item) return;
    if (item.type === "lead") moveLead(item.lead, col.key);
    else if (item.type === "tag") moveTagToColumn(item.tagId, col.key);
    else if (item.type === "column") reorderColumnTo(item.colId, col.id);
  };

  const createColumn = async () => {
    if (!newColLabel.trim()) return;
    const res = await fetch("/api/crm/columns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: newColLabel.trim(), color: newColColor }) });
    if (res.ok) { toast.success("Coluna criada!"); setShowNewCol(false); setNewColLabel(""); fetchAll(); } else toast.error("Erro");
  };
  const deleteColumn = async (colId: string, colKey: string) => {
    if (!confirm("Excluir esta coluna? Os leads voltam para 'Novos'.")) return;
    const here = leads.filter((l) => l.status === colKey && !String(l.id).startsWith("customer_"));
    for (const l of here) await supabase.from("leads").update({ status: "new" }).eq("id", l.id);
    await fetch(`/api/crm/columns/${colId}`, { method: "DELETE" });
    fetchAll();
  };
  const createTag = async () => {
    if (!newTagName.trim()) return;
    const res = await fetch("/api/crm/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newTagName.trim(), color: newTagColor, column_key: newTagColumn || null }) });
    if (res.ok) { toast.success("Etiqueta criada!"); setShowNewTag(false); setNewTagName(""); fetchAll(); } else toast.error("Erro");
  };
  const saveTagEdit = async () => {
    if (!editingTag) return;
    const res = await fetch("/api/crm/tags", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingTag.id, name: editingTag.name, color: editingTag.color, column_key: editingTag.column_key }) });
    if (res.ok) { toast.success("Etiqueta atualizada!"); setEditingTag(null); fetchAll(); } else toast.error("Erro");
  };
  const deleteTag = async (tagId: string) => {
    await fetch(`/api/crm/tags?id=${tagId}`, { method: "DELETE" });
    fetchAll();
  };
  const addTagToLead = async (leadId: string, tagId: string, columnKey: string | null) => {
    const lead = leads.find((l) => l.id === leadId);
    const existing = lead?.lead_tags?.find((lt) => lt.tag_id === tagId);
    // OTIMISTA: aplicar etiqueta com coluna move o lead pra essa coluna na hora.
    if (!existing && columnKey) setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status: columnKey } : l));
    // resolve id real (cria lead se for contato)
    let realId = leadId;
    if (String(leadId).startsWith("customer_") && lead) {
      const { data: ex } = await supabase.from("leads").select("id").eq("phone", lead.phone).maybeSingle();
      if (ex) realId = ex.id;
      else {
        const { data: created } = await supabase.from("leads").insert({ name: lead.name, phone: lead.phone, status: columnKey || "new", source: "whatsapp", customer_id: lead._customer_id || null }).select("id").single();
        realId = created?.id || leadId;
      }
    }
    if (existing) { await supabase.from("lead_tags").delete().eq("lead_id", realId).eq("tag_id", tagId); toast.success("Etiqueta removida"); }
    else {
      await supabase.from("lead_tags").upsert({ lead_id: realId, tag_id: tagId });
      if (columnKey) await supabase.from("leads").update({ status: columnKey }).eq("id", realId);
      toast.success("Etiqueta aplicada");
    }
    setTagging(null);
    fetchAll();
  };

  const getLeadOpColor = (lead: Lead) => {
    const custId = lead._customer_id;
    if (custId && custPhoneMap[custId]) return opColors[custPhoneMap[custId]]?.color || null;
    return null;
  };

  const tagLeadCount = (tagId: string) => leads.filter((l) => (l.lead_tags || []).some((lt) => lt.tag_id === tagId)).length;

  // Agrupa leads por coluna.
  // A ETIQUETA manda: o lead vai pra coluna da etiqueta dele. O `status` só é respeitado
  // quando é uma colocação EXPLÍCITA (≠ "new", ex.: arrastado à mão) — assim o arraste
  // continua funcionando, mas leads etiquetados NÃO ficam presos em "Novos" quando a
  // etiqueta foi vinculada à coluna depois (o status antigo não era re-sincronizado).
  const DEFAULT_STATUS = "new";
  const leadsByStatus: Record<string, Lead[]> = {};
  for (const col of columns) leadsByStatus[col.key] = [];
  const colKeys = new Set(columns.map((c) => c.key));
  const colPos = new Map(columns.map((c) => [c.key, c.position ?? 0]));
  const tagCol = new Map(tags.map((t) => [t.id, t.column_key]));
  for (const l of leads) {
    let key: string | null = null;
    // 1) Colocação explícita (status real, diferente do default) tem prioridade.
    if (l.status && l.status !== DEFAULT_STATUS && colKeys.has(l.status)) key = l.status;
    // 2) Senão, a coluna da etiqueta do lead (a MAIS avançada no funil, se tiver várias).
    if (!key) {
      let bestPos = -1;
      for (const lt of l.lead_tags || []) {
        const ck = tagCol.get(lt.tag_id);
        if (ck && colKeys.has(ck)) {
          const pos = (colPos.get(ck) as number) ?? 0;
          if (pos > bestPos) { bestPos = pos; key = ck; }
        }
      }
    }
    // 3) Fallback: status se for coluna válida, senão a primeira coluna.
    if (!key) key = colKeys.has(l.status) ? l.status : (columns[0]?.key || "new");
    (leadsByStatus[key] = leadsByStatus[key] || []).push(l);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-[3px] border-bd border-t-accent rounded-full" /></div>;
  }

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0 gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-tx">CRM Leads</h1>
          <p className="text-tx2 text-sm">{permReady ? `${leads.length.toLocaleString("pt-BR")} lead${leads.length !== 1 ? "s" : ""} no pipeline` : "carregando..."}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTags(true)} className="rounded-control border border-bd px-3 py-2 text-xs font-bold text-tx2 hover:border-accent hover:text-accent transition flex items-center gap-1.5">
            <TagsIcon className="w-4 h-4" strokeWidth={2} /> Etiquetas
          </button>
          <button onClick={() => { setShowNewTag(true); setNewTagColumn(columns[0]?.key || ""); }} className="rounded-control border border-bd px-3 py-2 text-xs font-bold text-tx2 hover:border-accent hover:text-accent transition flex items-center gap-1.5">
            <Tag className="w-4 h-4" strokeWidth={2} /> Nova etiqueta
          </button>
          <button onClick={() => setShowNewCol(true)} className="rounded-control bg-accent px-3 py-2 text-xs font-bold text-white shadow-glow hover:bg-accent2 transition flex items-center gap-1.5">
            <Plus className="w-4 h-4" strokeWidth={2.2} /> Nova coluna
          </button>
        </div>
      </div>

      {/* Board */}
      {!permReady ? (
        <div className="flex-1 flex gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="flex-1 rounded-card bg-surface2 animate-pulse" />)}</div>
      ) : (
        <div className="flex-1 flex gap-3 lg:gap-4 overflow-x-auto pb-4 snap-x">
          {columns.map((col) => {
            const colLeads = leadsByStatus[col.key] || [];
            const colTags = tags.filter((t) => t.column_key === col.key);
            const isDropTarget = dropCol === col.key;
            return (
              <div
                key={col.id}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dropCol !== col.key) setDropCol(col.key); }}
                onDragLeave={(e) => { if (e.currentTarget === e.target) setDropCol(null); }}
                onDrop={(e) => { e.preventDefault(); handleDropOnColumn(col); }}
                className={`snap-start flex-shrink-0 w-[85vw] lg:flex-1 lg:min-w-[280px] lg:max-w-[360px] rounded-card border flex flex-col transition-all ${isDropTarget ? "border-accent ring-2 ring-accent/30" : "border-bd"}`}
                style={{ backgroundColor: col.color + "0a" }}
              >
                {/* Cabeçalho da coluna (arrastável) */}
                <div
                  draggable
                  onDragStart={(e) => { const it = { type: "column" as const, colId: col.id }; dragRef.current = it; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", col.id); setDragItem(it); }}
                  onDragEnd={() => { setDragItem(null); setDropCol(null); }}
                  className="px-3 py-2.5 flex items-center justify-between rounded-t-card cursor-grab active:cursor-grabbing"
                  style={{ backgroundColor: col.color + "1a" }}
                  title="Arraste para reordenar a coluna"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <GripVertical className="w-3.5 h-3.5 text-tx3 flex-shrink-0" strokeWidth={2} />
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
                    <h3 className="font-bold text-sm text-tx truncate">{col.label}</h3>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-bold text-tx2" style={{ backgroundColor: col.color + "22" }}>{colLeads.length.toLocaleString("pt-BR")}</span>
                    {col.key.startsWith("custom_") && (
                      <button onClick={() => deleteColumn(col.id, col.key)} className="p-0.5 rounded text-tx3 hover:text-red-500 transition" title="Excluir coluna"><Trash2 className="w-3.5 h-3.5" strokeWidth={2} /></button>
                    )}
                  </div>
                </div>

                {/* Etiquetas da coluna (arrastáveis) */}
                {colTags.length > 0 && (
                  <div className="px-2 py-1.5 flex gap-1 flex-wrap border-b border-bd">
                    {colTags.map((tag) => (
                      <span
                        key={tag.id}
                        draggable
                        onDragStart={(e) => { e.stopPropagation(); const it = { type: "tag" as const, tagId: tag.id }; dragRef.current = it; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", tag.id); setDragItem(it); }}
                        onDragEnd={() => { setDragItem(null); setDropCol(null); }}
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 cursor-grab active:cursor-grabbing"
                        style={{ backgroundColor: tag.color + "26", color: tag.color }}
                        title="Arraste a etiqueta para outra coluna (os leads vão junto)"
                      >
                        <GripVertical className="w-2.5 h-2.5 opacity-60" strokeWidth={2} />
                        {tag.name}
                        <button onClick={() => deleteTag(tag.id)} className="hover:opacity-60"><X className="w-2.5 h-2.5" strokeWidth={2.5} /></button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px]">
                  {colLeads.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-tx3 text-xs">Solte leads/etiquetas aqui</div>
                  ) : (
                    <>
                      {colLeads.slice(0, RENDER_CAP).map((lead) => {
                        const leadTagObjs = (lead.lead_tags || []).filter((lt) => lt.tag).map((lt) => lt.tag);
                        return (
                          <div
                            key={lead.id}
                            draggable
                            onDragStart={(e) => { const it = { type: "lead" as const, lead }; dragRef.current = it; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", lead.id); setDragItem(it); }}
                            onDragEnd={() => { setDragItem(null); setDropCol(null); }}
                            className={`bg-surface rounded-control border border-bd p-3 hover:shadow-card transition border-l-[3px] cursor-grab active:cursor-grabbing ${dragItem?.type === "lead" && dragItem.lead.id === lead.id ? "opacity-40" : ""}`}
                            style={{ borderLeftColor: getLeadOpColor(lead) || "var(--tx3)" }}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <Avatar name={lead.name} size="sm" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-tx truncate">{lead.name}</p>
                                <p className="text-xs text-tx3 truncate">{lead.phone}</p>
                              </div>
                              <button onClick={() => setTagging({ leadId: lead.id, leadName: lead.name })} className="p-1 text-tx3 hover:text-accent transition" title="Etiquetar">
                                <Tag className="w-4 h-4" strokeWidth={2} />
                              </button>
                            </div>
                            {leadTagObjs.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {leadTagObjs.map((tag) => (
                                  <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: tag.color + "26", color: tag.color }}>{tag.name}</span>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface2 text-tx2 font-semibold">{sourceLabels[lead.source] || lead.source}</span>
                              {lead.priority && lead.priority !== "normal" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface2 text-tx2 font-semibold">{priorityLabels[lead.priority] || lead.priority}</span>}
                            </div>
                          </div>
                        );
                      })}
                      {colLeads.length > RENDER_CAP && (
                        <div className="text-center text-[11px] text-tx3 py-2">+{(colLeads.length - RENDER_CAP).toLocaleString("pt-BR")} leads (use as etiquetas para organizar)</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Painel de Etiquetas */}
      {showTags && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={() => setShowTags(false)}>
          <div className="w-full max-w-sm h-full bg-surface border-l border-bd shadow-pop flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-bd">
              <div>
                <h3 className="text-sm font-bold text-tx flex items-center gap-2"><TagsIcon className="w-4 h-4 text-accent" strokeWidth={2} /> Minhas etiquetas</h3>
                <p className="text-[11px] text-tx3 mt-0.5">{tags.length} etiqueta(s) · arraste no quadro para mover</p>
              </div>
              <button onClick={() => setShowTags(false)} className="p-1.5 rounded-lg text-tx3 hover:text-tx hover:bg-hover transition"><X className="w-5 h-5" strokeWidth={2} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {tags.length === 0 ? (
                <p className="text-sm text-tx3 text-center py-10">Nenhuma etiqueta criada ainda</p>
              ) : tags.map((tag) => {
                const col = columns.find((c) => c.key === tag.column_key);
                return (
                  <div key={tag.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-control border border-bd bg-surface">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-tx truncate">{tag.name}</p>
                      <p className="text-[11px] text-tx3">{col ? `Coluna: ${col.label}` : "Sem coluna"} · {tagLeadCount(tag.id)} lead(s)</p>
                    </div>
                    <button onClick={() => setEditingTag(tag)} className="p-1.5 rounded-lg text-tx3 hover:text-accent hover:bg-hover transition" title="Editar"><Pencil className="w-3.5 h-3.5" strokeWidth={2} /></button>
                    <button onClick={() => deleteTag(tag.id)} className="p-1.5 rounded-lg text-tx3 hover:text-red-500 hover:bg-hover transition" title="Excluir"><Trash2 className="w-3.5 h-3.5" strokeWidth={2} /></button>
                  </div>
                );
              })}
            </div>
            <div className="p-3 border-t border-bd">
              <button onClick={() => { setShowTags(false); setShowNewTag(true); setNewTagColumn(columns[0]?.key || ""); }} className="w-full rounded-control bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-glow hover:bg-accent2 transition flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" strokeWidth={2.2} /> Nova etiqueta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nova coluna */}
      {showNewCol && (
        <Modal onClose={() => setShowNewCol(false)} title="Nova coluna">
          <input type="text" value={newColLabel} onChange={(e) => setNewColLabel(e.target.value)} placeholder="Nome da coluna" autoFocus className="w-full rounded-control border border-bd bg-surface2 px-3 py-2 text-sm text-tx placeholder:text-tx3 mb-3 focus:border-accent focus:outline-none" />
          <div className="flex items-center gap-2 mb-4"><span className="text-xs text-tx2">Cor:</span><input type="color" value={newColColor} onChange={(e) => setNewColColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent" /></div>
          <div className="flex gap-2">
            <button onClick={() => setShowNewCol(false)} className="flex-1 rounded-control border border-bd px-4 py-2 text-sm font-semibold text-tx2 hover:bg-hover transition">Cancelar</button>
            <button onClick={createColumn} className="flex-1 rounded-control bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent2 transition">Criar</button>
          </div>
        </Modal>
      )}

      {/* Modal nova etiqueta */}
      {showNewTag && (
        <Modal onClose={() => setShowNewTag(false)} title="Nova etiqueta">
          <input type="text" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Nome da etiqueta" autoFocus className="w-full rounded-control border border-bd bg-surface2 px-3 py-2 text-sm text-tx placeholder:text-tx3 mb-3 focus:border-accent focus:outline-none" />
          <div className="flex items-center gap-2 mb-3"><span className="text-xs text-tx2">Cor:</span><input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent" /></div>
          <label className="block text-xs font-semibold text-tx2 mb-1">Vincular à coluna</label>
          <select value={newTagColumn} onChange={(e) => setNewTagColumn(e.target.value)} className="w-full rounded-control border border-bd bg-surface2 px-3 py-2 text-sm text-tx mb-4 focus:border-accent focus:outline-none">
            <option value="">Nenhuma (sem coluna)</option>
            {columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={() => setShowNewTag(false)} className="flex-1 rounded-control border border-bd px-4 py-2 text-sm font-semibold text-tx2 hover:bg-hover transition">Cancelar</button>
            <button onClick={createTag} className="flex-1 rounded-control bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent2 transition">Criar</button>
          </div>
        </Modal>
      )}

      {/* Modal editar etiqueta */}
      {editingTag && (
        <Modal onClose={() => setEditingTag(null)} title="Editar etiqueta">
          <input type="text" value={editingTag.name} onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })} autoFocus className="w-full rounded-control border border-bd bg-surface2 px-3 py-2 text-sm text-tx mb-3 focus:border-accent focus:outline-none" />
          <div className="flex items-center gap-2 mb-3"><span className="text-xs text-tx2">Cor:</span><input type="color" value={editingTag.color} onChange={(e) => setEditingTag({ ...editingTag, color: e.target.value })} className="w-8 h-8 rounded cursor-pointer bg-transparent" /></div>
          <label className="block text-xs font-semibold text-tx2 mb-1">Coluna</label>
          <select value={editingTag.column_key || ""} onChange={(e) => setEditingTag({ ...editingTag, column_key: e.target.value || null })} className="w-full rounded-control border border-bd bg-surface2 px-3 py-2 text-sm text-tx mb-4 focus:border-accent focus:outline-none">
            <option value="">Nenhuma (sem coluna)</option>
            {columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={() => setEditingTag(null)} className="flex-1 rounded-control border border-bd px-4 py-2 text-sm font-semibold text-tx2 hover:bg-hover transition">Cancelar</button>
            <button onClick={saveTagEdit} className="flex-1 rounded-control bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent2 transition">Salvar</button>
          </div>
        </Modal>
      )}

      {/* Seletor de etiqueta para o lead */}
      {tagging && (
        <Modal onClose={() => setTagging(null)} title="Adicionar etiqueta">
          <p className="text-xs text-tx3 -mt-2 mb-3">{tagging.leadName}</p>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {tags.length === 0 ? <p className="text-xs text-tx3 text-center py-4">Nenhuma etiqueta. Crie uma primeiro.</p> : tags.map((tag) => {
              const col = columns.find((c) => c.key === tag.column_key);
              return (
                <button key={tag.id} onClick={() => addTagToLead(tagging.leadId, tag.id, tag.column_key)} className="w-full flex items-center gap-2 px-3 py-2 rounded-control hover:bg-hover transition text-left">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="text-sm text-tx2">{tag.name}</span>
                  {col && <span className="text-[10px] text-tx3 ml-auto">{col.label}</span>}
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-xs rounded-card border border-bd bg-surface shadow-pop p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-tx mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}
