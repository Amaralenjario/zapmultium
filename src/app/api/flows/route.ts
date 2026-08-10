import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { name, config } = await request.json();
  if (!name) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const { createClient: createAdmin } = await import("@supabase/supabase-js");
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const dbClient = createAdmin(adminUrl, adminKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Nome duplicado: checa só entre os fluxos DO PRÓPRIO usuário (cada um tem seu namespace).
  // Antes era global — bloqueava o vendedor de usar um nome que outro já tinha (até fluxo invisível pra ele).
  const finalName = name.trim();
  const { data: existing } = await dbClient.from("flows").select("id").eq("name", finalName).eq("user_id", user.id).limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: `Você já tem um fluxo com o nome "${finalName}"` }, { status: 409 });
  }

  const { data, error } = await dbClient
    .from("flows")
    .insert({ name: finalName, config, trigger_type: "manual", status: "draft", user_id: user.id })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { createClient: createAdmin } = await import("@supabase/supabase-js");
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const dbClient = createAdmin(adminUrl, adminKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Check role
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = profile?.role === "admin" || profile?.role === "supervisor";

  let query = dbClient.from("flows").select("*").order("sort_order", { ascending: true }).order("updated_at", { ascending: false });

  // Operators only see their own flows
  if (!isAdmin) {
    query = query.eq("user_id", user.id);
  }

  const { data } = await query;
  return NextResponse.json(data || []);
}
