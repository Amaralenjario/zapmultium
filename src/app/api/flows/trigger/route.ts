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

    // Fluxo precisa existir e ter nó de início (usado tanto pra rodar quanto pra enfileirar).
    const { data: flow } = await supabase.from("flows").select("config").eq("id", flow_id).single();
    if (!flow) return NextResponse.json({ error: "Fluxo não encontrado" }, { status: 404 });
    const startNode = (flow.config?.steps || []).find((s: any) => s.type === "start");
    if (!startNode) return NextResponse.json({ error: "Fluxo não possui nó de início" }, { status: 400 });

    // Não duplica: se ESTE fluxo já está rodando ou na fila desta conversa, ignora.
    const { data: dup } = await supabase
      .from("flow_executions")
      .select("id, status")
      .eq("conversation_id", conversation_id)
      .eq("flow_id", flow_id)
      .in("status", ["running", "paused", "pending", "queued"])
      .limit(1);
    if (dup && dup.length > 0) {
      return NextResponse.json({
        ok: true, alreadyActive: true,
        message: dup[0].status === "queued"
          ? "Este fluxo já está na fila desta conversa."
          : "Este fluxo já está em andamento nesta conversa.",
      });
    }

    const executionKey = `${flow_id}_${conversation_id}_${randomUUID()}`;

    // Só UM fluxo ativo por conversa. Se já houver um rodando/pausado/pendente,
    // o novo entra na FILA e dispara sozinho quando o atual terminar (evita 2 funis
    // sobrepostos misturando mensagens, ex.: mandar o 04 e sair o 09 junto).
    const { data: activeOnConv } = await supabase
      .from("flow_executions")
      .select("id, status, flow_id")
      .eq("conversation_id", conversation_id)
      .in("status", ["running", "paused", "pending"])
      .order("started_at", { ascending: false })
      .limit(1);

    if (activeOnConv && activeOnConv.length > 0) {
      // Quantos já esperam na fila (pra saber se é "após o atual" ou "após os anteriores").
      const { count: queuedCount } = await supabase
        .from("flow_executions")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversation_id)
        .eq("status", "queued");

      const { data: queuedExec, error: qErr } = await supabase
        .from("flow_executions")
        .insert({
          flow_id, conversation_id, customer_phone, phone_number_id,
          current_node_id: startNode.id, status: "queued", context: {}, execution_key: executionKey,
        })
        .select("*")
        .single();
      if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

      let nome = "o fluxo atual";
      const { data: af } = await supabase.from("flows").select("name").eq("id", activeOnConv[0].flow_id).single();
      if (af?.name) nome = `"${af.name}"`;

      return NextResponse.json({
        ok: true, queued: true, execution: queuedExec, queuePosition: (queuedCount || 0) + 1,
        message: (queuedCount || 0) > 0
          ? "Fluxo adicionado à fila — será disparado após os fluxos anteriores terminarem."
          : `Fluxo na fila — será disparado automaticamente quando ${nome} terminar.`,
      });
    }

    // Nenhum fluxo ativo → roda agora.
    const { data: execution, error: createError } = await supabase
      .from("flow_executions")
      .insert({
        flow_id, conversation_id, customer_phone, phone_number_id,
        current_node_id: startNode.id, status: "pending", context: {}, execution_key: executionKey,
      })
      .select("*")
      .single();

    if (createError) return NextResponse.json({ error: createError.message }, { status: 500 });

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
