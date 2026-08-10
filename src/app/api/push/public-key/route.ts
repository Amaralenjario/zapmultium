import { NextResponse } from "next/server";

// Devolve a chave pública VAPID em runtime (o cliente usa pra se inscrever).
// Assim não depende de env NEXT_PUBLIC_ embutido no build.
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY || "";
  return NextResponse.json({ key, enabled: !!key });
}
