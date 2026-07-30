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
  try {
    const body = await request.json();
    const { flow_id, conversation_id, customer_phone, phone_number_id } = body;

    if (!flow_id || !conversation_id || !customer_phone || !phone_number_id) {
      return NextResponse.json({ error: "Campos obrigatórios: flow_id, conversation_id, customer_phone, phone_number_id" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Check if there's already an active execution for this flow+conversation
    const { data: existing } = await supabase
      .from("flow_executions")
      .select("id, status")
      .eq("flow_id", flow_id)
      .eq("conversation_id", conversation_id)
      .in("status", ["running", "paused", "pending"])
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        error: "Já existe uma execução ativa para este fluxo nesta conversa",
        execution_id: existing.id,
        status: existing.status,
      }, { status: 409 });
    }

    // Get the flow to verify it exists and has a start node
    const { data: flow } = await supabase
      .from("flows")
      .select("config")
      .eq("id", flow_id)
      .single();

    if (!flow) {
      return NextResponse.json({ error: "Fluxo não encontrado" }, { status: 404 });
    }

    const startNode = (flow.config?.steps || []).find((s: any) => s.id === "start");
    if (!startNode) {
      return NextResponse.json({ error: "Fluxo não possui nó de início" }, { status: 400 });
    }

    // Generate a unique execution key to prevent duplicates
    const executionKey = `${flow_id}_${conversation_id}_${Date.now()}`;

    // Create execution
    const { data: execution, error: createError } = await supabase
      .from("flow_executions")
      .insert({
        flow_id,
        conversation_id,
        customer_phone,
        phone_number_id,
        current_node_id: "start",
        status: "running",
        context: {},
        execution_key: executionKey,
      })
      .select("*")
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Process the first step
    const { processFlowStep } = await import("@/lib/flow-engine");
    const result = await processFlowStep(execution.id);

    return NextResponse.json({
      ok: true,
      execution,
      result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
