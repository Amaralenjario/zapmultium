import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getBoardOwnerId } from "@/lib/crm-board";

const DEFAULT_COLUMNS = [
  { key: "new", label: "Novos", color: "#3b82f6", position: 0 },
  { key: "contacted", label: "Contatados", color: "#f59e0b", position: 1 },
  { key: "qualified", label: "Qualificados", color: "#8b5cf6", position: 2 },
  { key: "converted", label: "Convertidos", color: "#22c55e", position: 3 },
  { key: "lost", label: "Perdidos", color: "#ef4444", position: 4 },
];

export async function GET() {
  const serverClient = createServerClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Board compartilhado do time: todo mundo lê as colunas do admin (dono do board).
  const owner = await getBoardOwnerId(adminClient, user.id);
  let { data: columns } = await adminClient
    .from("crm_columns")
    .select("*")
    .eq("user_id", owner)
    .order("position");

  // Auto-create defaults if none exist
  if (!columns || columns.length === 0) {
    const defaults = DEFAULT_COLUMNS.map((c, i) => ({ ...c, user_id: owner, position: i }));
    await adminClient.from("crm_columns").insert(defaults);
    columns = defaults.map((d, i) => ({ ...d, id: `default-${i}`, created_at: new Date().toISOString() }));
  }

  return NextResponse.json(columns);
}

export async function POST(request: Request) {
  const serverClient = createServerClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { label, color } = await request.json();
  if (!label) return NextResponse.json({ error: "Label obrigatório" }, { status: 400 });

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Nova coluna vai pro board compartilhado (do admin).
  const owner = await getBoardOwnerId(adminClient, user.id);
  const { data: existing } = await adminClient.from("crm_columns").select("position").eq("user_id", owner).order("position", { ascending: false }).limit(1);
  const nextPos = (existing?.[0]?.position ?? -1) + 1;
  const key = `custom_${Date.now()}`;

  const { data, error } = await adminClient
    .from("crm_columns")
    .insert({ user_id: owner, key, label, color: color || "#6b7280", position: nextPos })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
