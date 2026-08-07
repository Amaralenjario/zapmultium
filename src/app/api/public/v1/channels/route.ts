import { requireApiKey, jsonResponse } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// Números/canais de WhatsApp vinculados às operações.
export async function GET(request: Request) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.res;
  const db = auth.db;

  const { data } = await db.from("operations_channels")
    .select("evohub_channel_id, evohub_channel_name, phone_number_id, is_active, operation:operation_id(name, color)")
    .order("evohub_channel_name");

  const canais = ((data as any[]) || []).map((c) => {
    const op = Array.isArray(c.operation) ? c.operation[0] : c.operation;
    return {
      canal_id: c.evohub_channel_id, nome: c.evohub_channel_name, phone_number_id: c.phone_number_id,
      operacao: op?.name || null, cor_operacao: op?.color || null,
      status: c.phone_number_id ? "conectado" : "pendente", ativo: c.is_active !== false,
    };
  });

  return jsonResponse({ total: canais.length, canais });
}
