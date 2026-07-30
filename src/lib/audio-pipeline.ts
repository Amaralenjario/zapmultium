// Audio/Media Pipeline - envia mídia via EvoHub

const EVOHUB_API_URL = process.env.EVOHUB_API_URL || "https://api.evohub.ai";

export async function processAndSendMedia(
  fileUrl: string,
  mediaType: "image" | "audio" | "video",
  to: string,
  phoneNumberId: string,
  channelToken: string
): Promise<{ waMessageId: string | null; error?: string }> {
  try {
    const body: any = { messaging_product: "whatsapp", to };

    if (mediaType === "audio") {
      // Upload via EvoHub media endpoint (proxies to Meta with correct token)
      const mediaId = await uploadViaEvoHubMedia(fileUrl, phoneNumberId, channelToken);
      if (mediaId) {
        body.type = "audio";
        body.audio = { id: mediaId };
      } else {
        // Fallback: send as document
        body.type = "document";
        body.document = { link: fileUrl, filename: "audio.mp3" };
      }
    } else {
      body.type = mediaType === "video" ? "video" : mediaType;
      body[mediaType] = { link: fileUrl };
    }

    const res = await fetch(`${EVOHUB_API_URL}/meta/v23.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${channelToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    return { waMessageId: data.messages?.[0]?.id || null };
  } catch (err: any) {
    return { waMessageId: null, error: err.message };
  }
}

async function uploadViaEvoHubMedia(fileUrl: string, phoneNumberId: string, channelToken: string): Promise<string | null> {
  try {
    const dlRes = await fetch(fileUrl);
    if (!dlRes.ok) return null;
    const buffer = await dlRes.arrayBuffer();
    const contentType = dlRes.headers.get("content-type") || "audio/mpeg";

    const formData = new FormData();
    formData.append("file", new Blob([buffer], { type: contentType }), "audio.file");
    formData.append("messaging_product", "whatsapp");
    formData.append("type", contentType);

    // Try EvoHub's media proxy first
    const res = await fetch(`${EVOHUB_API_URL}/meta/v23.0/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${channelToken}` },
      body: formData,
    });

    const data = await res.json();
    if (res.ok) return data.id || null;

    // If EvoHub doesn't support media endpoint, try Meta directly
    console.log("EvoHub media failed, trying Meta directly");
    const metaRes = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${channelToken}` },
      body: formData,
    });
    const metaData = await metaRes.json();
    return metaRes.ok ? metaData.id || null : null;
  } catch {
    return null;
  }
}
