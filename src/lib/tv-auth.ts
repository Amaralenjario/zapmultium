import { createClient as createServerClient } from "@/lib/supabase/server";
import { requireApiKey, adminDb, jsonResponse } from "@/lib/api-auth";
import type { SupabaseClient } from "@supabase/supabase-js";

// A Ranking TV pode autenticar por sessão (usuário logado) OU por chave de API
// (?api_key= ou Bearer), pra uma TV dedicada abrir a URL direto sem login.
export async function requireApiKeyOrSession(
  request: Request
): Promise<{ ok: true; db: SupabaseClient } | { ok: false; res: Response }> {
  const url = new URL(request.url);
  const hasKey =
    !!url.searchParams.get("api_key") ||
    !!request.headers.get("x-api-key") ||
    (request.headers.get("authorization") || "").toLowerCase().startsWith("bearer ");

  if (hasKey) {
    const k = await requireApiKey(request);
    if (k.ok) return { ok: true, db: k.db };
  }

  const server = createServerClient();
  const { data: { user } } = await server.auth.getUser();
  if (user) return { ok: true, db: adminDb() };

  return { ok: false, res: jsonResponse({ error: "Não autenticado. Faça login no sistema ou abra a TV com ?api_key=SUA_CHAVE." }, 401) };
}
