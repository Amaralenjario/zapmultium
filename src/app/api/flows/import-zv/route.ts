import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { importZapVoiceJSON } from "@/lib/zv-import";

export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const { path } = await request.json();
    if (!path) return NextResponse.json({ error: "path não enviado" }, { status: 400 });

    // Download do Supabase Storage usando service role
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: fileData, error: downloadErr } = await adminClient.storage.from("flow-media").download(path);
    if (downloadErr || !fileData) return NextResponse.json({ error: "Arquivo não encontrado: " + (downloadErr?.message || ""), path }, { status: 404 });

    const buffer = await fileData.arrayBuffer();
    const result = await importZapVoiceJSON(buffer, user.id);

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
