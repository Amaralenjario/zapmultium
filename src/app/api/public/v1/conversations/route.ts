import { requireApiKey, jsonResponse } from "@/lib/api-auth";
import { resolvePeriod, paginate } from "@/lib/public-metrics";
import { resolveChannelMaps } from "@/lib/attribution";

export const dynamic = "force-dynamic";

// Conversas (paginadas). Filtros: period, status (active|closed|...), limit, offset.
export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.res;
  const db = auth.db;
  const u = new URL(request.url);
  const p = resolvePeriod(u.searchParams.get("period") || undefined, u.searchParams.get("start") || undefined, u.searchParams.get("end") || undefined);
  const { limit, offset } = paginate(u, 50, 200);
  const status = u.searchParams.get("status");

  const { phoneToOp } = await resolveChannelMaps(db);

  let q = db.from("conversations")
    .select("id, status, source, last_message, last_message_sender, last_message_at, unread_count, created_at, metadata, customer:customer_id(name, phone)", { count: "exact" })
    .gte("created_at", p.startISO).lte("created_at", p.endISO)
    .order("last_message_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (status) q = q.eq("status", status);

  const { data, count } = await q;
  const conversas = ((data as any[]) || []).map((c) => {
    const cust = Array.isArray(c.customer) ? c.customer[0] : c.customer;
    const phoneId = c.metadata?.phone_number_id;
    return {
      id: c.id, status: c.status, origem: c.source,
      cliente: cust?.name || null, telefone: cust?.phone || null,
      operacao: phoneId ? (phoneToOp[phoneId]?.name || null) : null,
      ultima_mensagem: c.last_message || null, ultimo_remetente: c.last_message_sender || null,
      ultima_mensagem_em: c.last_message_at, nao_lidas: c.unread_count || 0, criada_em: c.created_at,
    };
  });

  return jsonResponse({ periodo: { tipo: p.period, inicio: p.startDate, fim: p.endDate }, total: count || 0, limit, offset, conversas });
}
