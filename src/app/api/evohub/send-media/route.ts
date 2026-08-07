import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getInstanceByPhoneId, getRealChannelToken } from "@/lib/instances";
import { friendlyWaError } from "@/lib/wa-errors";

const EVOHUB_API_URL = process.env.EVOHUB_API_URL || "https://api.evohub.ai";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const LABELS: Record<string, string> = {
  image: "📷 Imagem",
  video: "🎬 Vídeo",
  audio: "🎵 Áudio",
  document: "📄 Documento",
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const conversationId = formData.get("conversation_id") as string | null;
    const phoneNumberId = formData.get("phone_number_id") as string | null;
    const customerPhone = formData.get("customer_phone") as string | null;
    const caption = ((formData.get("caption") as string | null) || "").trim();

    if (!file || !conversationId || !phoneNumberId || !customerPhone) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    const instance = getInstanceByPhoneId(phoneNumberId);
    if (!instance?.channelId) return NextResponse.json({ error: "Canal não encontrado" }, { status: 404 });
    const channelToken = await getRealChannelToken(instance.channelId);
    if (!channelToken) return NextResponse.json({ error: "Token do canal não encontrado" }, { status: 404 });

    const mimeType = file.type;
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const supabase = getSupabase();

    // Upload to Supabase Storage
    const ext = file.name.split(".").pop() || "bin";
    const storagePath = `manual/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("flow-media")
      .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: true });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data: urlData } = supabase.storage.from("flow-media").getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    // Determine media type
    let mediaType: "image" | "video" | "audio" | "document";
    if (mimeType.startsWith("image/")) mediaType = "image";
    else if (mimeType.startsWith("video/")) mediaType = "video";
    else if (mimeType.startsWith("audio/")) mediaType = "audio";
    else mediaType = "document";

    let waMsgId: string | null = null;

    // Registra a mídia como FALHA (aparece no chat com o motivo em vermelho)
    const saveFailed = async (reason: string) => {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_type: "agent",
        content: publicUrl,
        content_type: mediaType,
        metadata: { phone_number_id: phoneNumberId, caption: caption || undefined, error: reason, failed: true },
      });
      await supabase.from("conversations").update({
        last_message: caption || LABELS[mediaType] || "📎 Mídia",
        last_message_sender: "agent",
        last_message_read: false,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", conversationId);
    };

    if (mediaType === "audio") {
      // Use audio pipeline
      const { processAndSendMedia } = await import("@/lib/audio-pipeline");
      const result = await processAndSendMedia(publicUrl, "audio", customerPhone, phoneNumberId, channelToken);
      if (result.error) { const friendly = friendlyWaError(result.error); await saveFailed(friendly); return NextResponse.json({ error: friendly }, { status: 500 }); }
      waMsgId = result.waMessageId;
    } else {
      // Send with link for image/video/document
      const msgBody: any = {
        messaging_product: "whatsapp",
        to: customerPhone,
        type: mediaType,
      };

      if (mediaType === "document") {
        msgBody.document = { link: publicUrl, filename: file.name };
        if (caption) msgBody.document.caption = caption;
      } else {
        msgBody[mediaType] = { link: publicUrl };
        // image e video suportam legenda no WhatsApp
        if (caption && (mediaType === "image" || mediaType === "video")) {
          msgBody[mediaType].caption = caption;
        }
      }

      const sendRes = await fetch(`${EVOHUB_API_URL}/meta/v23.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${channelToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(msgBody),
      });

      const sendData = await sendRes.json();
      if (!sendRes.ok) { const friendly = friendlyWaError(sendData); await saveFailed(friendly); return NextResponse.json({ error: friendly }, { status: 500 }); }
      waMsgId = sendData?.messages?.[0]?.id || null;
    }

    // Save message to DB
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_type: "agent",
      content: publicUrl,
      content_type: mediaType,
      metadata: { wa_message_id: waMsgId, phone_number_id: phoneNumberId, caption: caption || undefined },
    });

    await supabase
      .from("conversations")
      .update({
        last_message: caption || LABELS[mediaType] || "📎 Mídia",
        last_message_sender: "agent",
        last_message_read: false,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        unread_count: 0,
      })
      .eq("id", conversationId);

    return NextResponse.json({ ok: true, messageId: waMsgId, url: publicUrl, type: mediaType });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
