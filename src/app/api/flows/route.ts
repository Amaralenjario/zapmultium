import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  const { name, config } = await request.json();
  if (!name) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const { data, error } = await getSupabase()
    .from("flows")
    .insert({ name, config, trigger_type: "manual", status: "draft" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function GET() {
  const { data } = await getSupabase().from("flows").select("*").order("updated_at", { ascending: false });
  return NextResponse.json(data || []);
}
