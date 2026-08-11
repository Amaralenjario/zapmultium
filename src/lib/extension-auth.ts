import { createAdminClient } from "@/lib/supabase/admin";

// Resolve o código da extensão (ZPX-...) → vendedor. Atualiza last_used_at.
export async function resolveExtensionKey(key: string | null): Promise<{ userId: string; role: string } | null> {
  if (!key) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("extension_keys")
    .select("id, user_id, is_active")
    .eq("key", key.trim())
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  // fire-and-forget: marca uso
  admin.from("extension_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {}, () => {});
  const { data: prof } = await admin.from("profiles").select("role").eq("id", data.user_id).maybeSingle();
  return { userId: data.user_id, role: prof?.role || "operator" };
}

// phone_number_ids dos canais do vendedor (via seller_channels → operations_channels).
export async function sellerPhoneNumberIds(userId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data: sc } = await admin.from("seller_channels").select("evohub_channel_id").eq("user_id", userId);
  const chIds = (sc || []).map((s: any) => s.evohub_channel_id).filter(Boolean);
  if (chIds.length === 0) return [];
  const { data: oc } = await admin
    .from("operations_channels")
    .select("evohub_channel_id, phone_number_id")
    .eq("is_active", true)
    .in("evohub_channel_id", chIds);
  return Array.from(new Set((oc || []).map((o: any) => o.phone_number_id).filter(Boolean)));
}

// Cabeçalhos CORS — a extensão chama pelo service worker (host_permissions), mas deixamos
// liberado (os endpoints são autenticados por código) pra não travar em preflight.
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-zpx-key",
};
