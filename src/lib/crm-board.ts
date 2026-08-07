import type { SupabaseClient } from "@supabase/supabase-js";

// Dono do board do CRM = o admin. O funil (colunas) é compartilhado por todo o time,
// então todo mundo lê/escreve as mesmas colunas (as do admin), não as suas próprias.
export async function getBoardOwnerId(admin: SupabaseClient, fallbackUserId: string): Promise<string> {
  const { data } = await admin.from("profiles").select("id").eq("role", "admin").order("created_at").limit(1).maybeSingle();
  return data?.id || fallbackUserId;
}
