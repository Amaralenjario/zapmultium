// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { friendlyWaError } from "@/lib/wa-errors";

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

      const { data: cust }: any = await supabase
        .from("customers")
        .upsert({ name: customerName, phone: customerPhone, last_interaction_at: new Date().toISOString() } as any, { onConflict: "phone" } as any)
        .select("id").single();
      if (!cust) continue;

      const { data: existing }: any = await supabase
        .from("conversations")
        .select("id, unread_count")
        .eq("customer_id", cust.id)
        .eq("status", "active")
        .filter("metadata->>phone_number_id", "eq", phoneNumberId)
        .limit(1);

      let convId: string;
      let unread = 1;

      if (existing && existing.length > 0) {
        convId = existing[0].id;
        unread = (existing[0].unread_count || 0) + 1;
        await supabase.from("conversations").update({
          last_message_at: new Date().toISOString(),
          unread_count: unread,
          updated_at: new Date().toISOString(),
        } as any).eq("id", convId);
      } else {
        const { data: newConv, error: insErr }: any = await supabase
          .from("conversations")
          .insert({ customer_id: cust.id, status: "active", source: "whatsapp", unread_count: 1, metadata: { phone_number_id: phoneNumberId } } as any)
          .select("id").single();
        if (insErr || !newConv) {
          // Corrida/duplicidade: re-busca a conversa ativa desse cliente NESTE número.
          const { data: retry }: any = await supabase
            .from("conversations")
            .select("id, unread_count")
            .eq("customer_id", cust.id)
            .eq("status", "active")
            .filter("metadata->>phone_number_id", "eq", phoneNumberId)
            .limit(1);
          if (retry && retry.length > 0) {
            convId = retry[0].id;
            unread = (retry[0].unread_count || 0) + 1;
            await supabase.from("conversations").update({
              last_message_at: new Date().toISOString(),
              unread_count: unread,
              updated_at: new Date().toISOString(),
            } as any).eq("id", convId);
          } else {
            console.error("[EvoHub] Falha ao criar conversa:", insErr?.message, "cliente:", cust.id, "número:", phoneNumberId);
            continue;
          }
        } else {
          convId = newConv.id;
        }
      }

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

          await supabase.from("messages").insert({
            conversation_id: convId,
            sender_type: "customer",
            content,
            content_type: contentType,
            metadata: { wa_message_id: msg.id, phone_number_id: phoneNumberId, context },
            created_at: msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000).toISOString() : new Date().toISOString(),
          } as any);
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
