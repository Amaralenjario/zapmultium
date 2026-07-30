import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SB_URL")!;
const supabaseKey = Deno.env.get("SB_SERVICE_KEY")!;
const webhookSecret = Deno.env.get("EVOHUB_WEBHOOK_SECRET") || "zapmultium-webhook-secret";

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(async (req: Request) => {
  // GET: verificação do webhook Meta (hub.challenge)
  const url = new URL(req.url);
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === webhookSecret) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Verification failed", { status: 403 });
  }

  // POST: receber eventos
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.text();
    let payload: any;
    try {
      payload = JSON.parse(body);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }

    // Evento de ciclo de vida
    if (payload.event_type) {
      console.log("[EvoHub] Lifecycle:", payload.event_type, payload.channel_id);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Evento Meta - WhatsApp
    if (payload.object === "whatsapp_business_account") {
      await processWhatsAppMessages(payload);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error: any) {
    console.error("[EvoHub] Erro:", error.message);
    return new Response(JSON.stringify({ error: "Internal" }), { status: 500 });
  }
});

async function processWhatsAppMessages(payload: any) {
  const entries = payload.entry || [];

  for (const entry of entries) {
    const changes = entry.changes || [];

    for (const change of changes) {
      if (change.field !== "messages") continue;

      const value = change.value || {};
      const messages = value.messages || [];
      const statuses = value.statuses || [];
      const contact = value.contacts?.[0];
      const metadata = value.metadata || {};
      const phoneNumberId = metadata.phone_number_id || entry.id;

      // Processa status de leitura (lead visualizou)
      if (statuses.length > 0) {
        await processReadReceipts(supabase, statuses);
      }

      if (messages.length === 0) continue;

      const from = messages[0]?.from || contact?.wa_id;
      if (!from) continue;

      const customerName = contact?.profile?.name || from;
      const customerPhone = from;

      // Upsert customer
      const { data: cust } = await supabase
        .from("customers")
        .upsert(
          { name: customerName, phone: customerPhone, last_interaction_at: new Date().toISOString() },
          { onConflict: "phone" }
        )
        .select("id")
        .single();

      if (!cust) continue;

      // Buscar ou criar conversa
      const { data: existing } = await supabase
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
        await supabase
          .from("conversations")
          .update({
            last_message_at: new Date().toISOString(),
            unread_count: unread,
            updated_at: new Date().toISOString(),
          })
          .eq("id", convId);
      } else {
        const { data: newConv } = await supabase
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
          content = "🖼 Imagem";
          contentType = "image";
        } else if (msg.type === "video") {
          content = "🎬 Vídeo";
          contentType = "video";
        } else if (msg.type === "audio") {
          content = "🎤 Áudio";
          contentType = "audio";
        } else if (msg.type === "document") {
          content = "📄 Documento";
          contentType = "document";
        } else if (msg.type === "location") {
          content = "📍 Localização";
          contentType = "location";
        } else if (msg.type === "sticker") {
          content = "🏴 Sticker";
          contentType = "image";
        } else if (msg.type === "button") {
          content = msg.button?.text || "[Botão]";
        } else if (msg.type === "interactive") {
          content = msg.interactive?.button_reply?.title ||
            msg.interactive?.list_reply?.title ||
            "[Interativo]";
        } else {
          content = `[${msg.type}]`;
        }

        if (content) {
          // Check for duplicate by wa_message_id
          const waId = msg.id;
          if (waId) {
            const { data: existing } = await supabase
              .from("messages")
              .select("id")
              .eq("conversation_id", convId)
              .filter("metadata->>wa_message_id", "eq", waId)
              .limit(1);
            if (existing && existing.length > 0) continue;
          }

          await supabase.from("messages").insert({
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

      // Atualizar last_message
      const lastMsg = messages[messages.length - 1];
      let lastContent = "";
      if (lastMsg.type === "text") lastContent = lastMsg.text?.body || "";
      else if (lastMsg.type === "button") lastContent = lastMsg.button?.text || "";
      else lastContent = `[${lastMsg.type}]`;

      await supabase
        .from("conversations")
        .update({
          last_message: lastContent,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", convId);
    }
  }
}

async function processReadReceipts(supabase: any, statuses: any[]) {
  for (const status of statuses) {
    if (status.status !== "read") continue;
    const waMessageId = status.id;
    if (!waMessageId) continue;

    await supabase
      .from("messages")
      .update({ read_at: new Date(parseInt(status.timestamp) * 1000).toISOString() })
      .filter("metadata->>wa_message_id", "eq", waMessageId);
  }
}
