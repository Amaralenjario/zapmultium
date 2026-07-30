const BASE = process.env.EVOHUB_API_URL || "https://api.evohub.ai";
const KEY = process.env.EVOHUB_API_KEY;

interface EvoHubChannel {
  id: string;
  name: string;
  type: string;
  status: string;
  token: string;
  external_id: string | null;
  metadata: {
    meta_connection?: {
      phone_number?: string;
      phone_number_id?: string;
      waba_id?: string;
      display_name?: string;
    };
  };
  created_at: string;
  updated_at: string;
}

export async function listChannels(): Promise<EvoHubChannel[]> {
  if (!KEY) return [];
  const res = await fetch(`${BASE}/api/v1/channels`, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: "no-store",
  });
  const data = await res.json();
  return data.channels || [];
}

export async function getChannel(id: string): Promise<EvoHubChannel | null> {
  if (!KEY) return null;
  const res = await fetch(`${BASE}/api/v1/channels/${id}`, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: "no-store",
  });
  const data = await res.json();
  return data || null;
}

export async function createChannel(name: string, type: string = "whatsapp"): Promise<EvoHubChannel | null> {
  if (!KEY) return null;
  const res = await fetch(`${BASE}/api/v1/channels`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, type }),
  });
  return res.json();
}
