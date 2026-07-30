import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("flow_executions")
    .select("id, conversation_id, status, flow:flow_id(name)")
    .in("status", ["running", "paused", "pending"])
    .order("started_at", { ascending: false });

  if (!data || data.length === 0) return NextResponse.json([]);

  // Group by conversation_id to avoid duplicates
  const result: Record<string, { count: number; statuses: string[]; flowNames: string[] }> = {};
  for (const exec of data) {
    const cid = exec.conversation_id;
    if (!result[cid]) result[cid] = { count: 0, statuses: [], flowNames: [] };
    result[cid].count++;
    result[cid].statuses.push(exec.status);
    const flowName = Array.isArray(exec.flow) ? exec.flow[0]?.name : (exec.flow as any)?.name;
    if (flowName && !result[cid].flowNames.includes(flowName)) {
      result[cid].flowNames.push(flowName);
    }
  }

  return NextResponse.json(Object.entries(result).map(([conversation_id, info]) => ({
    conversation_id,
    ...info,
  })));
}
