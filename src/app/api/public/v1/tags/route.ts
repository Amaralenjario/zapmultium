import { requireApiKey, jsonResponse } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// Estrutura do CRM: colunas (etapas do funil) e etiquetas, com contagem de leads.
export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.res;
  const db = auth.db;

  const [colsRes, tagsRes, leadsRes, leadTagsRes] = await Promise.all([
    db.from("crm_columns").select("key, label, color, position").order("position"),
    db.from("crm_tags").select("id, name, color, column_key"),
    db.rpc("leads_summary", { p_start: "2000-01-01", p_end: new Date().toISOString() }),
    db.from("lead_tags").select("tag_id"),
  ]);

  const leadsByStatus = ((leadsRes.data as any) || {}).por_status || {};
  const tagCounts: Record<string, number> = {};
  for (const lt of (leadTagsRes.data as any[]) || []) tagCounts[lt.tag_id] = (tagCounts[lt.tag_id] || 0) + 1;

  // Dedup colunas (crm_columns é por usuário; consolida por key).
  const colMap: Record<string, any> = {};
  for (const c of (colsRes.data as any[]) || []) if (!colMap[c.key]) colMap[c.key] = c;

  return jsonResponse({
    colunas: Object.values(colMap).map((c: any) => ({ key: c.key, label: c.label, cor: c.color, posicao: c.position, leads: leadsByStatus[c.key] || 0 })),
    etiquetas: ((tagsRes.data as any[]) || []).map((t) => ({ id: t.id, nome: t.name, cor: t.color, coluna: t.column_key, leads: tagCounts[t.id] || 0 })),
  });
}
