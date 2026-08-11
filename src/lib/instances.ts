const instanceMap: Record<string, { name: string; channelId: string; channelToken: string }> = {
  "897878513398151": { name: "VH - 1692", channelId: "5145a0c0-a358-43e5-8269-c5ace26ca023", channelToken: "aef5c1f70c114c8e0b3c8b2a5d6e7f8a" },
  "892228177298374": { name: "GUSTAVO - LUIS", channelId: "c5505ddf-f9ef-4837-9337-45ed3de40d6a", channelToken: "ff852b8e48eea68b9c0d1e2f3a4b5c6d7" },
  "1034222499765101": { name: "AMANDA - JÉ", channelId: "346e4eef-bc78-41ec-a7ae-ec7ec75bf177", channelToken: "a4a499ac2e7791df0e1f2a3b4c5d6e7f" },
  "976034132269824": { name: "GABI - 8176", channelId: "effa72d1-47f6-445b-acbc-7693ef21ee24", channelToken: "573ce80fda8e16ab0d1e2f3a4b5c6d7e8" },
  "1234821229708132": { name: "NC - CAIO", channelId: "b1c6879b-e962-4f50-95f7-14f1a04601a5", channelToken: "031d4b9bed27fdce0f1e2a3b4c5d6e7f8" },
  "1077309398802921": { name: "GUILHERME - CAIO", channelId: "0bce92b7-b6a9-4859-ac87-bc2ed01719e1", channelToken: "396e9d12c45b0462e1951a6abdbbc1c6dc2a2cf9a021124762ef60ee87064b76" },
  "1050317928161978": { name: "DANI", channelId: "004d0718-04ae-4af5-b55b-aaa5136d1138", channelToken: "963aa979413f414c4d88acb2f417bbe8b9a62abbddaf2eef6d87ec4336209c48" },
};

export function getInstanceByPhoneId(phoneNumberId: string) {
  return instanceMap[phoneNumberId] || null;
}

// Resolve o evohub_channel_id de um número. Primeiro o mapa fixo (rápido), senão o BANCO
// (operations_channels) — assim QUALQUER número cadastrado funciona, sem depender do mapa
// hardcoded. Era a causa de "Canal não encontrado" nos números novos (ex.: RESERVA do Luiz).
export async function resolveChannelId(phoneNumberId: string): Promise<string | null> {
  const fromMap = instanceMap[phoneNumberId]?.channelId;
  if (fromMap) return fromMap;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data } = await supabase
      .from("operations_channels")
      .select("evohub_channel_id")
      .eq("phone_number_id", phoneNumberId)
      .eq("is_active", true)
      .maybeSingle();
    return (data as any)?.evohub_channel_id || null;
  } catch {
    return null;
  }
}

export function getInstanceName(phoneNumberId: string): string | null {
  return instanceMap[phoneNumberId]?.name || null;
}

// Cache do token por canal (evita bater no Supabase + EvoHub a cada mensagem enviada).
const tokenCache = new Map<string, { token: string; exp: number }>();
const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 min

export async function getRealChannelToken(channelId: string): Promise<string | null> {
  const cached = tokenCache.get(channelId);
  if (cached && cached.exp > Date.now()) return cached.token;
  try {
    // Tenta pegar token real via API da EvoHub
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Buscar conta EvoHub do canal
    let apiKey = process.env.EVOHUB_API_KEY;
    let apiUrl = process.env.EVOHUB_API_URL || "https://api.evohub.ai";

    const { data: opCh } = await supabase
      .from("operations_channels")
      .select("evo_account_id, evo_account:evo_account_id(api_key, api_url)")
      .eq("evohub_channel_id", channelId)
      .maybeSingle();

    if (opCh) {
      const acc = opCh as any;
      if (acc.evo_account?.api_key) apiKey = acc.evo_account.api_key;
      if (acc.evo_account?.api_url) apiUrl = acc.evo_account.api_url;
    }

    if (!apiKey) return null;

    const res = await fetch(`${apiUrl}/api/v1/channels/${channelId}`, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    });
    const data = await res.json();
    const token = data?.token || null;
    if (token) tokenCache.set(channelId, { token, exp: Date.now() + TOKEN_TTL_MS });
    return token;
  } catch {
    // Fallback: usa o token do instanceMap
    const entry = Object.values(instanceMap).find(i => i.channelId === channelId);
    return entry?.channelToken || null;
  }
}
