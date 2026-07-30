import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "supervisor") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { name, role, is_active, evohub_channel_id, email, password } = await request.json();
  const adminClient = getAdminClient();
  const dbClient = adminClient || supabase;

  const profileUpdates: any = {};
  if (name !== undefined) profileUpdates.full_name = name;
  if (role !== undefined) profileUpdates.role = role;
  if (is_active !== undefined) profileUpdates.is_active = is_active;
  if (email !== undefined) profileUpdates.email = email;

  if (Object.keys(profileUpdates).length > 0) {
    console.log("Updating profile", params.id, profileUpdates);
    const { error } = await dbClient.from("profiles").update(profileUpdates).eq("id", params.id);
    if (error) console.error("Profile update error:", error);
  }

  if (email || password) {
    if (adminClient) {
      const authUpdates: any = {};
      if (email) authUpdates.email = email;
      if (password) authUpdates.password = password;
      await adminClient.auth.admin.updateUserById(params.id, authUpdates);
    }
  }

  if (evohub_channel_id !== undefined) {
    const { error: delErr } = await dbClient.from("seller_channels").delete().eq("user_id", params.id);
    if (delErr) return NextResponse.json({ error: `Erro ao remover canal: ${delErr.message}` }, { status: 500 });
    if (evohub_channel_id) {
      const { error: insErr } = await dbClient.from("seller_channels").insert({ user_id: params.id, evohub_channel_id });
      if (insErr) return NextResponse.json({ error: `Erro ao vincular canal: ${insErr.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const adminClient = getAdminClient();
  const dbClient = adminClient || supabase;

  await dbClient.from("profiles").update({ is_active: false }).eq("id", params.id);
  await dbClient.from("seller_channels").delete().eq("user_id", params.id);

  if (adminClient) {
    try { await adminClient.auth.admin.deleteUser(params.id); } catch {}
  }

  return NextResponse.json({ ok: true });
}
