import { NextResponse } from "next/server";

const BASE = "https://api.evohub.ai";
const KEY = process.env.EVOHUB_API_KEY;

const CHANNEL_MAP: Record<string, string> = {
  "897878513398151": "5145a0c0-a358-43e5-8269-c5ace26ca023",
  "976034132269824": "effa72d1-47f6-445b-acbc-7693ef21ee24",
  "892228177298374": "c5505ddf-f9ef-4837-9337-45ed3de40d6a",
  "1034222499765101": "346e4eef-bc78-41ec-a7ae-ec7ec75bf177",
  "1234821229708132": "b1c6879b-e962-4f50-95f7-14f1a04601a5",
};

export async function GET(_: Request, { params }: { params: { messageId: string } }) {
  try {
    if (!KEY) return new Response("API Key not configured", { status: 500 });

    // Buscar metadados da mensagem
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: msg } = await supabase
      .from("messages")
      .select("metadata")
      .eq("id", params.messageId)
      .single();

    if (!msg?.metadata) return new Response("Not found", { status: 404 });

    const meta = msg.metadata;
    const mediaId = meta.media_id;
    const phoneNumberId = meta.phone_number_id;

    if (!mediaId || !phoneNumberId) return new Response("No media", { status: 404 });

    const channelId = CHANNEL_MAP[phoneNumberId];
    if (!channelId) return new Response("Channel not mapped", { status: 404 });

    // Buscar token
    const chRes = await fetch(`${BASE}/api/v1/channels/${channelId}`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    const ch = await chRes.json();
    const channelToken = ch?.token;
    if (!channelToken) return new Response("No token", { status: 404 });

    // Resolver media_id via proxy Meta
    const mediaRes = await fetch(`${BASE}/meta/v23.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${channelToken}` },
    });
    const mediaData = await mediaRes.json();

    if (!mediaData.url) return new Response("No URL", { status: 404 });

    // Baixar o binário da mídia
    const binaryRes = await fetch(mediaData.url, {
      headers: { Authorization: `Bearer ${channelToken}` },
    });

    if (!binaryRes.ok) return new Response("Download failed", { status: 500 });

    const buffer = await binaryRes.arrayBuffer();
    const contentType = binaryRes.headers.get("content-type") || mediaData.mime_type || "application/octet-stream";

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e: any) {
    return new Response(e.message, { status: 500 });
  }
}
