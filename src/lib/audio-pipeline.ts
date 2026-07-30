// Audio Pipeline Completo
// [1] Transloadit (OPCIONAL) → OGG Opus
// [2] Mirror Supabase Storage
// [3] Upload Meta Media API (PREFERENCIAL)
// [4] Envio via EvoHub (com media_id ou fallback link)

const EVOHUB_API_URL = process.env.EVOHUB_API_URL || "https://api.evohub.ai";
const TRANSLOADIT_KEY = process.env.TRANSLOADIT_AUTH_KEY;
const TRANSLOADIT_SECRET = process.env.TRANSLOADIT_AUTH_SECRET;

// ─── [1] Transloadit: converte para OGG Opus ───
async function convertToOggOpus(audioUrl: string): Promise<string | null> {
  if (!TRANSLOADIT_KEY || !TRANSLOADIT_SECRET) return null;

  const isOgg = audioUrl.includes(".ogg") || audioUrl.includes(".opus");
  if (isOgg) return audioUrl;

  try {
    const res = await fetch("https://api2.transloadit.com/assemblies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${TRANSLOADIT_KEY}:${TRANSLOADIT_SECRET}`).toString("base64")}`,
      },
      body: JSON.stringify({
        params: {
          steps: {
            encode: {
              robot: "/audio/encode",
              use: ":original",
              preset: "opus",
              ffmpeg_stack: "v6.0.0",
              ffmpeg: { ac: 1, ar: 32000, b: "32k" },
            },
          },
        },
        files: [{ url: audioUrl }],
      }),
    });

    const data = await res.json();
    if (!data.ok || !data.assembly_id) return null;

    // Poll até completar
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const pollRes = await fetch(`https://api2.transloadit.com/assemblies/${data.assembly_id}`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${TRANSLOADIT_KEY}:${TRANSLOADIT_SECRET}`).toString("base64")}`,
        },
      });
      const poll = await pollRes.json();
      if (poll.ok === "COMPLETED") {
        const result = poll.results?.encode?.[0];
        return result?.ssl_url || result?.url || null;
      }
      if (poll.ok === "ABORTED" || poll.ok === "FAILED") return null;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── [2] Mirror Supabase Storage ───
async function mirrorToStorage(fileUrl: string, prefix: string): Promise<string> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const BUCKET = "wa-media";
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find((b) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 20 * 1024 * 1024 });
  }

  try {
    const dl = await fetch(fileUrl);
    if (!dl.ok) return fileUrl;
    const buffer = Buffer.from(await dl.arrayBuffer());
    const ext = fileUrl.includes(".ogg") || fileUrl.includes(".opus") ? ".ogg" : ".mp3";
    const fileName = `${prefix}_${Date.now()}${ext}`;
    const contentType = ext === ".ogg" ? "audio/ogg" : "audio/mpeg";

    const { error } = await supabase.storage.from(BUCKET).upload(fileName, buffer, { contentType, upsert: true });
    if (error) return fileUrl;

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    return pub.publicUrl;
  } catch {
    return fileUrl;
  }
}

// ─── [3] Upload Meta Media API via EvoHub proxy ───
async function uploadToMeta(fileUrl: string, phoneNumberId: string, token: string): Promise<string | null> {
  try {
    // Tenta via EvoHub primeiro (traduz o token pra Meta)
    const res = await fetch(`${EVOHUB_API_URL}/meta/v23.0/${phoneNumberId}/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        file: fileUrl,
        type: "audio/ogg",
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.id) return data.id;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── [4] Envio via EvoHub ───
async function sendViaEvoHub(
  to: string,
  phoneNumberId: string,
  token: string,
  mediaId: string | null,
  fallbackUrl: string,
  isOgg: boolean
) {
  const body: any = {
    messaging_product: "whatsapp",
    to,
    type: "audio",
  };

  if (mediaId) {
    body.audio = { id: mediaId };
    if (isOgg) body.audio.voice = true;
  } else {
    body.audio = { link: fallbackUrl };
    if (isOgg) body.audio.voice = true;
  }

  const res = await fetch(`${EVOHUB_API_URL}/meta/v23.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

// ─── Pipeline principal ───
export async function processAndSendMedia(
  fileUrl: string,
  mediaType: "image" | "audio" | "video",
  to: string,
  phoneNumberId: string,
  channelToken: string
): Promise<{ waMessageId: string | null; error?: string }> {
  try {
    // Image/Video: link direto funciona
    if (mediaType !== "audio") {
      const body: any = {
        messaging_product: "whatsapp",
        to,
        type: mediaType === "video" ? "video" : mediaType,
        [mediaType]: { link: fileUrl },
      };
      const res = await fetch(`${EVOHUB_API_URL}/meta/v23.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${channelToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));
      return { waMessageId: data.messages?.[0]?.id || null };
    }

    // ─── Audio Pipeline ───
    let finalUrl = fileUrl;
    let isOgg = finalUrl.includes(".ogg") || finalUrl.includes(".opus");

    // [1] Transloadit (OPCIONAL)
    const oggUrl = await convertToOggOpus(finalUrl);
    if (oggUrl && oggUrl !== finalUrl) {
      finalUrl = oggUrl;
      isOgg = true;
    }

    // [2] Mirror Supabase Storage
    finalUrl = await mirrorToStorage(finalUrl, "audio");

    // [3] Upload Meta Media API (PREFERENCIAL)
    const mediaId = await uploadToMeta(finalUrl, phoneNumberId, channelToken);

    // [4] Envio via EvoHub
    const result = await sendViaEvoHub(to, phoneNumberId, channelToken, mediaId, finalUrl, isOgg);
    return { waMessageId: result.messages?.[0]?.id || null };
  } catch (err: any) {
    return { waMessageId: null, error: err.message };
  }
}
