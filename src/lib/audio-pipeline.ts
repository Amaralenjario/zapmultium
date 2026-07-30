import { createClient } from "@supabase/supabase-js";

const BUCKET = "wa-media";
const TRANSLOADIT_KEY = process.env.TRANSLOADIT_AUTH_KEY;
const TRANSLOADIT_SECRET = process.env.TRANSLOADIT_AUTH_SECRET;
const EVOHUB_API_URL = process.env.EVOHUB_API_URL || "https://api.evohub.ai";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// ─── Camada 1: Transloadit (converte para OGG Opus) ───
async function convertToOggOpus(audioUrl: string): Promise<string> {
  if (!TRANSLOADIT_KEY || !TRANSLOADIT_SECRET) {
    console.log("Transloadit: sem credenciais, pulando");
    return audioUrl;
  }

  const isOgg = audioUrl.endsWith(".ogg") || audioUrl.endsWith(".opus") || audioUrl.includes(".ogg") || audioUrl.includes(".opus");
  if (isOgg) {
    console.log("Transloadit: já é OGG/Opus, mantendo URL original");
    return audioUrl;
  }

  console.log("Transloadit: convertendo", audioUrl);
  const assembly = {
    steps: {
      encode: {
        robot: "/audio/encode",
        use: ":original",
        preset: "opus",
        ffmpeg_stack: "v6.0.0",
        ffmpeg: {
          ac: 1,
          ar: 32000,
          b: "32k",
        },
      },
    },
  };

  const res = await fetch("https://api2.transloadit.com/assemblies", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Transloadit-Client": "zapmultium/1.0",
    },
    body: JSON.stringify({
      auth: { key: TRANSLOADIT_KEY, expires: new Date(Date.now() + 3600000).toISOString() },
      template_id: undefined,
      steps: assembly.steps,
      notify_url: null,
      files: { imported: [{ url: audioUrl }] },
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    console.error("Transloadit error:", data);
    return audioUrl;
  }

  const assemblyId = data.assembly_id;
  const resultUrl = await waitForTransloadit(assemblyId);
  return resultUrl || audioUrl;
}

async function waitForTransloadit(assemblyId: string): Promise<string | null> {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`https://api2.transloadit.com/assemblies/${assemblyId}`, {
      headers: { "Transloadit-Client": "zapmultium/1.0" },
    });
    const data = await res.json();
    if (data.ok && data.ok !== "REQUESTING" && data.ok !== "ASSEMBLING" && data.ok !== "EXECUTING") {
      if (data.ok === "COMPLETED" && data.results?.encode?.[0]?.url) {
        return data.results.encode[0].url;
      }
      if (data.ok === "COMPLETED" && data.results?.encode?.[0]?.ssl_url) {
        return data.results.encode[0].ssl_url;
      }
      return null;
    }
    if (data.error) {
      console.error("Transloadit assembly error:", data.error);
      return null;
    }
  }
  console.error("Transloadit timeout");
  return null;
}

// ─── Camada 2: Espelhamento no Supabase Storage ───
async function mirrorToSupabase(fileUrl: string, prefix: string): Promise<string> {
  const supabase = getSupabase();

  // Ensure bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find((b) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 20 * 1024 * 1024 });
  }

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Mirror download failed: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = fileUrl.includes(".ogg") || fileUrl.includes(".opus") ? ".ogg" : ".mp3";
    const fileName = `${prefix}_${Date.now()}${ext}`;
    const contentType = ext === ".ogg" ? "audio/ogg" : "audio/mpeg";

    const { error } = await supabase.storage.from(BUCKET).upload(fileName, buffer, { contentType, upsert: true });
    if (error) throw error;

    const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    console.log("Mirrored to Supabase:", publicUrl.publicUrl);
    return publicUrl.publicUrl;
  } catch (err) {
    console.error("Mirror failed:", err);
    return fileUrl;
  }
}

// ─── Camada 3: Upload direto na Meta Media API ───
async function uploadToMetaMedia(mirroredUrl: string, channelToken: string, phoneNumberId: string): Promise<string | null> {
  try {
    console.log("Uploading to Meta Media API:", mirroredUrl);
    const response = await fetch(mirroredUrl);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "audio/ogg";

    const formData = new FormData();
    formData.append("file", new Blob([buffer], { type: contentType }), "audio.ogg");
    formData.append("messaging_product", "whatsapp");
    formData.append("type", contentType);

    const uploadRes = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${channelToken}` },
      body: formData,
    });

    const data = await uploadRes.json();
    if (!uploadRes.ok) {
      console.error("Meta media upload failed:", data);
      return null;
    }

    console.log("Meta media_id:", data.id);
    return data.id;
  } catch (err) {
    console.error("Meta upload error:", err);
    return null;
  }
}

// ─── Camada 4: Envio da mensagem via EvoHub ───
async function sendViaEvoHub(
  to: string,
  phoneNumberId: string,
  channelToken: string,
  mediaId: string | null,
  fallbackUrl: string,
  mediaType: "image" | "audio" | "video"
) {
  const body: any = {
    messaging_product: "whatsapp",
    to,
    type: mediaType === "video" ? "video" : mediaType,
  };

  if (mediaId) {
    body[mediaType] = { id: mediaId };
  } else {
    body[mediaType] = { link: fallbackUrl };
  }

  console.log("Sending via EvoHub:", JSON.stringify(body).slice(0, 200));
  const res = await fetch(`${EVOHUB_API_URL}/meta/v23.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelToken}`,
      "Content-Type": "application/json",
    },
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
    let finalUrl = fileUrl;

    // Camada 1: Transloadit (apenas áudio) → OGG Opus
    if (mediaType === "audio") {
      finalUrl = await convertToOggOpus(finalUrl);
    }

    // Camada 2: Espelhamento no Supabase Storage (URL pública garantida)
    finalUrl = await mirrorToSupabase(finalUrl, mediaType);

    // Camada 3: Envio via EvoHub com link (comprovado que funciona)
    const body: any = {
      messaging_product: "whatsapp",
      to,
      type: mediaType === "video" ? "video" : mediaType,
    };
    body[mediaType] = { link: finalUrl };

    console.log("Sending media via EvoHub:", mediaType, finalUrl.slice(0, 80));
    const res = await fetch(`${EVOHUB_API_URL}/meta/v23.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${channelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));

    return { waMessageId: data.messages?.[0]?.id || null };
  } catch (err: any) {
    console.error("Pipeline error:", err);
    return { waMessageId: null, error: err.message };
  }
}
