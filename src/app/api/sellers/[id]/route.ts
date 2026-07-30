import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { name, role, is_active, evohub_channel_id, email, password } = await request.json();

  try {
    const supabase = getAdminClient();
    const profileUpdates: any = {};
    if (name !== undefined) profileUpdates.full_name = name;
    if (role !== undefined) profileUpdates.role = role;
    if (is_active !== undefined) profileUpdates.is_active = is_active;
    if (email !== undefined) profileUpdates.email = email;
    if (Object.keys(profileUpdates).length > 0) {
      await supabase.from("profiles").update(profileUpdates).eq("id", params.id);
    }

    if (email || password) {
      const authUpdates: any = {};
      if (email) authUpdates.email = email;
      if (password) authUpdates.password = password;
      await supabase.auth.admin.updateUserById(params.id, authUpdates);
    }

    if (evohub_channel_id !== undefined) {
      await supabase.from("seller_channels").delete().eq("user_id", params.id);
      if (evohub_channel_id) {
        await supabase.from("seller_channels").insert({ user_id: params.id, evohub_channel_id });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = getAdminClient();

    // Soft-delete profile
    await supabase.from("profiles").update({ is_active: false }).eq("id", params.id);
    await supabase.from("seller_channels").delete().eq("user_id", params.id);

    // Hard-delete auth user
    try { await supabase.auth.admin.deleteUser(params.id); } catch {}

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
