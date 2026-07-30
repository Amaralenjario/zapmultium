import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversation_id");

  if (!conversationId) {
    return NextResponse.json({ error: "conversation_id obrigatório" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data } = await supabase
    .from("flow_executions")
    .select("id, flow_id, status, current_node_id, started_at, completed_at, next_step_at, error, context, flow:flow_id(name)")
    .eq("conversation_id", conversationId)
    .order("started_at", { ascending: false })
    .limit(10);

  return NextResponse.json(data || []);
}
