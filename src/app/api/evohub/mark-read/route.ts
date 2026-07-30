import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.EVOHUB_API_URL || "https://api.evohub.ai";
const KEY = process.env.EVOHUB_API_KEY;

export async function POST(request: Request) {
  try {
    const { phoneNumberId, messageId } = await request.json();
    if (!phoneNumberId || !messageId) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    // Buscar channel token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

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

    // Enviar read receipt via Meta Graph API
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
