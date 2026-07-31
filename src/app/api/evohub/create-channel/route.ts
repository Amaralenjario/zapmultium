import { NextResponse } from "next/server";

const BASE = process.env.EVOHUB_API_URL || "https://api.evohub.ai";
const KEY = process.env.EVOHUB_API_KEY;

export async function POST(request: Request) {
  try {
    const { name } = await request.json();

    if (!name) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    if (!KEY) {
      return NextResponse.json({ error: "EVOHUB_API_KEY não configurada no servidor" }, { status: 500 });
    }

    const res = await fetch(`${BASE}/api/v1/channels`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, type: "whatsapp" }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("EvoHub create channel error:", res.status, JSON.stringify(data));
      return NextResponse.json({ error: data?.message || data?.error || JSON.stringify(data) || "Erro ao criar canal" }, { status: res.status });
    }

    return NextResponse.json({
      id: data.id,
      name: data.name,
      token: data.token,
      status: data.status,
      type: data.type,
      connectUrl: `https://app.evohub.evolutionfoundation.com.br/connect/${data.token}`,
    });
  } catch (e: any) {
    console.error("Create channel exception:", e?.message || e);
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500 });
  }
}
