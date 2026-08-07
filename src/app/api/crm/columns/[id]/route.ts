import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getBoardOwnerId } from "@/lib/crm-board";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const serverClient = createServerClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { label, color, position } = await request.json();
  const updates: any = {};
  if (label) updates.label = label;
  if (color) updates.color = color;
  if (position !== undefined) updates.position = position;

  const db = admin();
  const owner = await getBoardOwnerId(db, user.id);
  const { error } = await db.from("crm_columns").update(updates).eq("id", params.id).eq("user_id", owner);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const serverClient = createServerClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const db = admin();
  const owner = await getBoardOwnerId(db, user.id);
  // Descobre a key da coluna pra remover as etiquetas dela e soltar os leads.
  const { data: col } = await db.from("crm_columns").select("key").eq("id", params.id).eq("user_id", owner).maybeSingle();
  if (col?.key) {
    await db.from("crm_tags").delete().eq("column_key", col.key);
    await db.from("leads").update({ status: "new" }).eq("status", col.key);
  }
  await db.from("crm_columns").delete().eq("id", params.id).eq("user_id", owner);

  return NextResponse.json({ ok: true });
}
