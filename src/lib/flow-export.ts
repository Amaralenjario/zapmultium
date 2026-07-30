// FLOWV1 Export/Import Format

interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: { label?: string; config?: Record<string, any>; [key: string]: any };
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface FlowV1Export {
  version: 1;
  exported_at: string;
  nome: string;
  entry_node_id: string;
  nodes: FlowV1Node[];
  edges: FlowV1Edge[];
  triggers: FlowV1Trigger[];
}

interface FlowV1Node {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
}

interface FlowV1Edge {
  id: string;
  source: string;
  target: string;
}

interface FlowV1Trigger {
  tipo: string;
  valor: string;
  match_mode: string;
  ativo: boolean;
}

// Our type → FLOWV1 type mapping
const TO_FLOWV1: Record<string, string> = {
  start: "trigger",
  wait: "delay",
  message: "send_text",
  image: "send_image",
  audio: "send_audio",
  video: "send_video",
};

// FLOWV1 type → our type
const FROM_FLOWV1: Record<string, string> = {
  trigger: "start",
  delay: "wait",
  send_text: "message",
  send_image: "image",
  send_audio: "audio",
  send_video: "video",
};

// Convert our config to FLOWV1 data
function toFlowV1Data(type: string, config: Record<string, any>): Record<string, any> {
  switch (type) {
    case "start":
      return { label: "Início" };
    case "wait":
      return { seconds: config.delay || 5 };
    case "message":
      return { text: config.text || "" };
    case "image":
      return { mediaUrl: config.url || "", caption: "", filename: "image.png" };
    case "audio":
      return { mediaUrl: config.url || "", filename: "audio.ogg" };
    case "video":
      return { mediaUrl: config.url || "", caption: "", filename: "video.mp4" };
    default:
      return {};
  }
}

// Convert FLOWV1 data to our config
function fromFlowV1Data(type: string, data: Record<string, any>): Record<string, any> {
  switch (type) {
    case "send_text":
      return { text: data.text || "" };
    case "send_image":
      return { url: data.mediaUrl || "" };
    case "send_audio":
      return { url: data.mediaUrl || "" };
    case "send_video":
      return { url: data.mediaUrl || "" };
    case "delay":
      return { delay: data.seconds || 5 };
    case "trigger":
      return {};
    default:
      return {};
  }
}

export function exportFlowV1(
  name: string,
  steps: FlowNode[],
  edges: FlowEdge[]
): string {
  const exportData: FlowV1Export = {
    version: 1,
    exported_at: new Date().toISOString(),
    nome: name,
    entry_node_id: steps.find((n) => n.type === "start" || n.data?.type === "start")?.id || steps[0]?.id || "",
    nodes: steps.map((n) => {
      const ourType = n.data?.type || n.type;
      const v1Type = TO_FLOWV1[ourType] || ourType;
      return {
        id: n.id,
        type: v1Type,
        position: n.position,
        data: toFlowV1Data(ourType, n.data?.config || {}),
      };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    })),
    triggers: [
      { tipo: "keyword", valor: "", match_mode: "word", ativo: true },
    ],
  };

  const json = JSON.stringify(exportData);
  const base64 = Buffer.from(json).toString("base64");
  return `FLOWV1:${base64}`;
}

export function importFlowV1(code: string): {
  name: string;
  steps: FlowNode[];
  edges: FlowEdge[];
} | null {
  try {
    if (!code.startsWith("FLOWV1:")) return null;
    const base64 = code.replace("FLOWV1:", "");
    const json = Buffer.from(base64, "base64").toString("utf-8");
    const data: FlowV1Export = JSON.parse(json);

    if (!data.nodes || !Array.isArray(data.nodes)) return null;
    if (data.version !== 1) return null;

    const steps: FlowNode[] = data.nodes
      .filter((n) => FROM_FLOWV1[n.type] || ["send_buttons", "send_document", "tag_action"].includes(n.type))
      .map((n) => {
        const ourType = FROM_FLOWV1[n.type] || n.type;
        return {
          id: n.id,
          type: "flowNode",
          position: n.position || { x: 300, y: 50 + data.nodes.indexOf(n) * 150 },
          data: {
            type: ourType,
            label: n.data?.label || ourType,
            config: fromFlowV1Data(n.type, n.data || {}),
          },
        };
      });

    const edges: FlowEdge[] = (data.edges || []).map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    }));

    return {
      name: data.nome || "Fluxo importado",
      steps,
      edges,
    };
  } catch {
    return null;
  }
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
