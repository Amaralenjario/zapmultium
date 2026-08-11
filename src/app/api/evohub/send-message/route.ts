import { NextResponse } from "next/server";
import { getRealChannelToken } from "@/lib/instances";
import { friendlyWaError } from "@/lib/wa-errors";

const BASE = process.env.EVOHUB_API_URL || "https://api.evohub.ai";
const KEY = process.env.EVOHUB_API_KEY;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { conversationId, phoneNumberId, to, message, context, type, caption } = body;

    if (!phoneNumberId || !to || !message) {
      return NextResponse.json({ error: "Dados incompletos", detail: { hasPhoneId: !!phoneNumberId, hasTo: !!to, hasMessage: !!message, phoneLen: (phoneNumberId || "").length, toLen: (to || "").length, msgLen: (message || "").length } }, { status: 400 });
    }

    // Buscar channel token real da EvoHub
    let channelToken = "";

    // Resolve o canal pelo mapa fixo OU pelo banco (operations_channels) — números novos incluídos.
    const { resolveChannelId } = await import("@/lib/instances");
    const channelId = await resolveChannelId(phoneNumberId);

    if (channelId) {
      const realToken = await getRealChannelToken(channelId);
      channelToken = realToken || "";
    }

    if (!channelToken) {
      return NextResponse.json({ error: "Canal não encontrado" }, { status: 404 });
    }

    const msgType = type || "text";
    let msgBody: any;

    if (msgType === "sticker") {
      msgBody = { messaging_product: "whatsapp", to, type: "sticker", sticker: { link: message } };
    } else if (msgType === "image") {
      msgBody = { messaging_product: "whatsapp", to, type: "image", image: { link: message } };
      if (caption) msgBody.image.caption = caption;
    } else if (msgType === "video") {
      msgBody = { messaging_product: "whatsapp", to, type: "video", video: { link: message } };
    } else {
      msgBody = {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      };
    }
    if (context) msgBody.context = { message_id: context };

    const res = await fetch(`${BASE}/meta/v23.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${channelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(msgBody),
    });

    const data = await res.json();

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const contentType = msgType === "sticker" ? "sticker" : (msgType === "text" ? "text" : (msgType === "video" ? "video" : "image"));

    if (!res.ok) {
      const friendly = friendlyWaError(data);
      // Registra a mensagem como FALHA para aparecer no chat com o motivo em vermelho
      if (conversationId) {
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          sender_type: "agent",
          content: message,
          content_type: contentType,
          metadata: { phone_number_id: phoneNumberId, error: friendly, failed: true, wa_error_code: data?.error?.code },
        });
        await supabase.from("conversations").update({
          last_message: msgType === "text" ? message : "📎 Mídia",
          last_message_sender: "agent",
          last_message_read: false,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", conversationId);
      }
      return NextResponse.json({ error: friendly }, { status: res.status });
    }

    const mediaLabels: Record<string, string> = {
      image: "📷 Imagem",
      video: "🎬 Vídeo",
      text: message,
    };

    if (conversationId) {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_type: "agent",
        content: message,
        content_type: msgType === "sticker" ? "sticker" : (msgType === "text" ? "text" : (msgType === "video" ? "video" : "image")),
        metadata: { wa_message_id: data.messages?.[0]?.id, phone_number_id: phoneNumberId, context: context ? { id: context } : undefined },
      });

      await supabase
        .from("conversations")
        .update({
          last_message: mediaLabels[msgType] || message,
          last_message_sender: "agent",
          last_message_read: false,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          unread_count: 0,
        })
        .eq("id", conversationId);
    }

    return NextResponse.json({ ok: true, messageId: data.messages?.[0]?.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
