import { requireApiKey, jsonResponse } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// Lista as operações e a contagem de números.
export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.res;
  const db = auth.db;

  const { data: ops } = await db.from("operations").select("id, name, slug, color").order("name");
  const { data: chans } = await db.from("operations_channels").select("operation_id, phone_number_id").eq("is_active", true);

  const byOp: Record<string, { total: number; ativos: number }> = {};
  for (const c of (chans as any[]) || []) {
    const o = (byOp[c.operation_id] = byOp[c.operation_id] || { total: 0, ativos: 0 });
    o.total++;
    if (c.phone_number_id) o.ativos++;
  }

  return jsonResponse({
    operations: ((ops as any[]) || []).map((o) => ({
      id: o.id, nome: o.name, slug: o.slug, cor: o.color,
      numeros: byOp[o.id]?.total || 0, numeros_ativos: byOp[o.id]?.ativos || 0,
    })),
  });
}
