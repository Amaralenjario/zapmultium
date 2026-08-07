import { createClient as createSb, type SupabaseClient } from "@supabase/supabase-js";

export function adminDb(): SupabaseClient {
  return createSb(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

// Valida a chave de API (header Authorization: Bearer <key>, x-api-key, ou ?api_key=).
export async function requireApiKey(
  request: Request
): Promise<{ ok: true; db: SupabaseClient } | { ok: false; res: Response }> {
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const url = new URL(request.url);
  const key = bearer || request.headers.get("x-api-key") || url.searchParams.get("api_key") || "";

  if (!key) {
    return { ok: false, res: jsonResponse({ error: "Chave de API ausente. Envie no header 'Authorization: Bearer SUA_CHAVE'." }, 401) };
  }
  const db = adminDb();
  const { data } = await db.from("api_keys").select("id, is_active").eq("key", key).maybeSingle();
  if (!data || !data.is_active) {
    return { ok: false, res: jsonResponse({ error: "Chave de API inválida ou revogada." }, 401) };
  }
  // marca uso (não bloqueia a resposta)
  db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {}, () => {});
  return { ok: true, db };
}
