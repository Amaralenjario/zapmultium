// Audio/Media Pipeline - envia mídia via EvoHub
// A conversão de áudio para OGG Opus é feita NO UPLOAD (api/flows/media), não aqui.

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
    body[mediaType] = { link: fileUrl };

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
