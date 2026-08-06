import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { importZapVoiceJSON } from "@/lib/zv-import";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const { path } = await request.json();
    if (!path) return NextResponse.json({ error: "path não enviado" }, { status: 400 });

    // Download file from Supabase Storage
    const { data: fileData, error: downloadErr } = await supabase.storage.from("flow-media").download(path);
    if (downloadErr || !fileData) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });

    const buffer = await fileData.arrayBuffer();
    const result = await importZapVoiceJSON(buffer, user.id);

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
