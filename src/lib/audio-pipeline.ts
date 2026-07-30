// Audio/Media Pipeline - envia mídia via EvoHub
// Audio requer upload prévio na Meta Media API (link não suportado)
// Image/Video usam link direto (suportado)

const EVOHUB_API_URL = process.env.EVOHUB_API_URL || "https://api.evohub.ai";

export async function processAndSendMedia(
  fileUrl: string,
  mediaType: "image" | "audio" | "video",
  to: string,
  phoneNumberId: string,
  channelToken: string
): Promise<{ waMessageId: string | null; error?: string }> {
  try {
    const body: any = {
      messaging_product: "whatsapp",
      to,
      type: mediaType === "video" ? "video" : mediaType,
    };

    if (mediaType === "audio") {
      // Audio: must upload to Meta Media API first (link not supported)
      const mediaId = await uploadToMetaMedia(fileUrl, channelToken, phoneNumberId);
      if (!mediaId) throw new Error("Falha ao fazer upload do áudio no Meta Media API");
      body.audio = { id: mediaId };
    } else {
      // Image/Video: link is supported
      body[mediaType] = { link: fileUrl };
    }

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
    return { waMessageId: null, error: err.message };
  }
}

async function uploadToMetaMedia(fileUrl: string, channelToken: string, phoneNumberId: string): Promise<string | null> {
  try {
    // Download the file from our storage
    const dlRes = await fetch(fileUrl);
    if (!dlRes.ok) {
      console.error("Meta upload: download failed", dlRes.status);
      return null;
    }

    const buffer = await dlRes.arrayBuffer();
    const contentType = dlRes.headers.get("content-type") || "audio/mpeg";

    const formData = new FormData();
    formData.append("file", new Blob([buffer], { type: contentType }), "audio.file");
    formData.append("messaging_product", "whatsapp");
    formData.append("type", contentType);

    const res = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${channelToken}` },
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("Meta media upload failed:", JSON.stringify(data).slice(0, 300));
      return null;
    }

    return data.id || null;
  } catch (err: any) {
    console.error("Meta upload error:", err.message);
    return null;
  }
}
