import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const WEBHOOK_SECRET = process.env.EVOHUB_WEBHOOK_SECRET || "zapmultium-webhook-secret";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
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
    try {
      payload = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Evento de ciclo de vida (channel_connected, channel_disconnected, etc)
    if (payload.event_type) {
      console.log("[EvoHub] Lifecycle:", payload.event_type, payload.channel_id);
      return NextResponse.json({ ok: true });
    }

    // Evento Meta - WhatsApp
    if (payload.object === "whatsapp_business_account") {
      await processWhatsAppMessages(payload);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[EvoHub] Erro:", error.message);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

async function processWhatsAppMessages(payload: any) {
  const entries = payload.entry || [];

  for (const entry of entries) {
    const changes = entry.changes || [];

    for (const change of changes) {
      if (change.field !== "messages") continue;

      const value = change.value || {};
      const messages = value.messages || [];
      const contact = value.contacts?.[0];
      const metadata = value.metadata || {};
      const phoneNumberId = metadata.phone_number_id || entry.id;
      const from = messages[0]?.from || contact?.wa_id;

      if (!from || messages.length === 0) continue;

      const customerName = contact?.profile?.name || from;
      const customerPhone = from;

      // Upsert customer
      const { data: cust } = await supabaseAdmin
        .from("customers")
        .upsert(
          { name: customerName, phone: customerPhone, last_interaction_at: new Date().toISOString() },
          { onConflict: "phone" }
        )
        .select("id")
        .single();

      if (!cust) continue;

      // Buscar conversa ativa ou criar
      const { data: existing } = await supabaseAdmin
        .from("conversations")
        .select("id, unread_count")
        .eq("customer_id", cust.id)
        .eq("status", "active")
        .limit(1);

      let convId: string;
      let unread = 1;

      if (existing && existing.length > 0) {
        convId = existing[0].id;
        unread = (existing[0].unread_count || 0) + 1;
        await supabaseAdmin
          .from("conversations")
          .update({ last_message_at: new Date().toISOString(), unread_count: unread, updated_at: new Date().toISOString() })
          .eq("id", convId);
      } else {
        const { data: newConv } = await supabaseAdmin
          .from("conversations")
          .insert({
            customer_id: cust.id,
            status: "active",
            source: "whatsapp",
            unread_count: 1,
            metadata: { phone_number_id: phoneNumberId },
          })
          .select("id")
          .single();
        convId = newConv!.id;
      }

      // Inserir mensagens
      for (const msg of messages) {
        let content = "";
        let contentType = "text";

        if (msg.type === "text") {
          content = msg.text?.body || "";
        } else if (msg.type === "image") {
          content = "\u{1F4F7} Imagem";
          contentType = "image";
        } else if (msg.type === "video") {
          content = "\u{1F3AC} Vídeo";
          contentType = "video";
        } else if (msg.type === "audio") {
          content = "\u{1F3A4} Áudio";
          contentType = "audio";
        } else if (msg.type === "document") {
          content = "\u{1F4C4} Documento";
          contentType = "document";
        } else if (msg.type === "location") {
          content = "\u{1F4CD} Localização";
          contentType = "location";
        } else if (msg.type === "sticker") {
          content = "\u{1F3B4} Sticker";
          contentType = "image";
        } else if (msg.type === "button") {
          content = msg.button?.text || "[Botão]";
        } else if (msg.type === "interactive") {
          content = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "[Interativo]";
        } else {
          content = `[${msg.type}]`;
        }

        if (content) {
          await supabaseAdmin.from("messages").insert({
            conversation_id: convId,
            sender_type: "customer",
            content,
            content_type: contentType,
            metadata: { wa_message_id: msg.id, phone_number_id: phoneNumberId },
            created_at: msg.timestamp
              ? new Date(parseInt(msg.timestamp) * 1000).toISOString()
              : new Date().toISOString(),
          });
        }
      }

      // Atualizar last_message da conversa
      const lastMsg = messages[messages.length - 1];
      let lastContent = "";
      if (lastMsg.type === "text") lastContent = lastMsg.text?.body || "";
      else if (lastMsg.type === "button") lastContent = lastMsg.button?.text || "";
      else lastContent = `[${lastMsg.type}]`;

      await supabaseAdmin
        .from("conversations")
        .update({ last_message: lastContent, last_message_at: new Date().toISOString() })
        .eq("id", convId);
    }
  }
}
