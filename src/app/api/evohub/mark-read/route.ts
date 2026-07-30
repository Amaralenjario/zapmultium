import { NextResponse } from "next/server";

const BASE = process.env.EVOHUB_API_URL || "https://api.evohub.ai";
const KEY = process.env.EVOHUB_API_KEY;

const KNOWN_PHONES: Record<string, { channelId: string }> = {
  "897878513398151": { channelId: "5145a0c0-a358-43e5-8269-c5ace26ca023" },
  "976034132269824": { channelId: "effa72d1-47f6-445b-acbc-7693ef21ee24" },
  "892228177298374": { channelId: "c5505ddf-f9ef-4837-9337-45ed3de40d6a" },
  "1034222499765101": { channelId: "346e4eef-bc78-41ec-a7ae-ec7ec75bf177" },
  "1234821229708132": { channelId: "b1c6879b-e962-4f50-95f7-14f1a04601a5" },
};

export async function POST(request: Request) {
  try {
    const { phoneNumberId, messageId } = await request.json();
    if (!phoneNumberId || !messageId || !KEY) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    // Buscar channelId via mapeamento fixo
    const mapped = KNOWN_PHONES[phoneNumberId];
    if (!mapped?.channelId) {
      return NextResponse.json({ error: "Canal não mapeado para " + phoneNumberId }, { status: 404 });
    }

    // Buscar channel token fresco da EvoHub
    const chRes = await fetch(`${BASE}/api/v1/channels/${mapped.channelId}`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    const ch = await chRes.json();
    const channelToken = ch?.token;

    if (!channelToken) {
      return NextResponse.json({ error: "Token não encontrado" }, { status: 404 });
    }

    // Enviar read receipt via Meta
    const metaRes = await fetch(`${BASE}/meta/v23.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${channelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });

    const metaData = await metaRes.json();
    return NextResponse.json({ ok: true, meta: metaData });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
