import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("quick_messages")
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

  const body = await request.json();
  const { title, content_type, content, media_url, caption } = body;

  if (!title?.trim()) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });

  const { data, error } = await supabase
    .from("quick_messages")
    .insert({
      user_id: user.id,
      title: title.trim(),
      content_type: content_type || "text",
      content: content || "",
      media_url: media_url || "",
      caption: caption || "",
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json();
  const { id, title, content_type, content, media_url, caption, sort_order } = body;

  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  // Verify ownership
  const { data: existing } = await supabase.from("quick_messages").select("user_id").eq("id", id).single();
  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title.trim();
  if (content_type !== undefined) updates.content_type = content_type;
  if (content !== undefined) updates.content = content;
  if (media_url !== undefined) updates.media_url = media_url;
  if (caption !== undefined) updates.caption = caption;
  if (sort_order !== undefined) updates.sort_order = sort_order;

  const { data, error } = await supabase
    .from("quick_messages")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await request.json();

  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const { data: existing } = await supabase.from("quick_messages").select("user_id").eq("id", id).single();
  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
  }

  const { error } = await supabase.from("quick_messages").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
