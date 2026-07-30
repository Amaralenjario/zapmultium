import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { evohub_channel_id, evohub_channel_name, phone_number_id } = await request.json();

  const { data, error } = await supabase
    .from("operations_channels")
    .upsert({
      operation_id: params.id,
      evohub_channel_id,
      evohub_channel_name,
      phone_number_id: phone_number_id || null,
    }, { onConflict: "operation_id, evohub_channel_id" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { channel_id } = await request.json();
  if (!channel_id) return NextResponse.json({ error: "channel_id obrigatório" }, { status: 400 });

  const { error } = await supabase
    .from("operations_channels")
    .delete()
    .eq("operation_id", params.id)
    .eq("id", channel_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
