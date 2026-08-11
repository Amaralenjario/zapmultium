// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { friendlyWaError } from "@/lib/wa-errors";
import { notifyNewMessage } from "@/lib/web-push";

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
    _supabaseAdmin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _supabaseAdmin;
}

const WEBHOOK_SECRET = process.env.EVOHUB_WEBHOOK_SECRET || "zapmultium-webhook-secret";

// Insere a mensagem com retry. O insert do supabase-js NÃO lança em erro de banco —
// ele devolve { error }. Antes a gente ignorava esse retorno: se o insert falhasse
// (timeout / pool esgotado sob carga), a mensagem do lead sumia SILENCIOSAMENTE e a
// gente ainda respondia 200 (a Meta achava que entregou). Agora tenta de novo e, se
// mesmo assim falhar, grava um log gritante pra termos rastro.
async function insertMessageWithRetry(supabase: any, row: any, attempts = 4): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const { error } = await supabase.from("messages").insert(row);
    if (!error) return true;
    if (error.code === "23505") return true; // duplicata (retry) → já está lá, ok
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 200 * (i + 1))); // 200/400/600ms
    } else {
      console.error(
        "[EvoHub] PERDA DE MENSAGEM — insert falhou após", attempts, "tentativas:",
        error.message, "| conv:", row.conversation_id, "| wa_id:", row?.metadata?.wa_message_id
      );
    }
  }
  return false;
}

// Upsert do cliente com retry. Sob carga (GABI recebe ~1800 leads/dia), o upsert podia
// falhar por timeout e a gente fazia `continue` — DESCARTANDO todas as mensagens do lead
// sem log. Isso fazia "o lead aparecer no zap mas não na plataforma".
async function upsertCustomerWithRetry(supabase: any, name: string, phone: string, attempts = 4): Promise<{ id: string } | null> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supabase
      .from("customers")
      .upsert({ name, phone, last_interaction_at: new Date().toISOString() }, { onConflict: "phone" })
      .select("id").single();
    if (data?.id) return data;
    lastErr = error;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 200 * (i + 1)));
  }
  console.error("[EvoHub] PERDA DE LEAD — upsert do cliente falhou:", lastErr?.message, "| phone:", phone);
  return null;
}

// Acha a conversa ATIVA do cliente NESTE número, ou cria. Robusto a corrida (23505 →
// outro processo criou, re-busca) e a falha transitória (retry do insert). Antes, uma
// falha transitória na criação fazia `continue` e o lead sumia.
async function findOrCreateActiveConversation(supabase: any, customerId: string, phoneNumberId: string, attempts = 4): Promise<{ id: string; unread_count: number } | null> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    const { data: found } = await supabase
      .from("conversations")
      .select("id, unread_count")
      .eq("customer_id", customerId).eq("status", "active")
      .filter("metadata->>phone_number_id", "eq", phoneNumberId).limit(1);
    if (found && found.length > 0) return found[0];

    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ customer_id: customerId, status: "active", source: "whatsapp", unread_count: 0, metadata: { phone_number_id: phoneNumberId } })
      .select("id, unread_count").single();
    if (created?.id) return created;
    lastErr = error;
    // 23505 = corrida (outro criou no mesmo instante) → volta ao topo e acha na re-busca.
    // Erro transitório → espera e tenta de novo.
    if (error?.code !== "23505" && i < attempts - 1) await new Promise((r) => setTimeout(r, 200 * (i + 1)));
  }
  console.error("[EvoHub] PERDA DE LEAD — não achou/criou conversa:", lastErr?.message, "| cliente:", customerId, "| número:", phoneNumberId);
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === WEBHOOK_SECRET) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Verification failed", { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    let payload: any;
    try { payload = JSON.parse(body); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (payload.event_type) {
      console.log("[EvoHub] Lifecycle:", payload.event_type);
      return NextResponse.json({ ok: true });
    }
    if (payload.object === "whatsapp_business_account") {
      await processMessages(payload);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[EvoHub] Error:", error.message);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

async function processMessages(payload: any) {
  const supabase = getSupabaseAdmin();
  const entries = payload.entry || [];

  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      if (change.field !== "messages") continue;
      const value = change.value || {};
      const messages = value.messages || [];
      const contact = value.contacts?.[0];
      const meta = value.metadata || {};
      const phoneNumberId = meta.phone_number_id || entry.id;

      // Status de entrega/leitura das mensagens que ENVIAMOS (read receipts, falhas)
      const statuses = value.statuses || [];
      if (statuses.length > 0) {
        await processStatuses(supabase, statuses);
      }

      if (messages.length === 0) continue;
      const from = messages[0]?.from || contact?.wa_id;
      if (!from) continue;

      const customerName = contact?.profile?.name || from;
      const customerPhone = from;

      const cust = await upsertCustomerWithRetry(supabase, customerName, customerPhone);
      if (!cust) continue; // já logado como PERDA DE LEAD

      const conv = await findOrCreateActiveConversation(supabase, cust.id, phoneNumberId);
      if (!conv) continue; // já logado como PERDA DE LEAD

      const convId: string = conv.id;
      const unread = (conv.unread_count || 0) + 1;
      await supabase.from("conversations").update({
        last_message_at: new Date().toISOString(),
        unread_count: unread,
        updated_at: new Date().toISOString(),
      } as any).eq("id", convId);

      for (const msg of messages) {
        let content = "";
        let contentType = "text";
        if (msg.type === "text") { content = msg.text?.body || ""; }
        else if (msg.type === "image") { content = "\u{1F4F7} Imagem"; contentType = "image"; }
        else if (msg.type === "video") { content = "\u{1F3AC} Vídeo"; contentType = "video"; }
        else if (msg.type === "audio") { content = "\u{1F3A4} Áudio"; contentType = "audio"; }
        else if (msg.type === "document") { content = "\u{1F4C4} Documento"; contentType = "document"; }
        else if (msg.type === "location") { content = "\u{1F4CD} Localização"; contentType = "location"; }
        else if (msg.type === "sticker") { content = "\u{1F3B4} Sticker"; contentType = "image"; }
        else if (msg.type === "button") { content = msg.button?.text || "[Botão]"; }
        else if (msg.type === "interactive") { content = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "[Interativo]"; }
        else { content = `[${msg.type}]`; }

        if (content) {
          const context = msg.context || null;

          // If this message is a reply, look up the quoted message content
          if (context?.id) {
            const { data: quoted } = await supabase
              .from("messages")
              .select("content, content_type, sender_type")
              .filter("metadata->>wa_message_id", "eq", context.id)
              .limit(1);
            if (quoted && quoted.length > 0) {
              context.quoted_content = quoted[0].content;
              context.quoted_content_type = quoted[0].content_type;
              context.quoted_sender_type = quoted[0].sender_type;
            }
          }

          await insertMessageWithRetry(supabase, {
            conversation_id: convId,
            sender_type: "customer",
            content,
            content_type: contentType,
            metadata: { wa_message_id: msg.id, phone_number_id: phoneNumberId, context },
            created_at: msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000).toISOString() : new Date().toISOString(),
          });
        }
      }

      const lastMsg = messages[messages.length - 1];
      const mediaLabels: Record<string, string> = {
        audio: "🎵 Áudio",
        image: "📷 Imagem",
        video: "🎬 Vídeo",
        document: "📄 Documento",
        sticker: "🌟 Figurinha",
        location: "📍 Localização",
        contacts: "👤 Contato",
        reaction: "❤️ Reação",
        interactive: "💬 Interativo",
      };
      let lastContent = "";
      if (lastMsg.type === "text") lastContent = lastMsg.text?.body || "";
      else if (lastMsg.type === "button") lastContent = lastMsg.button?.text || "";
      else lastContent = mediaLabels[lastMsg.type] || `[${lastMsg.type}]`;

      await supabase.from("conversations").update({
        last_message: lastContent,
        last_message_at: new Date().toISOString(),
        last_message_sender: "customer",
      } as any).eq("id", convId);

      // Notificação push pro(s) vendedor(es) do canal (best effort — nunca quebra a ingestão).
      await notifyNewMessage(supabase, {
        phoneNumberId,
        conversationId: convId,
        customerName,
        content: lastContent,
      });
    }
  }
}

// Processa status de entrega/leitura das mensagens que ENVIAMOS.
// status "read" = cliente visualizou → grava read_at e (se for a última do atendente) marca o preview.
// status "failed" = não entregue → grava o motivo pra aparecer em vermelho.
async function processStatuses(supabase: any, statuses: any[]) {
  for (const st of statuses) {
    if (!st?.id) continue;
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, conversation_id, read_at, metadata, sender_type")
      .filter("metadata->>wa_message_id", "eq", st.id)
      .limit(1);
    const m = msgs?.[0];
    if (!m) continue;

    if (st.status === "read") {
      if (!m.read_at) {
        const ts = st.timestamp ? new Date(parseInt(st.timestamp) * 1000).toISOString() : new Date().toISOString();
        await supabase.from("messages").update({ read_at: ts } as any).eq("id", m.id);
      }
      // Se é a última mensagem do atendente na conversa, marca o preview como "lido"
      const { data: last } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", m.conversation_id)
        .eq("sender_type", "agent")
        .order("created_at", { ascending: false })
        .limit(1);
      if (last?.[0]?.id === m.id) {
        await supabase.from("conversations").update({ last_message_read: true } as any).eq("id", m.conversation_id);
      }
    } else if (st.status === "failed") {
      const reason = friendlyWaError({ error: st.errors?.[0] || st });
      await supabase.from("messages").update({ metadata: { ...(m.metadata || {}), error: reason, failed: true } } as any).eq("id", m.id);
    }
  }
}
