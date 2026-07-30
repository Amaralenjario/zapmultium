"use client";

import { useEffect, useState, useCallback } from "react";
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
}

interface Column {
  id: string;
  key: string;
  label: string;
  color: string;
  position: number;
}

interface Tag {
  id: string;
  name: string;
  color: string;
  column_key: string;
}

const priorityLabels: Record<string, string> = { urgent: "Urgente", high: "Alta", normal: "Normal", low: "Baixa" };
const priorityBorder: Record<string, string> = { urgent: "border-l-red-500", high: "border-l-yellow-500", normal: "border-l-blue-500", low: "border-l-gray-400" };
const sourceLabels: Record<string, string> = { whatsapp: "WhatsApp", instagram: "Instagram", site: "Site", linkedin: "LinkedIn", indicacao: "Indicação" };

export default function CrmKanban() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCol, setShowNewCol] = useState(false);
  const [showNewTag, setShowNewTag] = useState<{ colKey: string } | null>(null);
  const [newColLabel, setNewColLabel] = useState("");
  const [newColColor, setNewColColor] = useState("#6b7280");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6b7280");
  const [tagging, setTagging] = useState<{ leadId: string; leadName: string } | null>(null);
  const supabase = createClient();

  const fetchAll = useCallback(async () => {
    const [leadsRes, colsRes, tagsRes] = await Promise.all([
      supabase.from("leads").select("*, lead_tags(tag_id, tag:crm_tags(id, name, color))").order("created_at", { ascending: false }),
      fetch("/api/crm/columns").then((r) => r.json()),
      fetch("/api/crm/tags").then((r) => r.json()),
    ]);
    setLeads(leadsRes.data || []);
    if (Array.isArray(colsRes)) setColumns(colsRes);
    if (Array.isArray(tagsRes)) setTags(tagsRes);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createColumn = async () => {
    if (!newColLabel.trim()) return;
    const res = await fetch("/api/crm/columns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newColLabel.trim(), color: newColColor }),
    });
    if (res.ok) { toast.success("Coluna criada!"); setShowNewCol(false); setNewColLabel(""); fetchAll(); }
    else toast.error("Erro ao criar coluna");
  };

  const deleteColumn = async (colId: string) => {
    if (!confirm("Excluir coluna e suas tags?")) return;
    await fetch(`/api/crm/columns/${colId}`, { method: "DELETE" });
    fetchAll();
  };

  const createTag = async () => {
    if (!newTagName.trim() || !showNewTag) return;
    const res = await fetch("/api/crm/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTagName.trim(), color: newTagColor, column_key: showNewTag.colKey }),
    });
    if (res.ok) { toast.success("Tag criada!"); setShowNewTag(null); setNewTagName(""); fetchAll(); }
    else toast.error("Erro");
  };

  const deleteTag = async (tagId: string) => {
    await fetch(`/api/crm/tags?id=${tagId}`, { method: "DELETE" });
    fetchAll();
  };

  const addTagToLead = async (leadId: string, tagId: string) => {
    const res = await fetch(`/api/crm/leads/${leadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag_id: tagId }),
    });
    if (res.ok) {
      setTagging(null);
      fetchAll();
    } else toast.error("Erro");
  };

  const leadsByStatus = columns.reduce((acc: Record<string, Lead[]>, col) => {
    acc[col.key] = leads.filter((l) => l.status === col.key);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-[3px] border-gray-300 border-t-emerald-500 rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CRM Leads</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{leads.length} lead{leads.length !== 1 ? "s" : ""} no pipeline</p>
        </div>
        <button onClick={() => setShowNewCol(true)} className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-emerald-500 hover:text-emerald-500 transition flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nova coluna
        </button>
      </div>

      <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colLeads = leadsByStatus[col.key] || [];
          const colTags = tags.filter((t) => t.column_key === col.key);
          return (
            <div key={col.id} className="flex-1 min-w-[280px] max-w-[360px] rounded-xl border flex flex-col" style={{ borderColor: col.color + "40", backgroundColor: col.color + "08" }}>
              <div className="px-4 py-3 flex items-center justify-between rounded-t-xl" style={{ backgroundColor: col.color + "18" }}>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{col.label}</h3>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium text-gray-600 dark:text-gray-400" style={{ backgroundColor: col.color + "20" }}>{colLeads.length}</span>
                  <button onClick={() => setShowNewTag({ colKey: col.key })} className="p-0.5 hover:bg-white/30 rounded transition" title="Nova tag">
                    <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </button>
                  {col.key.startsWith("custom_") && (
                    <button onClick={() => deleteColumn(col.id)} className="p-0.5 hover:bg-white/30 rounded transition" title="Excluir coluna">
                      <svg className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Tags row */}
              {colTags.length > 0 && (
                <div className="px-2 py-1.5 flex gap-1 flex-wrap border-b" style={{ borderColor: col.color + "20" }}>
                  {colTags.map((tag) => (
                    <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-80 transition flex items-center gap-1" style={{ backgroundColor: tag.color + "30", color: tag.color }}>
                      {tag.name}
                      <button onClick={() => deleteTag(tag.id)} className="hover:text-red-500">×</button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {colLeads.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-gray-400 dark:text-gray-500 text-xs">Nenhum lead</div>
                ) : (
                  colLeads.map((lead) => {
                    const leadTagObjs = (lead.lead_tags || []).filter((lt: any) => lt.tag).map((lt: any) => lt.tag);
                    return (
                      <div key={lead.id} className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3 hover:shadow-md transition border-l-4 ${priorityBorder[lead.priority] || "border-l-gray-400"}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar name={lead.name} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{lead.name}</p>
                            <p className="text-xs text-gray-400 truncate">{lead.phone}</p>
                          </div>
                          <button onClick={() => setTagging({ leadId: lead.id, leadName: lead.name })} className="p-0.5 text-gray-400 hover:text-emerald-500 transition" title="Adicionar tag">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                          </button>
                        </div>

                        {/* Lead tags */}
                        {leadTagObjs.length > 0 && (
                          <div className="flex gap-1 flex-wrap mb-2">
                            {leadTagObjs.map((tag: any) => (
                              <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: tag.color + "25", color: tag.color }}>{tag.name}</span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">{sourceLabels[lead.source] || lead.source}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">{priorityLabels[lead.priority] || lead.priority}</span>
                        </div>

                        {lead.email && <p className="text-[10px] text-gray-400 mt-1.5 truncate">{lead.email}</p>}
                        <p className="text-[10px] text-gray-400 mt-1">{new Date(lead.created_at).toLocaleDateString("pt-BR")}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New column modal */}
      {showNewCol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowNewCol(false)}>
          <div className="w-full max-w-xs rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Nova coluna</h3>
            <input type="text" value={newColLabel} onChange={(e) => setNewColLabel(e.target.value)} placeholder="Nome da coluna" className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm mb-3 focus:border-emerald-500 focus:outline-none" autoFocus />
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-gray-500">Cor:</span>
              <input type="color" value={newColColor} onChange={(e) => setNewColColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNewCol(false)} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-300">Cancelar</button>
              <button onClick={createColumn} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* New tag modal */}
      {showNewTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowNewTag(null)}>
          <div className="w-full max-w-xs rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Nova etiqueta</h3>
            <input type="text" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Nome da etiqueta" className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm mb-3 focus:border-emerald-500 focus:outline-none" autoFocus />
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-gray-500">Cor:</span>
              <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNewTag(null)} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-300">Cancelar</button>
              <button onClick={createTag} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* Tag selector for lead */}
      {tagging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setTagging(null)}>
          <div className="w-full max-w-xs rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Adicionar etiqueta</h3>
            <p className="text-xs text-gray-500 mb-3">{tagging.leadName}</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {tags.map((tag) => {
                const col = columns.find((c) => c.key === tag.column_key);
                return (
                  <button key={tag.id} onClick={() => addTagToLead(tagging.leadId, tag.id)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition text-left">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{tag.name}</span>
                    {col && <span className="text-[10px] text-gray-400 ml-auto">{col.label}</span>}
                  </button>
                );
              })}
              {tags.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nenhuma etiqueta criada</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
