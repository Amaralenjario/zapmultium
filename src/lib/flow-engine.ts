import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const EVOHUB_API_URL = process.env.EVOHUB_API_URL || "https://api.evohub.ai";

function findNextNode(nodeId: string, edges: any[]): string | null {
  const edge = edges.find((e: any) => e.source === nodeId);
  return edge?.target || null;
}

function findNextNodeByHandle(nodeId: string, edges: any[], handle: string): string | null {
  const edge = edges.find((e: any) => e.source === nodeId && (e.sourceHandle === handle || e.sourceHandle === undefined));
  return edge?.target || null;
}

async function sendWhatsAppMessage(execution: any, text: string) {
  const { getInstanceByPhoneId, getRealChannelToken } = await import("@/lib/instances");
  const instance = getInstanceByPhoneId(execution.phone_number_id);
  if (!instance?.channelId) throw new Error("Canal não encontrado");
  const channelToken = await getRealChannelToken(instance.channelId);
  if (!channelToken) throw new Error("Token do canal não encontrado");

  const res = await fetch(`${EVOHUB_API_URL}/meta/v23.0/${execution.phone_number_id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: execution.customer_phone,
      type: "text",
      text: { body: text },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));

  // Persist the message in the database
  const supabase = getSupabase();
  const { error: insertError } = await supabase.from("messages").insert({
    conversation_id: execution.conversation_id,
    sender_type: "agent",
    content: text,
    content_type: "text",
    metadata: {
      wa_message_id: data.messages?.[0]?.id,
      phone_number_id: execution.phone_number_id,
      flow_execution_id: execution.id,
      flow_step_node_id: execution.current_node_id,
      source: "flow",
    },
  });

  if (insertError) {
    console.error("Falha ao inserir mensagem do fluxo:", insertError);
    throw new Error(`DB insert: ${insertError.message}`);
  }

  await supabase.from("conversations").update({
    last_message: text,
    last_message_sender: "bot",
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", execution.conversation_id);

  return data.messages?.[0]?.id;
}

async function sendWhatsAppMedia(execution: any, url: string, mediaType: "image" | "audio") {
  const { getInstanceByPhoneId, getRealChannelToken } = await import("@/lib/instances");
  const instance = getInstanceByPhoneId(execution.phone_number_id);
  if (!instance?.channelId) throw new Error("Canal não encontrado");
  const channelToken = await getRealChannelToken(instance.channelId);
  if (!channelToken) throw new Error("Token do canal não encontrado");

  const res = await fetch(`${EVOHUB_API_URL}/meta/v23.0/${execution.phone_number_id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: execution.customer_phone,
      type: mediaType,
      [mediaType]: { link: url },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));

  const supabase = getSupabase();
  await supabase.from("messages").insert({
    conversation_id: execution.conversation_id,
    sender_type: "agent",
    content: url,
    content_type: mediaType,
    metadata: {
      wa_message_id: data.messages?.[0]?.id,
      phone_number_id: execution.phone_number_id,
      flow_execution_id: execution.id,
      flow_step_node_id: execution.current_node_id,
      source: "flow",
    },
  });

  await supabase.from("conversations").update({
    last_message: mediaType === "image" ? "📷 Imagem" : "🎵 Áudio",
    last_message_sender: "agent",
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", execution.conversation_id);

  return data.messages?.[0]?.id;
}

export async function processFlowStep(executionId: string): Promise<{
  ok: boolean;
  completed?: boolean;
  paused?: boolean;
  nextStepAt?: string;
  currentStep?: string;
  error?: string;
}> {
  const supabase = getSupabase();

  // Iterative loop — processes nodes one by one without recursion
  // Max 200 steps to prevent infinite loops
  for (let step = 0; step < 200; step++) {
    // Acquire row lock
    const { data: execution, error: lockError } = await supabase
      .from("flow_executions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", executionId)
      .in("status", ["running", "paused", "pending"])
      .select("*")
      .single();

    if (lockError || !execution) {
      if (step === 0) return { ok: false, error: "execução não encontrada ou já finalizada" };
      return { ok: true, completed: true };
    }

    // Get flow config
    const { data: flow } = await supabase
      .from("flows")
      .select("config")
      .eq("id", execution.flow_id)
      .single();

    if (!flow?.config) {
      await supabase.from("flow_executions").update({ status: "error", error: "fluxo não encontrado", updated_at: new Date().toISOString() }).eq("id", executionId);
      return { ok: false, error: "fluxo não encontrado" };
    }

    const steps: any[] = flow.config.steps || [];
    const edges: any[] = flow.config.edges || [];
    const currentNode = steps.find((s: any) => s.id === execution.current_node_id);

    if (!currentNode) {
      await supabase.from("flow_executions").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", executionId);
      return { ok: true, completed: true };
    }

    const logResult: Record<string, any> = {};
    let nextNodeId: string | null = null;

    try {
      switch (currentNode.type) {
        case "start":
          nextNodeId = findNextNode(currentNode.id, edges);
          break;

        case "message": {
          const text = currentNode.config?.text || "";
          if (text) {
            const waId = await sendWhatsAppMessage(execution, text);
            logResult.wa_message_id = waId;
          }
          nextNodeId = findNextNode(currentNode.id, edges);
          break;
        }

        case "image":
        case "audio": {
          const url = currentNode.config?.url || "";
          if (url) {
            const waId = await sendWhatsAppMedia(execution, url, currentNode.type as "image" | "audio");
            logResult.wa_message_id = waId;
          }
          nextNodeId = findNextNode(currentNode.id, edges);
          break;
        }

        case "wait": {
          nextNodeId = findNextNode(currentNode.id, edges);
          if (!nextNodeId) {
            await supabase.from("flow_executions").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", executionId);
            return { ok: true, completed: true };
          }

          await supabase.from("flow_executions").update({ current_node_id: nextNodeId, updated_at: new Date().toISOString() }).eq("id", executionId);

          const delaySec = Math.min(60, Math.max(0, parseInt(currentNode.config?.delay) || 5));
          const nextStepAt = new Date(Date.now() + delaySec * 1000).toISOString();
          await supabase.from("flow_executions").update({ status: "paused", next_step_at: nextStepAt, updated_at: new Date().toISOString() }).eq("id", executionId);

          await supabase.from("flow_execution_logs").insert({
            execution_id: executionId, node_id: currentNode.id, action: "wait_start",
            result: { delaySec, nextStepAt, nextNodeId },
          });

          return { ok: true, paused: true, nextStepAt, currentStep: currentNode.id };
        }

        case "condition": {
          const variable = currentNode.config?.variable || "";
          const expectedValue = currentNode.config?.value || "";
          const actualValue = execution.context?.[variable];
          const matches = String(actualValue) === String(expectedValue);
          logResult.variable = variable; logResult.expected = expectedValue; logResult.actual = actualValue; logResult.matches = matches;
          nextNodeId = findNextNodeByHandle(currentNode.id, edges, matches ? "true" : "false");
          if (!nextNodeId) nextNodeId = findNextNode(currentNode.id, edges);
          break;
        }

        default:
          nextNodeId = findNextNode(currentNode.id, edges);
      }
    } catch (err: any) {
      await supabase.from("flow_executions").update({ status: "error", error: err.message, updated_at: new Date().toISOString() }).eq("id", executionId);
      await supabase.from("flow_execution_logs").insert({ execution_id: executionId, node_id: currentNode.id, action: "error", result: { error: err.message } });
      return { ok: false, error: err.message };
    }

    // Log the step
    await supabase.from("flow_execution_logs").insert({
      execution_id: executionId, node_id: currentNode.id, action: currentNode.type, result: logResult,
    });

    if (nextNodeId) {
      await supabase.from("flow_executions").update({ current_node_id: nextNodeId, updated_at: new Date().toISOString() }).eq("id", executionId);
      // Continue loop — will pick up the new current_node_id in next iteration
    } else {
      await supabase.from("flow_executions").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", executionId);
      return { ok: true, completed: true };
    }
  }

  // Safety: max steps reached
  await getSupabase().from("flow_executions").update({ status: "error", error: "Limite de 200 passos atingido", updated_at: new Date().toISOString() }).eq("id", executionId);
  return { ok: false, error: "limite de passos atingido" };
}

/**
 * Poll all paused executions with expired next_step_at and advance them.
 */
export async function advanceExpiredExecutions(): Promise<number> {
  const supabase = getSupabase();
  const { data: expired } = await supabase
    .from("flow_executions")
    .select("id")
    .eq("status", "paused")
    .lte("next_step_at", new Date().toISOString())
    .limit(50);

  if (!expired || expired.length === 0) return 0;

  let advanced = 0;
  for (const exec of expired) {
    try {
      await processFlowStep(exec.id);
      advanced++;
    } catch {
      // continue with next
    }
  }
  return advanced;
}
