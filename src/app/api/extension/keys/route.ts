import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomBytes } from "crypto";

// Retorna o código da extensão de cada vendedor (só admin/supervisor). Gera pra quem não tem.
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin" && me?.role !== "supervisor") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const admin = createAdminClient();
  // garante código pra todo vendedor ativo
  const { data: users } = await admin.from("profiles").select("id, role").in("role", ["operator", "admin", "supervisor"]);
  const { data: existing } = await admin.from("extension_keys").select("user_id, key").eq("is_active", true);
  const have = new Set((existing || []).map((k: any) => k.user_id));
  const toCreate = (users || []).filter((u: any) => !have.has(u.id));
  for (const u of toCreate) {
    const code = "ZPX-" + randomBytes(9).toString("base64").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 12);
    await admin.from("extension_keys").insert({ user_id: u.id, key: code });
  }

  const { data: all } = await admin.from("extension_keys").select("user_id, key").eq("is_active", true);
  const map: Record<string, string> = {};
  for (const k of all || []) map[k.user_id] = k.key;
  return NextResponse.json({ keys: map });
}
