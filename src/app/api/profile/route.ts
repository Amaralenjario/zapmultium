import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key ? createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const db = admin() || supabase;
  const { data } = await db.from("profiles").select("id, full_name, email, avatar_url, role").eq("id", user.id).single();
  // profiles.email pode estar vazio — cai pro email do auth (fonte da verdade do login)
  return NextResponse.json({ ...(data || { id: user.id }), email: data?.email || user.email });
}

export async function PUT(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { full_name, avatar_url } = await request.json();
  const db = admin() || supabase;
  const updates: any = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (avatar_url !== undefined) updates.avatar_url = avatar_url;

  if (Object.keys(updates).length > 0) {
    const { error } = await db.from("profiles").update(updates).eq("id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Reflete o nome também na sessão (user_metadata)
  const a = admin();
  if (a && full_name !== undefined) {
    try { await a.auth.admin.updateUserById(user.id, { user_metadata: { full_name } }); } catch {}
  }

  return NextResponse.json({ ok: true });
}
