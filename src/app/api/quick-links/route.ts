import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("quick_links")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { title, url } = await request.json();
  if (!title?.trim()) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });
  if (!url?.trim()) return NextResponse.json({ error: "URL obrigatória" }, { status: 400 });

  const { data, error } = await supabase
    .from("quick_links")
    .insert({ user_id: user.id, title: title.trim(), url: url.trim() })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id, title, url, sort_order } = await request.json();
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const { data: existing } = await supabase.from("quick_links").select("user_id").eq("id", id).single();
  if (!existing || existing.user_id !== user.id) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title.trim();
  if (url !== undefined) updates.url = url.trim();
  if (sort_order !== undefined) updates.sort_order = sort_order;

  const { data, error } = await supabase.from("quick_links").update(updates).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const { data: existing } = await supabase.from("quick_links").select("user_id").eq("id", id).single();
  if (!existing || existing.user_id !== user.id) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  await supabase.from("quick_links").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
