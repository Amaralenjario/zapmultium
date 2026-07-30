import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET() {
  const { data } = await supabase
    .from("operations")
    .select("*, channels:operations_channels(*)")
    .order("name");
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const { name, color } = await request.json();
  if (!name) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");

  const { data, error } = await supabase
    .from("operations")
    .insert({ name, slug, color: color || "#22c55e" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
