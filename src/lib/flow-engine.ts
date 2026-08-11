import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// no-store: fluxos leem/escrevem estado que muda a cada segundo; o Next.js Data Cache não pode congelar.
const noStoreFetch = { fetch: (input: any, init?: any) => fetch(input, { ...init, cache: "no-store" as RequestCache }) };

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false }, global: noStoreFetch });
  }
  return createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false }, global: noStoreFetch });
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

// Casa SÓ pelo handle exato (usado no wait_reply, que tem 2 saídas nomeadas: "reply" e "timeout").
function findEdgeByHandleStrict(nodeId: string, edges: any[], handle: string): string | null {
  const edge = edges.find((e: any) => e.source === nodeId && e.sourceHandle === handle);
  return edge?.target || null;
}

// Dia da semana no fuso de São Paulo. 0 = domingo … 6 = sábado.
export function saoPauloWeekday(when: Date = new Date()): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(when);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? new Date().getDay();
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false }, global: noStoreFetch }
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

// Aplica/remove uma ETIQUETA DO CRM (crm_tags) no lead do cliente — aparece no CRM e no chat.
async function applyTag(execution: any, node: any, action: "add" | "remove"): Promise<{ tagId: string; name: string } | null> {
  const cfg = node?.config || {};
  const name = (cfg.tagName || cfg.name || "").trim();
  const cfgTagId = cfg.tagId || null;
  if (!name && !cfgTagId) throw new Error("Etiqueta sem nome");
  const sb = getServiceClient();
  const { data: flowRow } = await sb.from("flows").select("user_id").eq("id", execution.flow_id).single();
  const userId = flowRow?.user_id;
  if (!userId) throw new Error("Não foi possível identificar o dono do fluxo");

  // Resolve a etiqueta: por id, senão por nome (cria se não existir)
  let tag: any = null;
  if (cfgTagId) {
    const { data } = await sb.from("crm_tags").select("id, name, column_key").eq("id", cfgTagId).maybeSingle();
    tag = data;
  }
  if (!tag && name) {
    const { data } = await sb.from("crm_tags").select("id, name, column_key").eq("user_id", userId).eq("name", name).maybeSingle();
    tag = data;
    if (!tag) {
      const { data: created } = await sb.from("crm_tags").insert({ user_id: userId, name, color: cfg.color || "#6366f1", column_key: cfg.columnKey || null }).select("id, name, column_key").single();
      tag = created;
    }
  }
  if (!tag) throw new Error(`Etiqueta "${name}" não encontrada`);

  // Find-or-create o lead pelo telefone do cliente
  const phone = execution.customer_phone;
  let leadId: string | null = null;
  const { data: existingLead } = await sb.from("leads").select("id").eq("phone", phone).maybeSingle();
  if (existingLead) leadId = existingLead.id;
  else {
    const { data: conv }: any = await sb.from("conversations").select("customer_id, customer:customer_id(name)").eq("id", execution.conversation_id).maybeSingle();
    const cust = Array.isArray(conv?.customer) ? conv.customer[0] : conv?.customer;
    const { data: created } = await sb.from("leads").insert({ name: cust?.name || phone, phone, status: tag.column_key || "new", source: "whatsapp", customer_id: conv?.customer_id || null, conversation_id: execution.conversation_id }).select("id").single();
    leadId = created?.id || null;
    // Corrida: o webhook (ou outro passo) pode ter criado o lead no mesmo instante e o
    // insert falha por telefone duplicado (created=null). Re-busca antes de desistir.
    if (!leadId) {
      const { data: again } = await sb.from("leads").select("id").eq("phone", phone).maybeSingle();
      leadId = again?.id || null;
    }
  }
  if (!leadId) throw new Error("Não foi possível resolver o lead");

  if (action === "add") {
    await sb.from("lead_tags").upsert({ lead_id: leadId, tag_id: tag.id });
    if (tag.column_key) await sb.from("leads").update({ status: tag.column_key }).eq("id", leadId);
  } else {
    await sb.from("lead_tags").delete().eq("lead_id", leadId).eq("tag_id", tag.id);
  }
  return { tagId: tag.id, name: tag.name || name };
}

// Envia texto pela Meta com RETRY em falhas TRANSITÓRIAS (rede caiu, gateway 5xx que
// devolve HTML, resposta não-JSON). Erros PERMANENTES (4xx: token inválido, número ruim)
// não são repetidos — sobem na hora. Sem isso, um soluço de rede matava o fluxo no meio.
async function sendWaTextWithRetry(phoneNumberId: string, token: string, to: string, text: string, attempts = 3): Promise<any> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${EVOHUB_API_URL}/meta/v23.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
      });
      const raw = await res.text();
      if (res.ok) {
        try { return JSON.parse(raw); }
        catch { lastErr = new Error("resposta não-JSON no envio"); } // transitório → retry
      } else if (res.status >= 400 && res.status < 500) {
        // permanente (token/numero/permissão) — repetir não adianta
        const perr: any = new Error(raw.slice(0, 300));
        perr.__permanent = true;
        throw perr;
      } else {
        lastErr = new Error(`HTTP ${res.status}: ${raw.slice(0, 150)}`); // 5xx → retry
      }
    } catch (e: any) {
      // 4xx lançado acima → permanente, não repete
      if (e?.__permanent) throw e;
      lastErr = e; // fetch failed / timeout → transitório
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1))); // 400/800ms
  }
  throw lastErr;
}

async function sendWhatsAppMessage(execution: any, text: string) {
  const { getInstanceByPhoneId, getRealChannelToken } = await import("@/lib/instances");
  const instance = getInstanceByPhoneId(execution.phone_number_id);
  if (!instance?.channelId) throw new Error("Canal não encontrado");
  const channelToken = await getRealChannelToken(instance.channelId);
  if (!channelToken) throw new Error("Token do canal não encontrado");

  const data = await sendWaTextWithRetry(execution.phone_number_id, channelToken, execution.customer_phone, text);

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

async function sendWhatsAppMedia(execution: any, url: string, mediaType: "image" | "audio" | "video", caption?: string) {
  const { getInstanceByPhoneId, getRealChannelToken } = await import("@/lib/instances");
  const instance = getInstanceByPhoneId(execution.phone_number_id);
  if (!instance?.channelId) throw new Error("Canal não encontrado");
  const channelToken = await getRealChannelToken(instance.channelId);
  if (!channelToken) throw new Error("Token do canal não encontrado");

  // Use audio pipeline for media processing
  const { processAndSendMedia } = await import("@/lib/audio-pipeline");
  const result = await processAndSendMedia(url, mediaType, execution.customer_phone, execution.phone_number_id, channelToken, caption);

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
      // Legenda vai no metadata (mesma convenção do send-media do chat) pra aparecer no MessageBubble.
      caption: caption || undefined,
    },
  });

  if (insertError) {
    console.error("Falha ao inserir mídia do fluxo:", insertError);
    throw new Error(`DB insert media: ${insertError.message}`);
  }

  await supabase.from("conversations").update({
    last_message: (caption && caption.trim()) || labels[mediaType] || "📎 Mídia",
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
        case "video": {
          const url = currentNode.config?.url || "";
          if (url) {
            const caption = currentNode.config?.caption || "";
            const mediaType = currentNode.type;
            const waId = await sendWhatsAppMedia(execution, url, mediaType, caption || undefined);
            logResult.wa_message_id = waId;
          }
          nextNodeId = findNextNode(currentNode.id, edges);
          break;
        }
        case "audio": {
          const url = currentNode.config?.url || "";
          if (url) {
            const waId = await sendWhatsAppMedia(execution, url, "audio");
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
            await startNextQueued(execution.conversation_id);
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

        case "wait_reply": {
          // Aguarda o cliente RESPONDER. Duas saídas: "reply" (respondeu) e "timeout" (sem resposta em X min).
          const replyTarget = findEdgeByHandleStrict(currentNode.id, edges, "reply");
          const timeoutMin = Math.max(0, parseFloat(currentNode.config?.timeoutMinutes) || 0);

          // Sem saída de "respondeu" conectada e sem timeout → não há o que aguardar, encerra.
          if (!replyTarget && timeoutMin <= 0) {
            await supabase.from("flow_executions").update({
              status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            }).eq("id", executionId);
            await startNextQueued(execution.conversation_id);
            return { ok: true, completed: true };
          }

          const varName = (String(currentNode.config?.variable || "").trim()) || "resposta";
          const nextStepAt = timeoutMin > 0 ? new Date(Date.now() + timeoutMin * 60000).toISOString() : null;
          const newContext = {
            ...(execution.context || {}),
            __await: { node: currentNode.id, since: new Date().toISOString(), var: varName },
          };

          await supabase.from("flow_executions").update({
            status: "awaiting_reply", current_node_id: currentNode.id,
            next_step_at: nextStepAt, context: newContext, updated_at: new Date().toISOString(),
          }).eq("id", executionId);

          await supabase.from("flow_execution_logs").insert({
            execution_id: executionId, node_id: currentNode.id, action: "wait_reply_start",
            result: { timeoutMin, nextStepAt, var: varName },
          });

          return { ok: true, paused: true, currentStep: currentNode.id };
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

        case "add_tag":
        case "remove_tag": {
          const res = await applyTag(execution, currentNode, currentNode.type === "add_tag" ? "add" : "remove");
          logResult.tag = res?.name;
          logResult.action = currentNode.type;
          nextNodeId = findNextNode(currentNode.id, edges);
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
      // fluxo falhou não pode travar a fila — segue pro próximo enfileirado
      await startNextQueued(execution.conversation_id);
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
      await startNextQueued(execution.conversation_id);
      return { ok: true, completed: true };
    }
  }

  // Safety: max steps reached
  await getSupabase().from("flow_executions").update({
    status: "error", error: "Limite de 200 passos atingido", updated_at: new Date().toISOString(),
  }).eq("id", executionId);
  await startNextQueued(execution.conversation_id);
  return { ok: false, error: "limite de passos atingido" };
}

/**
 * Inicia um fluxo numa conversa (ou enfileira, se já houver outro ativo).
 * Reaproveitado pelo disparo manual e pelo automático. Devolve o que aconteceu.
 */
export async function startFlow(params: {
  flow_id: string; conversation_id: string; customer_phone: string; phone_number_id: string;
}): Promise<"started" | "queued" | "already_active" | "no_start" | "not_found"> {
  const { flow_id, conversation_id, customer_phone, phone_number_id } = params;
  const supabase = getSupabase();

  const { data: flow } = await supabase.from("flows").select("config").eq("id", flow_id).single();
  if (!flow) return "not_found";
  const startNode = ((flow.config as any)?.steps || []).find((s: any) => s.type === "start");
  if (!startNode) return "no_start";

  // Já rodando/na fila esse mesmo fluxo nessa conversa? não duplica.
  const { data: dup } = await supabase
    .from("flow_executions").select("id")
    .eq("conversation_id", conversation_id).eq("flow_id", flow_id)
    .in("status", ["running", "paused", "pending", "queued", "awaiting_reply"]).limit(1);
  if (dup && dup.length > 0) return "already_active";

  const executionKey = `${flow_id}_${conversation_id}_${randomUUID()}`;

  // Outro fluxo ativo na conversa → entra na fila (1 por vez).
  const { data: active } = await supabase
    .from("flow_executions").select("id")
    .eq("conversation_id", conversation_id)
    .in("status", ["running", "paused", "pending", "awaiting_reply"]).limit(1);

  if (active && active.length > 0) {
    await supabase.from("flow_executions").insert({
      flow_id, conversation_id, customer_phone, phone_number_id,
      current_node_id: startNode.id, status: "queued", context: {}, execution_key: executionKey,
    });
    return "queued";
  }

  const { data: exec, error } = await supabase.from("flow_executions").insert({
    flow_id, conversation_id, customer_phone, phone_number_id,
    current_node_id: startNode.id, status: "pending", context: {}, execution_key: executionKey,
  }).select("id").single();
  if (error || !exec) return "not_found";

  try { await processFlowStep(exec.id); } catch { /* fila cuida */ }
  return "started";
}

/**
 * Fila de fluxos por conversa: quando um fluxo termina (ou falha), dispara o
 * próximo que estava em "queued" — só 1 fluxo roda por vez, sem sobreposição.
 */
async function startNextQueued(conversationId: string): Promise<void> {
  if (!conversationId) return;
  const supabase = getSupabase();
  // Não inicia se ainda houver um fluxo ativo (evita corrida).
  const { data: active } = await supabase
    .from("flow_executions").select("id")
    .eq("conversation_id", conversationId)
    .in("status", ["running", "paused", "pending", "awaiting_reply"]).limit(1);
  if (active && active.length > 0) return;
  // Pega o mais antigo da fila.
  const { data: queued } = await supabase
    .from("flow_executions").select("id")
    .eq("conversation_id", conversationId).eq("status", "queued")
    .order("started_at", { ascending: true }).limit(1);
  if (!queued || queued.length === 0) return;
  // queued → pending de forma atômica (só um promotor ganha), depois processa.
  const { data: promoted } = await supabase
    .from("flow_executions")
    .update({ status: "pending", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", queued[0].id).eq("status", "queued")
    .select("id").maybeSingle();
  if (!promoted) return;
  try { await processFlowStep(promoted.id); } catch { /* ignora, próximo terminal cuida */ }
}

/**
 * Retoma execuções paradas em "aguardar resposta": segue pela saída "reply" quando o
 * cliente respondeu (mensagem nova depois do 'since'), ou pela saída "timeout" quando
 * o tempo limite estourou sem resposta.
 */
async function advanceAwaitingReplies(): Promise<number> {
  const supabase = getSupabase();
  const { data: awaiting } = await supabase
    .from("flow_executions")
    .select("*")
    .eq("status", "awaiting_reply")
    .limit(50);

  if (!awaiting || awaiting.length === 0) return 0;

  let advanced = 0;
  for (const exec of awaiting) {
    try {
      const aw = (exec.context as any)?.__await;
      if (!aw?.node || !aw?.since) continue;

      // O cliente respondeu? (qualquer mensagem do cliente depois que entramos na espera)
      const { data: replies } = await supabase
        .from("messages")
        .select("content, content_type, created_at")
        .eq("conversation_id", exec.conversation_id)
        .eq("sender_type", "customer")
        .gt("created_at", aw.since)
        .order("created_at", { ascending: true })
        .limit(1);
      const reply = replies?.[0] as any;

      let path: "reply" | "timeout" | null = null;
      if (reply) path = "reply";
      else if (exec.next_step_at && new Date(exec.next_step_at) <= new Date()) path = "timeout";
      if (!path) continue;

      const { data: flow } = await supabase.from("flows").select("config").eq("id", exec.flow_id).single();
      const edges: any[] = (flow?.config as any)?.edges || [];
      const target = findEdgeByHandleStrict(aw.node, edges, path);

      const ctx: any = { ...(exec.context || {}) };
      if (path === "reply" && reply) {
        ctx[aw.var || "resposta"] = reply.content;
        ctx.ultima_resposta = reply.content;
      }
      delete ctx.__await;

      // awaiting_reply → pending, de forma atômica (só um vencedor), já apontando pro próximo nó.
      const { data: promoted } = await supabase
        .from("flow_executions")
        .update({ status: "pending", current_node_id: target, next_step_at: null, context: ctx, updated_at: new Date().toISOString() })
        .eq("id", exec.id).eq("status", "awaiting_reply")
        .select("id").maybeSingle();
      if (!promoted) continue;

      await supabase.from("flow_execution_logs").insert({
        execution_id: exec.id, node_id: aw.node,
        action: path === "reply" ? "reply_received" : "reply_timeout", result: { path, hasTarget: !!target },
      });

      if (!target) {
        // Caminho escolhido não está conectado a nada → encerra o fluxo.
        await supabase.from("flow_executions").update({
          status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq("id", exec.id);
        await startNextQueued(exec.conversation_id);
        advanced++;
        continue;
      }

      await processFlowStep(exec.id);
      advanced++;
    } catch {
      // continue com o próximo
    }
  }
  return advanced;
}

/**
 * Poll all paused executions with expired next_step_at and advance them.
 * Também retoma as execuções que estavam aguardando resposta do cliente.
 */
export async function advanceExpiredExecutions(): Promise<number> {
  const supabase = getSupabase();
  const { data: expired } = await supabase
    .from("flow_executions")
    .select("id")
    .eq("status", "paused")
    .lte("next_step_at", new Date().toISOString())
    .limit(50);

  let advanced = 0;
  for (const exec of (expired || [])) {
    try {
      await processFlowStep(exec.id);
      advanced++;
    } catch {
      // continue with next
    }
  }

  advanced += await advanceAwaitingReplies();
  return advanced;
}
