import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { name, role, is_active, evohub_channel_id, email, password } = await request.json();

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

  // Save channel assignment
  if (evohub_channel_id !== undefined) {
    if (evohub_channel_id) {
      await supabase.from("seller_channels").delete().eq("user_id", params.id);
      await supabase.from("seller_channels").insert({ user_id: params.id, evohub_channel_id });
    } else {
      await supabase.from("seller_channels").delete().eq("user_id", params.id);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await supabase.from("profiles").update({ is_active: false }).eq("id", params.id);
  await supabase.from("seller_channels").delete().eq("user_id", params.id);
  await supabase.auth.admin.deleteUser(params.id);
  return NextResponse.json({ ok: true });
}
