import { NextResponse } from "next/server";

const BASE = process.env.EVOHUB_API_URL || "https://api.evohub.ai";
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
    const { createClient } = await import("@supabase/supabase-js");
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

    if (!msg) return NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 });

    const meta = msg.metadata || {};
    const mediaId = meta.media_id;
    const phoneNumberId = meta.phone_number_id;

    if (!mediaId) return NextResponse.json({ error: "Sem media_id" }, { status: 404 });
    if (!phoneNumberId) return NextResponse.json({ error: "Sem phone_number_id" }, { status: 404 });
    if (!KEY) return NextResponse.json({ error: "API Key não configurada" }, { status: 500 });

    // Buscar channelId pelo mapeamento
    const channelId = CHANNEL_MAP[phoneNumberId];
    if (!channelId) return NextResponse.json({ error: "Canal não mapeado" }, { status: 404 });

    // Buscar token fresco
    const chRes = await fetch(`${BASE}/api/v1/channels/${channelId}`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    const ch = await chRes.json();
    const channelToken = ch?.token;
    if (!channelToken) return NextResponse.json({ error: "Token não encontrado" }, { status: 404 });

    // Resolver mídia - a URL do Meta é temporária, vamos retornar via proxy
    const mediaRes = await fetch(`${BASE}/meta/v23.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${channelToken}` },
    });
    const mediaData = await mediaRes.json();

    if (mediaData.url) {
      // A URL é do lookaside.fbsbx.com reescrita pelo proxy
      return NextResponse.json({ url: mediaData.url, mime_type: mediaData.mime_type });
    }

    // Fallback: tentar a URL direta como último recurso
    return NextResponse.json({ url: `${BASE}/meta/v23.0/${mediaId}`, mime_type: "image/jpeg", proxy: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
