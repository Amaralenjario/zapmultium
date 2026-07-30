import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(_: Request, { params }: { params: { messageId: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: msg } = await supabase
    .from("messages")
    .select("metadata, conversation_id")
    .eq("id", params.messageId)
    .single();

  if (!msg?.metadata?.wa_message_id && !msg?.metadata?.media_id) {
    return NextResponse.json({ error: "Mídia não encontrada" }, { status: 404 });
  }

  const mediaId = msg.metadata.media_id || msg.metadata.wa_message_id;
  const phoneNumberId = msg.metadata.phone_number_id;

  if (!phoneNumberId) {
    return NextResponse.json({ error: "Phone ID não encontrado" }, { status: 404 });
  }

  // Buscar channel token via operations_channels ou EvoHub
  const KEY = process.env.EVOHUB_API_KEY;
  const BASE = process.env.EVOHUB_API_URL || "https://api.evohub.ai";

  // Pegar o channel token do canal associado
  const { data: opCh } = await supabase
    .from("operations_channels")
    .select("evohub_channel_id")
    .eq("phone_number_id", phoneNumberId)
    .single();

  let channelToken = "";
  if (opCh?.evohub_channel_id) {
    const res = await fetch(`${BASE}/api/v1/channels/${opCh.evohub_channel_id}`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    const ch = await res.json();
    channelToken = ch?.token || "";
  }

  if (!channelToken) {
    return NextResponse.json({ error: "Token não encontrado" }, { status: 404 });
  }

  // Resolver mídia via proxy
  const mediaRes = await fetch(`${BASE}/meta/v23.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${channelToken}` },
  });
  const mediaData = await mediaRes.json();

  if (mediaData.url) {
    return NextResponse.json({ url: mediaData.url, mime_type: mediaData.mime_type });
  }

  return NextResponse.json({ error: "URL não resolvida" }, { status: 404 });
}
