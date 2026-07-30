import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "stickers";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  const supabase = getSupabase();
  const { data } = await supabase.from("stickers").select("*").order("created_at", { ascending: false }).limit(100);
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = (formData.get("name") as string) || "sticker";

    if (!file) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Apenas imagens" }, { status: 400 });
    if (file.size > 1024 * 1024) return NextResponse.json({ error: "Máximo 1MB" }, { status: 400 });

    const supabase = getSupabase();

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find((b) => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 1048576, allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"] });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(fileName, buffer, { contentType: file.type, upsert: true });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(fileName);

    const { data: sticker, error: dbError } = await supabase
      .from("stickers")
      .insert({ url: publicUrl.publicUrl, name })
      .select("*")
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json(sticker, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
