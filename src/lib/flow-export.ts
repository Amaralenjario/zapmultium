// FLOWV1 Export/Import Format

// Base64 UTF-8 seguro pra NAVEGADOR e servidor (não usa Buffer, que não existe no browser).
function b64Encode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64Decode(b64: string): string {
  const bin = atob(b64.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

const TO_FLOWV1: Record<string, string> = {
  start: "trigger",
  wait: "delay",
  wait_reply: "wait_reply",
  message: "send_text",
  image: "send_image",
  audio: "send_audio",
  video: "send_video",
  add_tag: "add_tag",
  remove_tag: "remove_tag",
  set_stage: "set_stage",
};

const FROM_FLOWV1: Record<string, string> = {
  trigger: "start",
  delay: "wait",
  wait_reply: "wait_reply",
  send_text: "message",
  send_image: "image",
  send_audio: "audio",
  send_video: "video",
  add_tag: "add_tag",
  remove_tag: "remove_tag",
  set_tag: "add_tag",
  unset_tag: "remove_tag",
  apply_tag: "add_tag",
  tag: "add_tag",
  untag: "remove_tag",
  set_stage: "set_stage",
};

export function exportFlowV1(
  name: string,
  steps: { id: string; type: string; label?: string; config?: Record<string, any>; position?: { x: number; y: number } }[],
  edges: { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }[]
): string {
  const data = {
    version: 1,
    exported_at: new Date().toISOString(),
    nome: name || "Fluxo",
    entry_node_id: steps.find((n) => n.type === "start")?.id || steps[0]?.id || "",
    nodes: steps.map((n) => {
      const v1Type = TO_FLOWV1[n.type] || n.type;
      const nodeData: Record<string, any> = {};

      switch (n.type) {
        case "start":
          nodeData.label = n.label || "Início";
          break;
        case "wait":
          nodeData.seconds = n.config?.delay || 5;
          break;
        case "wait_reply":
          nodeData.variable = n.config?.variable || "resposta";
          nodeData.timeoutMinutes = n.config?.timeoutMinutes ?? "";
          break;
        case "message":
          nodeData.text = n.config?.text || "";
          break;
        case "image":
          nodeData.mediaUrl = n.config?.url || "";
          nodeData.caption = n.config?.caption || "";
          nodeData.filename = (n.config?.url || "").split("/").pop() || "image.png";
          break;
        case "audio":
          nodeData.mediaUrl = n.config?.url || "";
          nodeData.filename = (n.config?.url || "").split("/").pop() || "audio.ogg";
          break;
        case "video":
          nodeData.mediaUrl = n.config?.url || "";
          nodeData.caption = "";
          nodeData.filename = (n.config?.url || "").split("/").pop() || "video.mp4";
          break;
        case "condition":
          nodeData.variable = n.config?.variable || "";
          nodeData.value = n.config?.value || "";
          break;
        case "add_tag":
        case "remove_tag":
          nodeData.tagName = n.config?.tagName || n.config?.name || "";
          break;
        case "set_stage":
          nodeData.stage = n.config?.stage || "attending";
          break;
      }

      return {
        id: n.id,
        type: v1Type,
        data: nodeData,
        position: n.position || { x: 100, y: 100 },
      };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || undefined,
      targetHandle: e.targetHandle || undefined,
    })),
    triggers: [],
  };

  const json = JSON.stringify(data);
  return `FLOWV1:${b64Encode(json)}`;
}

export function importFlowV1(code: string): {
  name: string;
  steps: { id: string; type: string; label: string; config: Record<string, any>; position?: { x: number; y: number } }[];
  edges: { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }[];
} | null {
  try {
    if (!code.startsWith("FLOWV1:")) return null;
    const base64 = code.replace("FLOWV1:", "").trim();
    const json = b64Decode(base64);
    const data = JSON.parse(json);

    if (!data.nodes || !Array.isArray(data.nodes)) return null;

    const steps = data.nodes.map((n: any) => {
      const ourType = FROM_FLOWV1[n.type] || n.type;
      const config: Record<string, any> = {};

      switch (ourType) {
        case "message":
          config.text = n.data?.text || "";
          break;
        case "image":
          config.url = n.data?.mediaUrl || "";
          config.caption = n.data?.caption || "";
          break;
        case "audio":
          config.url = n.data?.mediaUrl || "";
          break;
        case "video":
          config.url = n.data?.mediaUrl || "";
          config.caption = n.data?.caption || "";
          break;
        case "wait":
          config.delay = n.data?.seconds || 5;
          break;
        case "wait_reply":
          config.variable = n.data?.variable || "resposta";
          config.timeoutMinutes = n.data?.timeoutMinutes ?? "";
          break;
        case "start":
          break;
        case "condition":
          config.variable = n.data?.variable || "";
          config.value = n.data?.value || "";
          break;
        case "add_tag":
        case "remove_tag":
          config.tagName = n.data?.tagName || n.data?.name || "";
          break;
        case "set_stage":
          config.stage = n.data?.stage || "attending";
          break;
      }

      return {
        id: n.id,
        type: ourType,
        label: n.data?.label || ourType,
        config,
        position: n.position || { x: 300, y: 50 },
      };
    });

    const edges = (data.edges || []).map((e: any) => ({
      id: e.id || "",
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || undefined,
      targetHandle: e.targetHandle || undefined,
    }));

    return { name: data.nome || "Fluxo importado", steps, edges };
  } catch {
    return null;
  }
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
