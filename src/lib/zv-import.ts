import { createClient } from "@supabase/supabase-js";

interface ZvSequence {
  id: string;
  type: "audio" | "message" | "media" | "document";
  itemId: string;
  delayBeforeSend: number;
}

interface ZvFunnel {
  id: string;
  name: string;
  isFavorite: boolean;
  sequences: ZvSequence[];
}

interface ZvExport {
  funnels: ZvFunnel[];
  objectsList: { id: string; data: string }[];
  audios: { id: string; data: string }[];
  medias: { id: string; data: string }[];
  docs: { id: string; data: string }[];
}

function zvTypeToNodeType(t: string): string {
  switch (t) {
    case "message": return "message";
    case "audio": return "audio";
    case "document": return "video";
    case "media": return "image";
    default: return "message";
  }
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function findData(itemId: string, zv: ZvExport): string | null {
  return (
    zv.objectsList?.find(o => o.id === itemId)?.data ||
    zv.audios?.find(a => a.id === itemId)?.data ||
    zv.medias?.find(m => m.id === itemId)?.data ||
    zv.docs?.find(d => d.id === itemId)?.data ||
    null
  );
}

function detectMime(base64: string): string | null {
  const header = base64.substring(0, 20).toLowerCase();
  if (header.startsWith("/9j/")) return "image/jpeg";
  if (header.startsWith("iVBOR")) return "image/png";
  if (header.startsWith("R0lGOD")) return "image/gif";
  if (header.startsWith("UklGR")) return "audio/ogg";
  if (header.startsWith("AAAAIGZ0eXBpc29t") || header.startsWith("AAAAHGZ0eXA")) return "video/mp4";
  if (header.startsWith("SUQz")) return "audio/mpeg";
  if (header.startsWith("GIF8")) return "image/gif";
  return null;
}

function getExtension(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp",
    "video/mp4": "mp4", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp3": "mp3",
    "application/pdf": "pdf",
  };
  return map[mime] || "bin";
}

export async function importZapVoiceJSON(file: ArrayBuffer, userId: string): Promise<{ ok: boolean; imported: string[]; errors: string[] }> {
  const imported: string[] = [];
  const errors: string[] = [];

  try {
    const text = new TextDecoder().decode(file);
    const zv: ZvExport = JSON.parse(text);

    if (!zv.funnels || !Array.isArray(zv.funnels)) {
      return { ok: false, imported: [], errors: ["Formato inválido: 'funnels' não encontrado"] };
    }

    const supabase = getSupabase();

    for (const funnel of zv.funnels) {
      try {
        if (!funnel.sequences?.length) {
          errors.push(`Funil "${funnel.name}" sem sequências — ignorado`);
          continue;
        }

        const nodes: any[] = [];
        const edges: any[] = [];
        const triggerId = `zv-trigger-${funnel.id}`;
        nodes.push({ id: triggerId, type: "start", label: "Início", config: {} });

        let prevNodeId = triggerId;
        let stepIdx = 0;

        for (const seq of funnel.sequences) {
          const seqId = `${funnel.id}-seq-${stepIdx}`;

          // Delay node before the step
          if (seq.delayBeforeSend > 0) {
            const delayId = `zv-delay-${seqId}`;
            const seconds = Math.round(seq.delayBeforeSend / 1000);
            nodes.push({ id: delayId, type: "wait", label: "Aguardar", config: { seconds } });
            edges.push({ source: prevNodeId, target: delayId });
            prevNodeId = delayId;
          }

          // Try to upload media for audio/media/document types
          let mediaUrl = "";
          if (seq.type !== "message" && seq.itemId) {
            const b64 = findData(seq.itemId, zv);
            if (b64) {
              try {
                const mime = detectMime(b64) || "application/octet-stream";
                const ext = getExtension(mime);
                const buffer = Buffer.from(b64, "base64");
                const path = `zapvoice/${userId}/${seq.itemId}.${ext}`;

                const { error: uploadErr } = await supabase.storage
                  .from("flow-media")
                  .upload(path, buffer, { contentType: mime, upsert: true });

                if (!uploadErr) {
                  const { data: urlData } = supabase.storage.from("flow-media").getPublicUrl(path);
                  mediaUrl = urlData.publicUrl;
                }
              } catch { /* skip media upload errors */ }
            }
          }

          // Create the step node
          const nodeType = zvTypeToNodeType(seq.type);
          const stepId = `zv-step-${seqId}`;
          const nodeConfig: any = {
            _zv: { sequenceId: seq.id, itemId: seq.itemId, type: seq.type, delayMs: seq.delayBeforeSend },
          };

          if (nodeType === "message") {
            const data = findData(seq.itemId, zv) || "";
            nodeConfig.text = data;
          } else {
            nodeConfig.url = mediaUrl;
          }

          nodes.push({ id: stepId, type: nodeType, label: nodeType === "message" ? "Mensagem" : nodeType === "audio" ? "Áudio" : nodeType === "image" ? "Imagem" : "Vídeo", config: nodeConfig });
          edges.push({ source: prevNodeId, target: stepId, id: `edge-${prevNodeId}-${stepId}` });
          prevNodeId = stepId;
          stepIdx++;
        }

        // Create the flow in the database
        const { data: newFlow, error: flowErr } = await supabase
          .from("flows")
          .insert({
            name: `[ZV] ${funnel.name}`,
            user_id: userId,
            config: { steps: nodes, edges },
            status: "draft",
            trigger_type: "manual",
          })
          .select("id")
          .single();

        if (flowErr) {
          errors.push(`"${funnel.name}": erro ao criar — ${flowErr.message}`);
        } else {
          imported.push(`[ZV] ${funnel.name}`);
        }
      } catch (e: any) {
        errors.push(`"${funnel.name}": ${e.message}`);
      }
    }

    return { ok: imported.length > 0, imported, errors };
  } catch (e: any) {
    return { ok: false, imported: [], errors: [`Erro ao processar JSON: ${e.message}`] };
  }
}
