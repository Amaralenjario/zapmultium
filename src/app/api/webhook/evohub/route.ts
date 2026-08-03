// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
        const { data: newConv }: any = await supabase
          .from("conversations")
          .insert({ customer_id: cust.id, status: "active", source: "whatsapp", unread_count: 1, metadata: { phone_number_id: phoneNumberId } } as any)
          .select("id").single();
        convId = newConv!.id;
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
      } as any).eq("id", convId);
    }
  }
}
