// Audio Pipeline - upload via EvoHub media endpoint → media_id → audio nativo

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

    // ─── Audio: upload via EvoHub → media_id → audio nativo ───
    const dl = await fetch(fileUrl);
    if (!dl.ok) throw new Error(`Download falhou: ${dl.status}`);
    const buffer = await dl.arrayBuffer();
    const contentType = dl.headers.get("content-type") || "audio/mpeg";

    // Upload via EvoHub media endpoint (multipart)
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: contentType }), "audio.file");
    form.append("type", contentType);
    form.append("messaging_product", "whatsapp");

    const uploadRes = await fetch(`${EVOHUB_API_URL}/meta/v23.0/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${channelToken}` },
      body: form,
    });

    const uploadData = await uploadRes.json();

    let mediaId: string | null = null;
    if (uploadRes.ok && uploadData.id) {
      mediaId = uploadData.id;
    }

    // Send with media_id or fallback to document
    const sendBody: any = { messaging_product: "whatsapp", to };

    if (mediaId) {
      sendBody.type = "audio";
      sendBody.audio = { id: mediaId };
    } else {
      sendBody.type = "document";
      sendBody.document = { link: fileUrl, filename: "audio.mp3" };
    }

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
