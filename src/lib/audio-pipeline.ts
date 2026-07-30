// Audio Pipeline - upload Meta → media_id → audio nativo

const EVOHUB_API_URL = process.env.EVOHUB_API_URL || "https://api.evohub.ai";

export async function processAndSendMedia(
  fileUrl: string,
  mediaType: "image" | "audio" | "video",
  to: string,
  phoneNumberId: string,
  channelToken: string
): Promise<{ waMessageId: string | null; error?: string }> {
  try {
    // Image/Video: link funciona
    if (mediaType !== "audio") {
      const body: any = {
        messaging_product: "whatsapp", to,
        type: mediaType === "video" ? "video" : mediaType,
        [mediaType]: { link: fileUrl },
      };
      const res = await fetch(`${EVOHUB_API_URL}/meta/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${channelToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      // If HTTP failed but Meta delivered (has wamid), consider success
      const wamid = data?.messages?.[0]?.id;
      if (wamid) return { waMessageId: wamid };
      if (!res.ok) throw new Error(JSON.stringify(data));
      return { waMessageId: wamid };
    }

    // ─── Audio: upload Meta → media_id → send with id ───
    // 1) Download from storage
    const dl = await fetch(fileUrl);
    if (!dl.ok) throw new Error(`Download falhou: ${dl.status}`);
    const buffer = Buffer.from(await dl.arrayBuffer());
    const contentType = dl.headers.get("content-type") || "audio/ogg";
    const isOgg = contentType.includes("ogg") || contentType.includes("opus");

    // 2) Upload direto na Meta → media_id
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: contentType }), "audio.ogg");
    form.append("type", contentType);
    form.append("messaging_product", "whatsapp");

    const metaRes = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${channelToken}` },
      body: form,
    });

    const metaData = await metaRes.json();
    if (!metaRes.ok || !metaData.id) {
      throw new Error(metaData?.error?.message || JSON.stringify(metaData).slice(0, 200));
    }
    const mediaId = metaData.id;

    // 3) Send with media_id via EvoHub (path sem versão!)
    const sendBody: any = {
      type: "audio",
      audio: { id: mediaId, voice: isOgg || undefined },
    };

    const sendRes = await fetch(`${EVOHUB_API_URL}/meta/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${channelToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, ...sendBody }),
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
