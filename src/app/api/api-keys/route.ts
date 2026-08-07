import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { adminDb } from "@/lib/api-auth";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, res: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (prof?.role !== "admin" && prof?.role !== "supervisor") {
    return { ok: false as const, res: NextResponse.json({ error: "Apenas administradores" }, { status: 403 }) };
  }
  return { ok: true as const, userId: user.id };
}

export async function GET() {
  const a = await requireAdmin();
  if (!a.ok) return a.res;
  const { data } = await adminDb().from("api_keys").select("id, name, key, is_active, created_at, last_used_at").order("created_at", { ascending: false });
  return NextResponse.json({ keys: data || [] });
}

export async function POST(request: Request) {
  const a = await requireAdmin();
  if (!a.ok) return a.res;
  const { name } = await request.json().catch(() => ({}));
  const key = "zap_live_" + randomBytes(24).toString("hex");
  const { data, error } = await adminDb()
    .from("api_keys")
    .insert({ name: (name || "Chave de API").toString().slice(0, 60), key, created_by: a.userId })
    .select("id, name, key, is_active, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: Request) {
  const a = await requireAdmin();
  if (!a.ok) return a.res;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const { error } = await adminDb().from("api_keys").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
