import { createClient } from "@/lib/supabase/server";

const BASE = process.env.EVOHUB_API_URL || "https://api.evohub.ai";
const KEY = process.env.EVOHUB_API_KEY;
const CONNECT_BASE = "https://app.evohub.evolutionfoundation.com.br";

export interface EvoHubChannel {
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

export async function listAllChannels(): Promise<EvoHubChannel[]> {
  if (!KEY) return [];
  const res = await fetch(`${BASE}/api/v1/channels`, {
    headers: { Authorization: `Bearer ${KEY}` },
    next: { revalidate: 30 },
  });
  const data = await res.json();
  return data.channels || [];
}

export async function listChannelsForUser(): Promise<EvoHubChannel[]> {
  if (!KEY) return [];

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const allChannels = await listAllChannels();

  if (profile?.role === "admin" || profile?.role === "supervisor") {
    return allChannels;
  }

  const { data: sellerChannels } = await supabase
    .from("seller_channels")
    .select("evohub_channel_id")
    .eq("user_id", user.id);

  if (!sellerChannels || sellerChannels.length === 0) return [];

  const allowedIds = new Set(sellerChannels.map((s) => s.evohub_channel_id));
  return allChannels.filter((ch) => allowedIds.has(ch.id));
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

export async function createChannel(name: string, type: string = "whatsapp") {
  if (!KEY) return null;
  const res = await fetch(`${BASE}/api/v1/channels`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, type }),
  });
  const data = await res.json();
  return {
    id: data.id,
    name: data.name,
    token: data.token,
    status: data.status,
    type: data.type,
    connectUrl: `${CONNECT_BASE}/connect/${data.token}`,
  };
}

export async function getPhoneNumberFromMeta(channelToken: string, phoneNumberId: string): Promise<string | null> {
  if (!channelToken || !phoneNumberId) return null;
  try {
    const res = await fetch(`${BASE}/meta/v23.0/${phoneNumberId}`, {
      headers: { Authorization: `Bearer ${channelToken}` },
      cache: "no-store",
    });
    const data = await res.json();
    return data?.display_phone_number || null;
  } catch {
    return null;
  }
}

export async function enrichChannelsWithPhoneNumbers(channels: EvoHubChannel[]): Promise<(EvoHubChannel & { displayPhone?: string })[]> {
  const KNOWN: Record<string, string> = {
    "5145a0c0-a358-43e5-8269-c5ace26ca023": "897878513398151",
    "effa72d1-47f6-445b-acbc-7693ef21ee24": "976034132269824",
    "c5505ddf-f9ef-4837-9337-45ed3de40d6a": "892228177298374",
    "346e4eef-bc78-41ec-a7ae-ec7ec75bf177": "1034222499765101",
    "b1c6879b-e962-4f50-95f7-14f1a04601a5": "1234821229708132",
  };

  const supabase = createClient();
  const { data: opChannels } = await supabase
    .from("operations_channels")
    .select("evohub_channel_id, phone_number_id")
    .eq("is_active", true);

  const phoneIdMap: Record<string, string> = {};
  for (const [chId, phoneId] of Object.entries(KNOWN)) {
    phoneIdMap[chId] = phoneId;
  }
  for (const row of opChannels || []) {
    if (row.phone_number_id) phoneIdMap[row.evohub_channel_id] = row.phone_number_id;
  }

  return Promise.all(
    channels.map(async (ch) => {
      const phoneId = phoneIdMap[ch.id];
      if (phoneId && ch.token) {
        const phone = await getPhoneNumberFromMeta(ch.token, phoneId);
        return { ...ch, displayPhone: phone || undefined };
      }
      return ch;
    })
  );
}
