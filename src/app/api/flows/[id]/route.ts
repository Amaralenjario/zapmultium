import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { resolveChannelMaps } from "@/lib/attribution";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Quem é o usuário e o que ele pode. admin/supervisor = tudo.
async function getActor() {
  const server = createServerClient();
  const { data: { user } } = await server.auth.getUser();
  if (!user) return null;
  const { data: profile } = await server.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = profile?.role === "admin" || profile?.role === "supervisor";
  return { userId: user.id, isAdmin };
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const db = getSupabase();
  const { name, config, sort_order, trigger_type, trigger_value } = await request.json();

  // Dono do fluxo — vendedor só mexe no que é dele.
  const { data: flow } = await db.from("flows").select("user_id").eq("id", params.id).single();
  if (!flow) return NextResponse.json({ error: "Fluxo não encontrado" }, { status: 404 });
  if (!actor.isAdmin && flow.user_id !== actor.userId) {
    return NextResponse.json({ error: "Você só pode editar os seus próprios fluxos." }, { status: 403 });
  }

  // Automação: vendedor só pode agendar nos PRÓPRIOS números (blindagem contra vazar pra outra operação).
  if (!actor.isAdmin && trigger_type === "schedule" && trigger_value) {
    let cfg: any = null;
    try { cfg = JSON.parse(trigger_value); } catch { cfg = null; }
    const chans: string[] = cfg && Array.isArray(cfg.channels) ? cfg.channels.map((c: any) => String(c)) : [];
    const maps = await resolveChannelMaps(db);
    const allowed = new Set(maps.sellerToPhones[actor.userId] || []);
    const bad = chans.filter((c) => !allowed.has(c));
    if (chans.length === 0 || bad.length > 0) {
      return NextResponse.json({ error: "Você só pode automatizar os seus próprios números." }, { status: 403 });
    }
  }

  const updates: Record<string, any> = {};
  if (name) updates.name = name;
  if (config) updates.config = config;
  if (sort_order !== undefined) updates.sort_order = sort_order;
  if (trigger_type !== undefined) updates.trigger_type = trigger_type;
  if (trigger_value !== undefined) updates.trigger_value = trigger_value;

  const { data, error } = await db.from("flows").update(updates).eq("id", params.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const db = getSupabase();
  if (!actor.isAdmin) {
    const { data: flow } = await db.from("flows").select("user_id").eq("id", params.id).single();
    if (!flow || flow.user_id !== actor.userId) {
      return NextResponse.json({ error: "Você só pode excluir os seus próprios fluxos." }, { status: 403 });
    }
  }
  const { error } = await db.from("flows").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
