import { NextResponse } from "next/server";

export async function GET() {
  const KEY = process.env.EVOHUB_API_KEY;
  const BASE = process.env.EVOHUB_API_URL || "https://api.evohub.ai";
  if (!KEY) return NextResponse.json([]);

  const res = await fetch(`${BASE}/api/v1/channels`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  const data = await res.json();
  return NextResponse.json(data.channels || []);
}
