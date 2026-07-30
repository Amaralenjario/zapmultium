import { NextResponse } from "next/server";
import { getRealChannelToken } from "@/lib/instances";

const BASE = process.env.EVOHUB_API_URL || "https://api.evohub.ai";
const KEY = process.env.EVOHUB_API_KEY;

export async function POST(request: Request) {
  try {
    const { conversationId, phoneNumberId, to, message, context } = await request.json();

    if (!phoneNumberId || !to || !message) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    // Buscar channel token real da EvoHub
    let channelToken = "";

    // Primeiro tenta pegar via mapeamento de instâncias
    const { getInstanceByPhoneId } = await import("@/lib/instances");
    const instance = getInstanceByPhoneId(phoneNumberId);

    if (instance?.channelId) {
      const realToken = await getRealChannelToken(instance.channelId);
      channelToken = realToken || "";
    }

    if (!channelToken) {
      return NextResponse.json({ error: "Canal não encontrado" }, { status: 404 });
    }

    const msgBody: any = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message },
    };
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

    if (!res.ok) {
      return NextResponse.json({ error: data }, { status: res.status });
    }

    // Salvar mensagem enviada no banco
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    if (conversationId) {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_type: "agent",
        content: message,
        content_type: "text",
        metadata: { wa_message_id: data.messages?.[0]?.id, phone_number_id: phoneNumberId },
      });

      await supabase
        .from("conversations")
        .update({
          last_message: message,
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
