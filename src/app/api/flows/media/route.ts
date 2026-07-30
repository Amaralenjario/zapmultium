import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "flow-media";
const LIMITS: Record<string, number> = { image: 5 * 1024 * 1024, audio: 16 * 1024 * 1024, video: 16 * 1024 * 1024 };
const ALLOWED: Record<string, string[]> = {
  image: ["image/png", "image/jpeg", "image/webp"],
  audio: ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm", "audio/aac", "audio/mp3"],
  video: ["video/mp4", "video/webm", "video/3gpp", "video/quicktime", "video/x-msvideo"],
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const mediaType = (formData.get("type") as string) || "image";

    if (!file) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });

    const maxSize = LIMITS[mediaType] || 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: `Arquivo excede ${Math.round(maxSize / 1024 / 1024)}MB` }, { status: 400 });
    }

    const allowedTypes = ALLOWED[mediaType] || [];
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: `Tipo não permitido: ${file.type}` }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find((b) => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 20 * 1024 * 1024 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "bin";
    const fileName = `flow_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(fileName, buffer, {
      contentType: file.type,
      upsert: true,
    });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(fileName);

    return NextResponse.json({ url: publicUrl.publicUrl, type: mediaType, name: file.name, size: file.size });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
