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
  const status = searchParams.get("status") || "all";
  const limit = parseInt(searchParams.get("limit") || "30");

  const supabase = getSupabase();
  let query = supabase
    .from("flow_executions")
    .select("id, flow_id, conversation_id, customer_phone, status, current_node_id, started_at, completed_at, next_step_at, error, updated_at, flow:flow_id(name)")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (status !== "all") {
    query = query.eq("status", status);
  } else {
    query = query.in("status", ["running", "paused", "pending", "completed", "error"]);
  }

  const { data } = await query;
  if (!data || data.length === 0) return NextResponse.json([]);

  // Get conversation customer names
  const convIds = [...new Set(data.map((e) => e.conversation_id))];
  const { data: convs } = await supabase
    .from("conversations")
    .select("id, customer:customer_id(name, phone)")
    .in("id", convIds);

  const customerMap: Record<string, string> = {};
  for (const c of convs || []) {
    const cust = Array.isArray(c.customer) ? c.customer[0] : c.customer;
    customerMap[c.id] = cust?.name || cust?.phone || "Desconhecido";
  }

  return NextResponse.json(data.map((e) => ({
    id: e.id,
    flowName: Array.isArray(e.flow) ? (e.flow[0] as any)?.name : (e.flow as any)?.name || "",
    customerName: customerMap[e.conversation_id] || "",
    customerPhone: e.customer_phone,
    status: e.status,
    startedAt: e.started_at,
    completedAt: e.completed_at,
    nextStepAt: e.next_step_at,
    error: e.error,
    updatedAt: e.updated_at,
  })));
}
