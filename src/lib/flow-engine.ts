import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
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

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function ensureConversationTag(userId: string, name: string): Promise<string | null> {
  if (!name?.trim()) return null;
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("conversation_tags")
    .upsert({ user_id: userId, name: name.trim() }, { onConflict: "user_id,name" })
    .select("id")
    .single();
  if (error) return null;
  return data?.id || null;
}

async function applyTag(execution: any, action: "add" | "remove"): Promise<{ tagId: string; name: string } | null> {
  const currentNode = execution.current_node;
  const name = (currentNode?.config?.tagName || currentNode?.config?.name || "").trim();
  if (!name) throw new Error("Etiqueta sem nome");
  const sb = getServiceClient();
  const { data: flowRow } = await sb.from("flows").select("user_id").eq("id", execution.flow_id).single();
  const userId = flowRow?.user_id;
  if (!userId) throw new Error("Não foi possível identificar o dono do fluxo");
  const tagId = await ensureConversationTag(userId, name);
  if (!tagId) throw new Error(`Falha ao resolver etiqueta "${name}"`);
  if (action === "add") {
    const { error } = await sb
      .from("conversation_tag_assignments")
      .upsert({ conversation_id: execution.conversation_id, tag_id: tagId }, { onConflict: "conversation_id,tag_id" });
    if (error) throw new Error(`add_tag: ${error.message}`);
  } else {
    const { error } = await sb
      .from("conversation_tag_assignments")
      .delete()
      .eq("conversation_id", execution.conversation_id)
      .eq("tag_id", tagId);
    if (error) throw new Error(`remove_tag: ${error.message}`);
  }
  return { tagId, name };
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
    last_message_sender: "agent",
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", execution.conversation_id);

  return data.messages?.[0]?.id;
}

async function sendWhatsAppMedia(execution: any, url: string, mediaType: "image" | "audio" | "video") {
  const { getInstanceByPhoneId, getRealChannelToken } = await import("@/lib/instances");
  const instance = getInstanceByPhoneId(execution.phone_number_id);
  if (!instance?.channelId) throw new Error("Canal não encontrado");
  const channelToken = await getRealChannelToken(instance.channelId);
  if (!channelToken) throw new Error("Token do canal não encontrado");

  // Use audio pipeline for media processing
  const { processAndSendMedia } = await import("@/lib/audio-pipeline");
  const result = await processAndSendMedia(url, mediaType, execution.customer_phone, execution.phone_number_id, channelToken);

  if (result.error) {
    console.error("Flow media pipeline error:", result.error);
    throw new Error(result.error);
  }
  const waMsgId = result.waMessageId;
  if (!waMsgId) throw new Error("Falha ao enviar mídia - sem message_id");

  const supabase = getSupabase();
  const labels: Record<string, string> = { image: "📷 Imagem", audio: "🎵 Áudio", video: "🎬 Vídeo" };
  const { error: insertError } = await supabase.from("messages").insert({
    conversation_id: execution.conversation_id,
    sender_type: "agent",
    content: url,
    content_type: mediaType,
    metadata: {
      wa_message_id: waMsgId,
      phone_number_id: execution.phone_number_id,
      flow_execution_id: execution.id,
      flow_step_node_id: execution.current_node_id,
      source: "flow",
    },
  });

  if (insertError) {
    console.error("Falha ao inserir mídia do fluxo:", insertError);
    throw new Error(`DB insert media: ${insertError.message}`);
  }

  await supabase.from("conversations").update({
    last_message: labels[mediaType] || "📎 Mídia",
    last_message_sender: "agent",
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", execution.conversation_id);

  return waMsgId;
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

  // Lock: only from paused/pending → running (prevents concurrent processing)
  const { data: execution, error: lockError } = await supabase
    .from("flow_executions")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", executionId)
    .in("status", ["paused", "pending"])
    .select("*")
    .single();

  if (lockError || !execution) {
    // Already being processed or completed
    return { ok: true, completed: true };
  }

  // Get flow config once
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

  // Process nodes in sequence without re-locking
  let currentNodeId: string | null = execution.current_node_id;
  for (let step = 0; step < 200 && currentNodeId; step++) {
    const currentNode = steps.find((s: any) => s.id === currentNodeId);
    if (!currentNode) break;

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
        case "audio":
        case "video": {
          const url = currentNode.config?.url || "";
          if (url) {
            const mediaType = currentNode.type;
            const waId = await sendWhatsAppMedia(execution, url, mediaType);
            logResult.wa_message_id = waId;
          }
          nextNodeId = findNextNode(currentNode.id, edges);
          break;
        }

        case "wait": {
          nextNodeId = findNextNode(currentNode.id, edges);
          if (!nextNodeId) {
            await supabase.from("flow_executions").update({
              status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            }).eq("id", executionId);
            return { ok: true, completed: true };
          }

          const delaySec = Math.min(60, Math.max(0, parseInt(currentNode.config?.delay) || 5));
          const nextStepAt = new Date(Date.now() + delaySec * 1000).toISOString();

          // Save progress and pause atomically
          await supabase.from("flow_executions").update({
            current_node_id: nextNodeId, status: "paused", next_step_at: nextStepAt, updated_at: new Date().toISOString(),
          }).eq("id", executionId);

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
          logResult.variable = variable; logResult.expected = expectedValue;
          logResult.actual = actualValue; logResult.matches = matches;
          nextNodeId = findNextNodeByHandle(currentNode.id, edges, matches ? "true" : "false");
          if (!nextNodeId) nextNodeId = findNextNode(currentNode.id, edges);
          break;
        }

        default:
          nextNodeId = findNextNode(currentNode.id, edges);
      }
    } catch (err: any) {
      await supabase.from("flow_executions").update({
        status: "error", error: err.message, updated_at: new Date().toISOString(),
      }).eq("id", executionId);
      await supabase.from("flow_execution_logs").insert({
        execution_id: executionId, node_id: currentNode.id, action: "error", result: { error: err.message },
      });
      return { ok: false, error: err.message };
    }

    // Log and advance
    await supabase.from("flow_execution_logs").insert({
      execution_id: executionId, node_id: currentNode.id, action: currentNode.type, result: logResult,
    });

    if (nextNodeId) {
      // Save progress (not a lock, just update)
      await supabase.from("flow_executions").update({
        current_node_id: nextNodeId, updated_at: new Date().toISOString(),
      }).eq("id", executionId);
      currentNodeId = nextNodeId;
    } else {
      await supabase.from("flow_executions").update({
        status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", executionId);
      return { ok: true, completed: true };
    }
  }

  // Safety: max steps reached
  await getSupabase().from("flow_executions").update({
    status: "error", error: "Limite de 200 passos atingido", updated_at: new Date().toISOString(),
  }).eq("id", executionId);
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
