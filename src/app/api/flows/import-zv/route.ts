import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { importZapVoiceJSON } from "@/lib/zv-import";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const { data: base64 } = await request.json();

    let buffer: ArrayBuffer;

    if (base64) {
      // Decode base64
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      buffer = bytes.buffer;
    } else {
      return NextResponse.json({ error: "Dados não enviados" }, { status: 400 });
    }

    const result = await importZapVoiceJSON(buffer, user.id);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
