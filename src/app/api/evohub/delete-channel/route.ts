import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
  const { channelId } = await request.json();
  if (!channelId) return NextResponse.json({ error: "channelId obrigatório" }, { status: 400 });

  const KEY = process.env.EVOHUB_API_KEY;
  const BASE = process.env.EVOHUB_API_URL || "https://api.evohub.ai";

  const res = await fetch(`${BASE}/api/v1/channels/${channelId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${KEY}` },
  });

  if (!res.ok) {
    const data = await res.json();
    return NextResponse.json({ error: data }, { status: res.status });
  }

  return NextResponse.json({ ok: true });
}
