// Audio Pipeline - upload na Meta Media API + envio com media_id

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
      const res = await fetch(`${EVOHUB_API_URL}/meta/v23.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${channelToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));
      return { waMessageId: data.messages?.[0]?.id || null };
    }

    // ─── Audio: upload Meta Media API → media_id → enviar ───
    // Download file
    const dl = await fetch(fileUrl);
    if (!dl.ok) throw new Error(`Falha ao baixar áudio: ${dl.status}`);
    const buffer = await dl.arrayBuffer();
    const contentType = dl.headers.get("content-type") || "audio/mpeg";

    // Upload direto na Meta
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: contentType }), "audio.file");
    form.append("type", contentType);
    form.append("messaging_product", "whatsapp");

    const metaRes = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${channelToken}` },
      body: form,
    });

    const metaData = await metaRes.json();
    if (!metaRes.ok || !metaData.id) {
      throw new Error(`Meta Media API: ${JSON.stringify(metaData).slice(0, 200)}`);
    }

    // Enviar com media_id via EvoHub
    const sendBody = {
      messaging_product: "whatsapp",
      to,
      type: "audio",
      audio: { id: metaData.id },
    };

    const sendRes = await fetch(`${EVOHUB_API_URL}/meta/v23.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${channelToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(sendBody),
    });

    const sendData = await sendRes.json();
    if (!sendRes.ok) throw new Error(JSON.stringify(sendData));
    return { waMessageId: sendData.messages?.[0]?.id || null };
  } catch (err: any) {
    return { waMessageId: null, error: err.message };
  }
}
