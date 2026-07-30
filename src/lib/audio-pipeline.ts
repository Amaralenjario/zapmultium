// Audio Pipeline - upload via EvoHub media endpoint

const EVOHUB_API_URL = process.env.EVOHUB_API_URL || "https://api.evohub.ai";
const EVOHUB_API_KEY = process.env.EVOHUB_API_KEY;

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
        method: "POST",
        headers: { Authorization: `Bearer ${channelToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const wamid = data?.messages?.[0]?.id;
      if (wamid) return { waMessageId: wamid };
      if (!res.ok) throw new Error(JSON.stringify(data));
      return { waMessageId: wamid };
    }

    // ─── Audio: upload via EvoHub media endpoint → media_id → audio nativo ───
    const dl = await fetch(fileUrl);
    if (!dl.ok) throw new Error(`Download: ${dl.status}`);
    const buffer = Buffer.from(await dl.arrayBuffer());
    const contentType = dl.headers.get("content-type") || "audio/ogg";
    const isOgg = contentType.includes("ogg") || contentType.includes("opus");

    // Try EvoHub media endpoint with API key (platform-level auth)
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: contentType }), "audio.ogg");
    form.append("type", contentType);
    form.append("messaging_product", "whatsapp");

    // Tenta com a API key do EvoHub (token de plataforma)
    const uploadToken = EVOHUB_API_KEY || channelToken;
    const uploadRes = await fetch(`${EVOHUB_API_URL}/meta/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${uploadToken}` },
      body: form,
    });
    const uploadData = await uploadRes.json();

    let mediaId: string | null = uploadData?.id || null;

    // Se EvoHub não aceitar, tenta Meta direto com channel token
    if (!mediaId) {
      const metaRes = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${channelToken}` },
        body: form,
      });
      const metaData = await metaRes.json();
      mediaId = metaData?.id || null;
    }

    // Send
    const sendBody: any = { messaging_product: "whatsapp", to };
    if (mediaId) {
      sendBody.type = "audio";
      sendBody.audio = { id: mediaId, voice: isOgg || undefined };
    } else {
      sendBody.type = "document";
      sendBody.document = { link: fileUrl, filename: "audio.mp3" };
    }

    const sendRes = await fetch(`${EVOHUB_API_URL}/meta/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${channelToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(sendBody),
    });
    const sendData = await sendRes.json();
    const wamid = sendData?.messages?.[0]?.id;
    if (wamid) return { waMessageId: wamid };
    if (!sendRes.ok) throw new Error(JSON.stringify(sendData));
    return { waMessageId: wamid };
  } catch (err: any) {
    return { waMessageId: null, error: err.message };
  }
}
