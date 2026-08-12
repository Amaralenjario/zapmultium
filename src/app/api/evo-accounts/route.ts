import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requireAdmin() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, res: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "supervisor") {
    return { ok: false as const, res: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }
  return { ok: true as const };
}

// Lista as contas EvoHub (SEM expor a api_key). Usado no seletor de conta e no gerenciador.
export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { data } = await supabase.from("evo_accounts").select("id, name, api_url, is_default").order("is_default", { ascending: false });
  return NextResponse.json(data || []);
}

// Cadastra uma nova conta EvoHub (nova API key) — admin. Depois é só Sincronizar pra puxar as conexões.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;
  const { name, api_key, api_url } = await request.json();
  if (!name?.trim() || !api_key?.trim()) return NextResponse.json({ error: "Nome e API key são obrigatórios" }, { status: 400 });

  const url = (api_url?.trim() || "https://api.evohub.ai").replace(/\/+$/, "");
  const db = admin();
  // Se não existe nenhuma conta ainda, a primeira vira a padrão.
  const { count } = await db.from("evo_accounts").select("id", { count: "exact", head: true });
  const { data, error } = await db.from("evo_accounts")
    .insert({ name: name.trim(), api_key: api_key.trim(), api_url: url, is_default: (count || 0) === 0 })
    .select("id, name, api_url, is_default")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

// Remove uma conta EvoHub — admin. Os canais dela deixam de ser puxados (não apaga conversas).
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const { error } = await admin().from("evo_accounts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
