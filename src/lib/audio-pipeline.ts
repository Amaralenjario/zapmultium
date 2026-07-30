// Audio Pipeline - upload Meta (só OGG) → media_id → audio nativo

const EVOHUB_API_URL = process.env.EVOHUB_API_URL || "https://api.evohub.ai";

function isOggAudio(url: string, contentType: string): boolean {
  const name = url.toLowerCase();
  return name.endsWith(".ogg") || name.endsWith(".opus") || contentType.includes("ogg") || contentType.includes("opus");
}

export async function processAndSendMedia(
  fileUrl: string,
  mediaType: "image" | "audio" | "video",
  to: string,
  phoneNumberId: string,
  channelToken: string
): Promise<{ waMessageId: string | null; error?: string }> {
  try {
    // Image/Video: link funciona direto
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

    // ─── Audio ───
    const dl = await fetch(fileUrl);
    if (!dl.ok) throw new Error(`Download: ${dl.status}`);
    const buffer = Buffer.from(await dl.arrayBuffer());
    const contentType = dl.headers.get("content-type") || "audio/mpeg";
    const isOgg = isOggAudio(fileUrl, contentType);

    // Só OGG Opus funciona como audio type no WhatsApp
    if (isOgg) {
      const form = new FormData();
      form.append("file", new Blob([buffer], { type: contentType }), "audio.ogg");
      form.append("type", contentType);  // audio/ogg
      form.append("messaging_product", "whatsapp");

      // Tenta upload via EvoHub (traduz token)
      const uploadRes = await fetch(`${EVOHUB_API_URL}/meta/${phoneNumberId}/media`, {
        method: "POST", headers: { Authorization: `Bearer ${channelToken}` }, body: form,
      });

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        if (uploadData.id) {
          const sendBody = { type: "audio", audio: { id: uploadData.id, voice: true } };
          const sendRes = await fetch(`${EVOHUB_API_URL}/meta/${phoneNumberId}/messages`, {
            method: "POST", headers: { Authorization: `Bearer ${channelToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ messaging_product: "whatsapp", to, ...sendBody }),
          });
          const sendData = await sendRes.json();
          const wamid = sendData?.messages?.[0]?.id;
          if (wamid) return { waMessageId: wamid };
        }
      }
    }

    // Fallback: documento (funciona com qualquer formato via link)
    const fb = { messaging_product: "whatsapp", to, type: "document", document: { link: fileUrl, filename: "audio.mp3" } };
    const fRes = await fetch(`${EVOHUB_API_URL}/meta/${phoneNumberId}/messages`, {
      method: "POST", headers: { Authorization: `Bearer ${channelToken}`, "Content-Type": "application/json" }, body: JSON.stringify(fb),
    });
    const fData = await fRes.json();
    const wamid = fData?.messages?.[0]?.id;
    if (wamid) return { waMessageId: wamid };
    throw new Error(JSON.stringify(fData));
  } catch (err: any) {
    return { waMessageId: null, error: err.message };
  }
}
