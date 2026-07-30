// Audio Pipeline - upload via EvoHub (versão correta) → media_id → audio nativo

const EVOHUB_API_URL = process.env.EVOHUB_API_URL || "https://api.evohub.ai";

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
      const res = await fetch(`${EVOHUB_API_URL}/meta/v23.0/${phoneNumberId}/messages`, {
        method: "POST", headers: { Authorization: `Bearer ${channelToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      const wamid = data?.messages?.[0]?.id;
      if (wamid) return { waMessageId: wamid };
      if (!res.ok) throw new Error(JSON.stringify(data));
      return { waMessageId: wamid };
    }

    // ─── Audio: upload via EvoHub media endpoint (multipart) → media_id ───
    const dl = await fetch(fileUrl);
    if (!dl.ok) throw new Error(`Download: ${dl.status}`);
    const buffer = Buffer.from(await dl.arrayBuffer());
    const isOgg = fileUrl.includes(".ogg") || fileUrl.includes(".opus");

    // Tenta com e sem versão no path
    const mediaEndpoints = [
      `${EVOHUB_API_URL}/meta/v23.0/${phoneNumberId}/media`,
      `${EVOHUB_API_URL}/meta/${phoneNumberId}/media`,
    ];

    let mediaId: string | null = null;
    for (const endpoint of mediaEndpoints) {
      try {
        const form = new FormData();
        form.append("file", new Blob([buffer], { type: "audio/ogg" }), "audio.ogg");
        form.append("type", "audio/ogg");
        form.append("messaging_product", "whatsapp");

        const uploadRes = await fetch(endpoint, {
          method: "POST", headers: { Authorization: `Bearer ${channelToken}` }, body: form, signal: AbortSignal.timeout(8000),
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          if (uploadData.id) { mediaId = uploadData.id; break; }
        }
      } catch {}
    }

    // Se conseguiu media_id, envia como audio nativo
    if (mediaId) {
      const sendBody = { type: "audio", audio: { id: mediaId, voice: isOgg || undefined } };
      const sendRes = await fetch(`${EVOHUB_API_URL}/meta/v23.0/${phoneNumberId}/messages`, {
        method: "POST", headers: { Authorization: `Bearer ${channelToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, ...sendBody }),
      });
      const sendData = await sendRes.json();
      const wamid = sendData?.messages?.[0]?.id;
      if (wamid) return { waMessageId: wamid };
    }

    // Se não conseguiu media_id → NUNCA usa document. Envia como audio com link mesmo assim.
    // Meta aceita link pra audio? Não na teoria, mas vamos tentar.
    const fallbackBody = { messaging_product: "whatsapp", to, type: "audio", audio: { link: fileUrl } };
    const fRes = await fetch(`${EVOHUB_API_URL}/meta/v23.0/${phoneNumberId}/messages`, {
      method: "POST", headers: { Authorization: `Bearer ${channelToken}`, "Content-Type": "application/json" }, body: JSON.stringify(fallbackBody),
    });
    const fData = await fRes.json();
    const wamid = fData?.messages?.[0]?.id;
    if (wamid) return { waMessageId: wamid };
    // Se nem link funcionou, retorna erro (NUNCA document)
    throw new Error("Falha ao enviar áudio - upload media_id e link falharam");
  } catch (err: any) {
    return { waMessageId: null, error: err.message };
  }
}
