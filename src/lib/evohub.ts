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
    cache: "no-store",
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

export async function getChannelToken(channelId: string): Promise<string | null> {
  const channel = await getChannel(channelId);
  return channel?.token || null;
}
