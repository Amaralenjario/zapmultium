import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { name, role, is_active, evohub_channel_id, email, password } = await request.json();

  try {
    const supabase = getClient();
    const profileUpdates: any = {};
    if (name !== undefined) profileUpdates.full_name = name;
    if (role !== undefined) profileUpdates.role = role;
    if (is_active !== undefined) profileUpdates.is_active = is_active;
    if (email !== undefined) profileUpdates.email = email;
    if (Object.keys(profileUpdates).length > 0) {
      await supabase.from("profiles").update(profileUpdates).eq("id", params.id);
    }

    // Auth updates (require service role key)
    if (email || password) {
      try {
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceKey) {
          const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
          const authUpdates: any = {};
          if (email) authUpdates.email = email;
          if (password) authUpdates.password = password;
          await adminClient.auth.admin.updateUserById(params.id, authUpdates);
        }
      } catch {}
    }

    // Channel assignment
    if (evohub_channel_id !== undefined) {
      try {
        await supabase.from("seller_channels").delete().eq("user_id", params.id);
        if (evohub_channel_id) {
          await supabase.from("seller_channels").insert({ user_id: params.id, evohub_channel_id });
        }
      } catch {}
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = getClient();
    await supabase.from("profiles").update({ is_active: false }).eq("id", params.id);
    await supabase.from("seller_channels").delete().eq("user_id", params.id);

    try {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceKey) {
        const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
        await adminClient.auth.admin.deleteUser(params.id);
      }
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
