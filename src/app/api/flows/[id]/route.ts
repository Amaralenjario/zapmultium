import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { name, config, sort_order, trigger_type, trigger_value } = await request.json();
  const updates: Record<string, any> = {};
  if (name) updates.name = name;
  if (config) updates.config = config;
  if (sort_order !== undefined) updates.sort_order = sort_order;
  if (trigger_type !== undefined) updates.trigger_type = trigger_type;
  if (trigger_value !== undefined) updates.trigger_value = trigger_value;

  const { data, error } = await getSupabase()
    .from("flows")
    .update(updates)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { error } = await getSupabase().from("flows").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
