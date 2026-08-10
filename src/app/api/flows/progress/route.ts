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

  const { data: exec } = await supabase
    .from("flow_executions")
    .select("id, flow_id, status, current_node_id, next_step_at, flow:flow_id(name, config)")
    .eq("conversation_id", conversationId)
    .in("status", ["running", "paused", "awaiting_reply"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!exec) return NextResponse.json(null);

  const flowConfig = Array.isArray(exec.flow) ? (exec.flow[0] as any)?.config : (exec.flow as any)?.config;
  const flowName = Array.isArray(exec.flow) ? (exec.flow[0] as any)?.name : (exec.flow as any)?.name;
  const steps: any[] = flowConfig?.steps || [];
  const edges: any[] = flowConfig?.edges || [];

  const currentIdx = steps.findIndex((s: any) => s.id === exec.current_node_id);
  const currentNode = currentIdx >= 0 ? steps[currentIdx] : null;

  // Find next step
  let nextNode: any = null;
  if (currentNode) {
    const nextEdge = edges.find((e: any) => e.source === currentNode.id);
    if (nextEdge) {
      nextNode = steps.find((s: any) => s.id === nextEdge.target) || null;
    }
  }

  return NextResponse.json({
    id: exec.id,
    flowName: flowName || "",
    status: exec.status,
    currentStep: currentNode ? { id: currentNode.id, type: currentNode.type, label: currentNode.label, config: currentNode.config } : null,
    nextStep: nextNode ? { id: nextNode.id, type: nextNode.type, label: nextNode.label } : null,
    totalSteps: steps.length,
    currentStepIndex: currentIdx + 1,
    nextStepAt: exec.next_step_at,
  });
}
