import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

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

    // Prevent rapid re-triggering: check any execution in the last 30s
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
    const { data: recent } = await supabase
      .from("flow_executions")
      .select("id, status, created_at")
      .eq("flow_id", flow_id)
      .eq("conversation_id", conversation_id)
      .gte("created_at", thirtySecondsAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    if (recent && recent.length > 0) {
      return NextResponse.json({
        error: "Uma execução recente deste fluxo já foi disparada. Aguarde 30 segundos.",
        recent_execution_id: recent[0].id,
        recent_status: recent[0].status,
      }, { status: 429 });
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

    const startNode = (flow.config?.steps || []).find((s: any) => s.type === "start");
    if (!startNode) {
      return NextResponse.json({ error: "Fluxo não possui nó de início" }, { status: 400 });
    }

    const executionKey = `${flow_id}_${conversation_id}_${randomUUID()}`;

    // Create execution
    const { data: execution, error: createError } = await supabase
      .from("flow_executions")
      .insert({
        flow_id,
        conversation_id,
        customer_phone,
        phone_number_id,
        current_node_id: startNode.id,
        status: "pending",
        context: {},
        execution_key: executionKey,
      })
      .select("*")
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Process synchronously so errors are returned to client
    const { processFlowStep } = await import("@/lib/flow-engine");
    try {
      const result = await processFlowStep(execution.id);
      return NextResponse.json({ ok: true, execution, result });
    } catch (err: any) {
      console.error("processFlowStep failed:", err?.message || err);
      return NextResponse.json({ ok: true, execution, warning: "Processamento em background falhou" });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
