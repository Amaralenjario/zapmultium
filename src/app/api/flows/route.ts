import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { name, config } = await request.json();
  if (!name) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  // Use service role for DB write to bypass RLS
  const { createClient: createAdmin } = await import("@supabase/supabase-js");
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const dbClient = createAdmin(adminUrl, adminKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data, error } = await dbClient
    .from("flows")
    .insert({ name, config, trigger_type: "manual", status: "draft", user_id: user.id })
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
