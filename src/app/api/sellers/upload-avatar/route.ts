import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;

    if (!file || !userId) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    // Upload pro bucket "avatars"
    const fileName = `${userId}-${Date.now()}.${file.name.split(".").pop()}`;

    const { error } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, { upsert: true, contentType: file.type });

    if (error) {
      // Se o bucket não existir, usar URL direta (base64 embed)
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      const dataUrl = `data:${file.type};base64,${base64}`;

      await supabase.from("profiles").update({ avatar_url: dataUrl }).eq("id", userId);
      return NextResponse.json({ url: dataUrl });
    }

    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(fileName);
    await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", userId);

    return NextResponse.json({ url: pub.publicUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
