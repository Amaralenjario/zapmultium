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

// Save a sticker FROM a lead message (download from Meta → upload to our bucket → create DB record)
export async function POST(request: Request) {
  try {
    const { messageId } = await request.json();
    if (!messageId) return NextResponse.json({ error: "messageId obrigatório" }, { status: 400 });

    // Get the message to find the media URL
    const supabase = getSupabase();
    const { data: msg } = await supabase.from("messages").select("metadata, content_type").eq("id", messageId).single();
    if (!msg || msg.content_type !== "sticker") {
      return NextResponse.json({ error: "Mensagem não é uma figurinha" }, { status: 400 });
    }

    const mediaUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/media-proxy`;
    const phoneNumberId = msg.metadata?.phone_number_id;
    const mediaId = msg.metadata?.media_id || msg.metadata?.wa_message_id;

    if (!phoneNumberId || !mediaId) {
      return NextResponse.json({ error: "Dados da figurinha incompletos" }, { status: 400 });
    }

    // Download from Meta via send-message API-like approach
    // Actually, fetch from our existing media proxy
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/media/${messageId}`);
    if (!res.ok) return NextResponse.json({ error: "Falha ao baixar figurinha" }, { status: 500 });

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get("content-type") || "image/webp";

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find((b) => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 1048576, allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"] });
    }

    const fileName = `saved_${Date.now()}.webp`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(fileName, buffer, { contentType, upsert: true });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(fileName);

    const { data: sticker, error: dbError } = await supabase
      .from("stickers")
      .insert({ url: publicUrl.publicUrl, name: `Figurinha salva` })
      .select("*")
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json(sticker, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
