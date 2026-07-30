import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "flow-media";
const LIMITS: Record<string, number> = { image: 5 * 1024 * 1024, audio: 16 * 1024 * 1024, video: 16 * 1024 * 1024 };
const ALLOWED: Record<string, string[]> = {
  image: ["image/png", "image/jpeg", "image/webp"],
  audio: ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm", "audio/aac", "audio/mp3"],
  video: ["video/mp4", "video/webm", "video/3gpp", "video/quicktime", "video/x-msvideo"],
};

const TRANSLOADIT_KEY = process.env.TRANSLOADIT_AUTH_KEY;
const TRANSLOADIT_SECRET = process.env.TRANSLOADIT_AUTH_SECRET;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  return createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function uploadToStorage(buffer: Buffer, fileName: string, contentType: string) {
  const supabase = getSupabase();
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find((b) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 20 * 1024 * 1024 });
  }
  const { error } = await supabase.storage.from(BUCKET).upload(fileName, buffer, { contentType, upsert: true });
  if (error) throw error;
  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return publicUrl.publicUrl;
}

// ─── Transloadit: converte áudio para OGG Opus no upload ───
async function convertAudioToOgg(audioUrl: string): Promise<string | null> {
  if (!TRANSLOADIT_KEY || !TRANSLOADIT_SECRET) return null;

  const isOgg = audioUrl.endsWith(".ogg") || audioUrl.endsWith(".opus") || audioUrl.includes(".ogg?") || audioUrl.includes(".opus?");
  if (isOgg) return null; // já é OGG

  const assembly = {
    steps: {
      encode: {
        robot: "/audio/encode",
        use: ":original",
        preset: "opus",
        ffmpeg_stack: "v6.0.0",
        ffmpeg: { ac: 1, ar: 32000, b: "32k" },
      },
    },
  };

  const res = await fetch("https://api2.transloadit.com/assemblies", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Transloadit-Client": "zapmultium/1.0" },
    body: JSON.stringify({
      auth: { key: TRANSLOADIT_KEY, expires: new Date(Date.now() + 3600000).toISOString() },
      steps: assembly.steps,
      files: { imported: [{ url: audioUrl }] },
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.ok) return null;

  // Poll for result
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(`https://api2.transloadit.com/assemblies/${data.assembly_id}`, {
      headers: { "Transloadit-Client": "zapmultium/1.0" },
    });
    const pollData = await pollRes.json();
    if (pollData.ok === "COMPLETED") {
      return pollData.results?.encode?.[0]?.ssl_url || pollData.results?.encode?.[0]?.url || null;
    }
    if (pollData.error || pollData.ok === "ABORTED" || pollData.ok === "FAILED") return null;
  }
  return null;
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "bin";
    const fileName = `flow_${Date.now()}.${ext}`;

    // Upload original to storage
    const originalUrl = await uploadToStorage(buffer, fileName, file.type);

    let finalUrl = originalUrl;

    // Convert audio to OGG Opus on upload (not during flow execution)
    if (mediaType === "audio" && TRANSLOADIT_KEY) {
      const oggUrl = await convertAudioToOgg(originalUrl);
      if (oggUrl) {
        // Download OGG and re-upload to our storage
        const oggRes = await fetch(oggUrl);
        if (oggRes.ok) {
          const oggBuffer = Buffer.from(await oggRes.arrayBuffer());
          finalUrl = await uploadToStorage(oggBuffer, `flow_${Date.now()}.ogg`, "audio/ogg");
        }
      }
    }

    return NextResponse.json({ url: finalUrl, type: mediaType, name: file.name, size: file.size });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
