import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const serverClient = createServerClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data } = await adminClient.from("crm_tags").select("*").eq("user_id", user.id).order("created_at");
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const serverClient = createServerClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { name, color, column_key } = await request.json();
  if (!name || !column_key) return NextResponse.json({ error: "Nome e coluna obrigatórios" }, { status: 400 });

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await adminClient
    .from("crm_tags")
    .insert({ user_id: user.id, name, color: color || "#6b7280", column_key })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: Request) {
  const serverClient = createServerClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  await adminClient.from("lead_tags").delete().eq("tag_id", id);
  await adminClient.from("crm_tags").delete().eq("id", id).eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
