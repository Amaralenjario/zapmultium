import { createClient } from "@/lib/supabase/server";

const BASE = process.env.EVOHUB_API_URL || "https://api.evohub.ai";
const KEY = process.env.EVOHUB_API_KEY;
const CONNECT_BASE = "https://app.evohub.evolutionfoundation.com.br";

interface MetaConnection {
  waba_id?: string;
  phone_number_id?: string;
  display_name?: string;
  phone_numbers?: { id?: string; status?: string; display_phone_number?: string; verified_name?: string }[];
}

export interface EvoHubChannel {
  id: string;
  name: string;
  type: string;
  status: string;
  token: string;
  external_id: string | null;
  // A API do EvoHub devolve meta_connection no TOPO do objeto (não dentro de metadata).
  meta_connection?: MetaConnection;
  metadata?: { meta_connection?: MetaConnection };
  created_at: string;
  updated_at: string;
}

// Um canal está de fato conectado se tem um número com status CONNECTED no meta_connection —
// mesmo que o status de cima do EvoHub esteja "inactive" (bug conhecido do EvoHub).
export function connectedPhoneOf(ch: EvoHubChannel): { display_phone_number?: string; id?: string } | null {
  const mc = ch.meta_connection || ch.metadata?.meta_connection;
  const p = mc?.phone_numbers?.find((n) => n.status === "CONNECTED");
  return p || null;
}
export function effectiveStatus(ch: EvoHubChannel): string {
  if (ch.status === "active") return "active";
  return connectedPhoneOf(ch) ? "active" : ch.status;
}

export async function listAllChannels(): Promise<EvoHubChannel[]> {
  const supabase = createClient();

  // Buscar todas as contas EvoHub do banco + fallback do env
  const { data: accounts } = await supabase.from("evo_accounts").select("id, name, api_key, api_url");

  const keys: { apiKey: string; apiUrl: string }[] = [];

  if (accounts && accounts.length > 0) {
    for (const acc of accounts) {
      keys.push({ apiKey: acc.api_key, apiUrl: acc.api_url || BASE });
    }
  }

  // Fallback: usa env se não tiver contas no banco
  if (keys.length === 0 && KEY) {
    keys.push({ apiKey: KEY, apiUrl: BASE });
  }

  const allChannels: EvoHubChannel[] = [];
  for (const k of keys) {
    try {
      const res = await fetch(`${k.apiUrl}/api/v1/channels`, {
        headers: { Authorization: `Bearer ${k.apiKey}` },
        next: { revalidate: 30 },
      });
      const data = await res.json();
      if (!data.channels) continue;
      // A LISTA do EvoHub às vezes vem SEM o meta_connection (inconsistente), fazendo um
      // número conectado aparecer como "Pendente". Pros canais que parecem desconectados,
      // busca o DETALHE (que traz o meta_connection real) usando a MESMA key da conta.
      const merged = await Promise.all(
        (data.channels as EvoHubChannel[]).map(async (ch) => {
          const hasConnected = ch.meta_connection?.phone_numbers?.some((p) => p.status === "CONNECTED");
          if (ch.status === "active" || hasConnected) return ch;
          try {
            const dr = await fetch(`${k.apiUrl}/api/v1/channels/${ch.id}`, {
              headers: { Authorization: `Bearer ${k.apiKey}` },
              cache: "no-store",
            });
            const detail = await dr.json();
            if (detail?.meta_connection) return { ...ch, meta_connection: detail.meta_connection };
          } catch { /* mantém como veio */ }
          return ch;
        })
      );
      allChannels.push(...merged);
    } catch { /* skip */ }
  }

  return allChannels;
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

// Foto de perfil do número (a que o próprio WhatsApp expõe no business profile).
// A URL é assinada e expira, por isso é buscada fresca a cada listagem.
export async function getProfilePictureFromMeta(channelToken: string, phoneNumberId: string): Promise<string | null> {
  if (!channelToken || !phoneNumberId) return null;
  try {
    const res = await fetch(`${BASE}/meta/v23.0/${phoneNumberId}/whatsapp_business_profile?fields=profile_picture_url`, {
      headers: { Authorization: `Bearer ${channelToken}` },
      cache: "no-store",
    });
    const data = await res.json();
    return data?.data?.[0]?.profile_picture_url || null;
  } catch {
    return null;
  }
}

export async function enrichChannelsWithPhoneNumbers(channels: EvoHubChannel[]): Promise<(EvoHubChannel & { displayPhone?: string; profilePicture?: string })[]> {
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
      const connected = connectedPhoneOf(ch);
      // Corrige o status quando o EvoHub deixa "inactive" mas há número CONNECTED.
      const status = effectiveStatus(ch);
      // phone_number_id: do mapa (canais conhecidos) ou do próprio meta_connection.
      const phoneId = phoneIdMap[ch.id] || ch.meta_connection?.phone_number_id || ch.metadata?.meta_connection?.phone_number_id;
      if (phoneId && ch.token) {
        const [phone, picture] = await Promise.all([
          getPhoneNumberFromMeta(ch.token, phoneId),
          getProfilePictureFromMeta(ch.token, phoneId),
        ]);
        return { ...ch, status, displayPhone: phone || connected?.display_phone_number || undefined, profilePicture: picture || undefined };
      }
      return { ...ch, status, displayPhone: connected?.display_phone_number || undefined };
    })
  );
}
