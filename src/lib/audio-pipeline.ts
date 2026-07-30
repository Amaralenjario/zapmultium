// Audio Pipeline - envia via EvoHub (proxy traduz token e link)

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
      body.type = "audio";
      body.audio = { link: fileUrl };
    } else {
      body.type = mediaType === "video" ? "video" : mediaType;
      body[mediaType] = { link: fileUrl };
    }

    // Usa /meta/ sem versão (caminho correto do EvoHub)
    const res = await fetch(`${EVOHUB_API_URL}/meta/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${channelToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    const wamid = data?.messages?.[0]?.id;
    // Se Meta entregou (tem wamid), sucesso mesmo se HTTP != 200
    if (wamid) return { waMessageId: wamid };
    if (!res.ok) throw new Error(JSON.stringify(data));
    return { waMessageId: wamid };
  } catch (err: any) {
    return { waMessageId: null, error: err.message };
  }
}
