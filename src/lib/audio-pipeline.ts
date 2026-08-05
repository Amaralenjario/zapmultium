// Audio Pipeline - upload via EvoHub (versão correta) → media_id → audio nativo

const EVOHUB_API_URL = process.env.EVOHUB_API_URL || "https://api.evohub.ai";

function detectOgg(buf: Buffer, url: string, contentType: string): boolean {
  if (buf.length >= 4 && buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return true;
  const u = url.toLowerCase();
  if (u.includes(".ogg") || u.includes(".opus") || u.includes(".oga")) return true;
  if (contentType.includes("audio/ogg") || contentType.includes("audio/opus")) return true;
  return false;
}

export async function processAndSendMedia(
  fileUrl: string,
  mediaType: "image" | "audio" | "video",
  to: string,
  phoneNumberId: string,
  channelToken: string,
  caption?: string
): Promise<{ waMessageId: string | null; error?: string }> {
  try {
    if (mediaType !== "audio") {
      const mediaObj: any = { link: fileUrl };
      if (caption) mediaObj.caption = caption;
      const body: any = { messaging_product: "whatsapp", to, type: mediaType === "video" ? "video" : mediaType, [mediaType]: mediaObj };
      const res = await fetch(`${EVOHUB_API_URL}/meta/v23.0/${phoneNumberId}/messages`, {
        method: "POST", headers: { Authorization: `Bearer ${channelToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      const wamid = data?.messages?.[0]?.id;
      if (wamid) return { waMessageId: wamid };
      if (!res.ok) throw new Error(JSON.stringify(data));
      return { waMessageId: wamid };
    }

    // ─── Audio: check for OGG version first ───
    // If original is .mp3, check if .ogg version exists (converted by Edge Function)
    let audioUrl = fileUrl;
    if (!fileUrl.endsWith(".ogg") && !fileUrl.endsWith(".opus")) {
      const oggUrl = fileUrl.replace(/\.(mp3|mp4|wav|aac|m4a)$/i, "") + ".ogg";
      const check = await fetch(oggUrl, { method: "HEAD" });
      if (check.ok) audioUrl = oggUrl;
    }

    const dl = await fetch(audioUrl);
    if (!dl.ok) throw new Error(`Download: ${dl.status}`);
    const buffer = Buffer.from(await dl.arrayBuffer());
    const contentType = (dl.headers.get("content-type") || "").toLowerCase();
    const isOgg = detectOgg(buffer, fileUrl, contentType);

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

    // Se conseguiu media_id, envia como audio nativo (sempre voice: true para aparecer como mensagem de voz)
    if (mediaId) {
      const sendBody = { type: "audio", audio: { id: mediaId, voice: true } };
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
    const fallbackBody = { messaging_product: "whatsapp", to, type: "audio", audio: { link: fileUrl, voice: true } };
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
