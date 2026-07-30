// Audio Pipeline - upload Meta → media_id → audio nativo

const EVOHUB_API_URL = process.env.EVOHUB_API_URL || "https://api.evohub.ai";
const EVOHUB_API_KEY = process.env.EVOHUB_API_KEY;

// Get Meta token: try stored in DB, fallback to EvoHub API
async function getMetaToken(phoneNumberId: string): Promise<string | null> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 1) Check stored token
  const { data } = await supabase
    .from("operations_channels")
    .select("meta_token, evohub_channel_id")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();

  if (data?.meta_token) return data.meta_token;

  // 2) Fetch from EvoHub and store for next time
  if (data?.evohub_channel_id && EVOHUB_API_KEY) {
    try {
      const res = await fetch(`${EVOHUB_API_URL}/api/v1/channels/${data.evohub_channel_id}`, {
        headers: { Authorization: `Bearer ${EVOHUB_API_KEY}` },
      });
      const ch = await res.json();
      const token = ch?.token || null;
      if (token) {
        await supabase.from("operations_channels").update({ meta_token: token }).eq("phone_number_id", phoneNumberId);
        return token;
      }
    } catch {}
  }

  return null;
}

export async function processAndSendMedia(
  fileUrl: string,
  mediaType: "image" | "audio" | "video",
  to: string,
  phoneNumberId: string,
  channelToken: string
): Promise<{ waMessageId: string | null; error?: string }> {
  try {
    if (mediaType !== "audio") {
      const body: any = { messaging_product: "whatsapp", to, type: mediaType === "video" ? "video" : mediaType, [mediaType]: { link: fileUrl } };
      const res = await fetch(`${EVOHUB_API_URL}/meta/${phoneNumberId}/messages`, {
        method: "POST", headers: { Authorization: `Bearer ${channelToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      const wamid = data?.messages?.[0]?.id;
      if (wamid) return { waMessageId: wamid };
      if (!res.ok) throw new Error(JSON.stringify(data));
      return { waMessageId: wamid };
    }

    // ─── Audio: get Meta token → upload Meta → media_id → audio nativo ───
    const dl = await fetch(fileUrl);
    if (!dl.ok) throw new Error(`Download: ${dl.status}`);
    const buffer = Buffer.from(await dl.arrayBuffer());
    const contentType = dl.headers.get("content-type") || "audio/ogg";
    const isOgg = contentType.includes("ogg") || contentType.includes("opus");

    const metaToken = await getMetaToken(phoneNumberId);
    if (metaToken) {
      // Upload to Meta with real token
      const form = new FormData();
      form.append("file", new Blob([buffer], { type: contentType }), "audio.ogg");
      form.append("type", contentType);
      form.append("messaging_product", "whatsapp");

      const uploadRes = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/media`, {
        method: "POST", headers: { Authorization: `Bearer ${metaToken}` }, body: form,
      });
      const uploadData = await uploadRes.json();
      if (uploadRes.ok && uploadData.id) {
        const sendBody = { type: "audio", audio: { id: uploadData.id, voice: isOgg || undefined } };
        const sendRes = await fetch(`${EVOHUB_API_URL}/meta/${phoneNumberId}/messages`, {
          method: "POST", headers: { Authorization: `Bearer ${channelToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", to, ...sendBody }),
        });
        const sendData = await sendRes.json();
        const wamid = sendData?.messages?.[0]?.id;
        if (wamid) return { waMessageId: wamid };
      }
    }

    // Fallback: document
    const fallbackBody = { messaging_product: "whatsapp", to, type: "document", document: { link: fileUrl, filename: "audio.mp3" } };
    const fallbackRes = await fetch(`${EVOHUB_API_URL}/meta/${phoneNumberId}/messages`, {
      method: "POST", headers: { Authorization: `Bearer ${channelToken}`, "Content-Type": "application/json" }, body: JSON.stringify(fallbackBody),
    });
    const fallbackData = await fallbackRes.json();
    const wamid = fallbackData?.messages?.[0]?.id;
    if (wamid) return { waMessageId: wamid };
    throw new Error(JSON.stringify(fallbackData));
  } catch (err: any) {
    return { waMessageId: null, error: err.message };
  }
}
