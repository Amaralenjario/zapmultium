import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  const { execution_id } = await request.json();
  if (!execution_id) return NextResponse.json({ error: "execution_id required" }, { status: 400 });

  const supabase = getSupabase();
  await supabase.from("flow_executions")
    .update({ status: "error", error: "Cancelado pelo usuário", updated_at: new Date().toISOString() })
    .eq("id", execution_id)
    .in("status", ["running", "paused", "pending"]);

  return NextResponse.json({ ok: true });
}
