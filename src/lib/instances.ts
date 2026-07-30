const instanceMap: Record<string, { name: string; channelId: string; channelToken: string }> = {
  "897878513398151": { name: "VH - 1692", channelId: "5145a0c0-a358-43e5-8269-c5ace26ca023", channelToken: "aef5c1f70c114c8e0b3c8b2a5d6e7f8a" },
  "892228177298374": { name: "GUSTAVO - LUIS", channelId: "c5505ddf-f9ef-4837-9337-45ed3de40d6a", channelToken: "ff852b8e48eea68b9c0d1e2f3a4b5c6d7" },
  "1034222499765101": { name: "AMANDA - JÉ", channelId: "346e4eef-bc78-41ec-a7ae-ec7ec75bf177", channelToken: "a4a499ac2e7791df0e1f2a3b4c5d6e7f" },
  "976034132269824": { name: "GABI - 8176", channelId: "effa72d1-47f6-445b-acbc-7693ef21ee24", channelToken: "573ce80fda8e16ab0d1e2f3a4b5c6d7e8" },
  "": { name: "NC - CAIO", channelId: "b1c6879b-e962-4f50-95f7-14f1a04601a5", channelToken: "031d4b9bed27fdce0f1e2a3b4c5d6e7f8" },
};

export function getInstanceByPhoneId(phoneNumberId: string) {
  return instanceMap[phoneNumberId] || null;
}

export function getInstanceName(phoneNumberId: string): string | null {
  return instanceMap[phoneNumberId]?.name || null;
}

export async function getRealChannelToken(channelId: string): Promise<string | null> {
  try {
    const KEY = process.env.EVOHUB_API_KEY;
    const BASE = process.env.EVOHUB_API_URL || "https://api.evohub.ai";
    const res = await fetch(`${BASE}/api/v1/channels/${channelId}`, {
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    });
    const data = await res.json();
    return data?.token || null;
  } catch {
    return null;
  }
}
