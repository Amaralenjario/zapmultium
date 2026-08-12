// Audio Pipeline - upload via EvoHub (versão correta) → media_id → audio nativo

import { isRetriableNotSent } from "./wa-errors";

const EVOHUB_API_URL = process.env.EVOHUB_API_URL || "https://api.evohub.ai";

function detectOgg(buf: Buffer, url: string, contentType: string): boolean {
  if (buf.length >= 4 && buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return true;
  const u = url.toLowerCase();
  if (u.includes(".ogg") || u.includes(".opus") || u.includes(".oga")) return true;
  if (contentType.includes("audio/ogg") || contentType.includes("audio/opus")) return true;
  return false;
}

// POST /messages resiliente: usa res.text() (não estoura em HTML de gateway 5xx) e
// REPETE em falha transitória — mas SÓ quando não veio message_id (Meta não aceitou),
// então não duplica a mídia. Erro 4xx (token/número) é permanente, não repete.
async function postMessageWithRetry(phoneNumberId: string, token: string, body: any, attempts = 3): Promise<{ wamid: string | null; error?: string }> {
  let lastErr: string | undefined;
  for (let i = 0; i < attempts; i++) {
    let res: Response | null = null;
    let data: any = null;
    let raw = "";
    try {
      res = await fetch(`${EVOHUB_API_URL}/meta/v23.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      raw = await res.text();
      try { data = JSON.parse(raw); } catch { /* HTML/gateway */ }
      const wamid = data?.messages?.[0]?.id;
      if (wamid) return { wamid }; // enviado
    } catch (e: any) {
      res = null;
      data = { error: { code: "NETWORK", message: e?.message || "fetch failed", cause: e?.cause?.code } };
    }
    const errData = data || { error: { message: raw } };
    lastErr = (data ? JSON.stringify(data) : raw || "falha").slice(0, 200);
    // SEGURANÇA: só repete se GARANTIDO que não entregou; senão para (não duplica a mídia).
    if (!isRetriableNotSent(res, errData)) return { wamid: null, error: lastErr.slice(0, 300) };
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return { wamid: null, error: lastErr || "falha no envio de mídia" };
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
      const { wamid, error } = await postMessageWithRetry(phoneNumberId, channelToken, body);
      if (wamid) return { waMessageId: wamid };
      return { waMessageId: null, error: error || "Falha ao enviar mídia" };
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
      const { wamid } = await postMessageWithRetry(phoneNumberId, channelToken, { messaging_product: "whatsapp", to, type: "audio", audio: { id: mediaId, voice: true } });
      if (wamid) return { waMessageId: wamid };
    }

    // Se não conseguiu media_id → NUNCA usa document. Envia como audio com link mesmo assim.
    const { wamid: fWamid } = await postMessageWithRetry(phoneNumberId, channelToken, { messaging_product: "whatsapp", to, type: "audio", audio: { link: fileUrl, voice: true } });
    if (fWamid) return { waMessageId: fWamid };
    // Se nem link funcionou, retorna erro (NUNCA document)
    throw new Error("Falha ao enviar áudio - upload media_id e link falharam");
  } catch (err: any) {
    return { waMessageId: null, error: err.message };
  }
}
