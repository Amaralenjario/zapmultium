import type { SupabaseClient } from "@supabase/supabase-js";

// phone_number_ids conhecidos por canal (fallback), espelhando o dashboard.
const KNOWN_PHONES: Record<string, string> = {
  "5145a0c0-a358-43e5-8269-c5ace26ca023": "897878513398151",
  "effa72d1-47f6-445b-acbc-7693ef21ee24": "976034132269824",
  "c5505ddf-f9ef-4837-9337-45ed3de40d6a": "892228177298374",
  "346e4eef-bc78-41ec-a7ae-ec7ec75bf177": "1034222499765101",
  "b1c6879b-e962-4f50-95f7-14f1a04601a5": "1234821229708132",
};

export interface ChannelMaps {
  channelToPhone: Record<string, string>;      // evohub_channel_id -> phone_number_id
  phoneToSeller: Record<string, string>;        // phone_number_id -> user_id (vendedor)
  sellerToPhones: Record<string, string[]>;     // user_id -> phone_number_ids
  phoneToOp: Record<string, { name: string; color: string }>;
  phoneToName: Record<string, string>;
  allPhones: string[];
}

// Resolve os mapas de canal↔telefone↔vendedor↔operação (server-side, usa admin client).
export async function resolveChannelMaps(admin: SupabaseClient): Promise<ChannelMaps> {
  const { data: opChannels } = await admin
    .from("operations_channels")
    .select("phone_number_id, evohub_channel_id, evohub_channel_name, operation:operation_id(name, color)")
    .eq("is_active", true);

  const phoneToOp: Record<string, { name: string; color: string }> = {};
  const phoneToName: Record<string, string> = {};
  const channelToPhone: Record<string, string> = { ...KNOWN_PHONES };
  const allPhones: string[] = [];

  for (const ch of opChannels || []) {
    const op = Array.isArray((ch as any).operation) ? (ch as any).operation[0] : (ch as any).operation;
    if (ch.phone_number_id) {
      if (op) phoneToOp[ch.phone_number_id] = { name: op.name, color: op.color };
      if (ch.evohub_channel_name) phoneToName[ch.phone_number_id] = ch.evohub_channel_name;
      if (ch.evohub_channel_id) channelToPhone[ch.evohub_channel_id] = ch.phone_number_id;
      allPhones.push(ch.phone_number_id);
    }
  }

  const phoneToSeller: Record<string, string> = {};
  const sellerToPhones: Record<string, string[]> = {};
  const { data: sc } = await admin.from("seller_channels").select("user_id, evohub_channel_id");
  for (const s of sc || []) {
    const phone = channelToPhone[s.evohub_channel_id];
    if (!phone) continue;
    phoneToSeller[phone] = s.user_id;
    (sellerToPhones[s.user_id] = sellerToPhones[s.user_id] || []).push(phone);
  }

  return { channelToPhone, phoneToSeller, sellerToPhones, phoneToOp, phoneToName, allPhones };
}

// Janela de datas no fuso do Brasil, alinhada com o dashboard.
export function rankingDateRange(range: string): { startISO: string; endISO: string } {
  const TZ = "-03:00";
  const now = new Date();
  let brToday: string;
  try {
    brToday = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  } catch {
    brToday = new Date(now.getTime() - 3 * 3600000).toISOString().split("T")[0];
  }
  const todayEnd = new Date(brToday + "T23:59:59.999" + TZ);
  if (range === "geral") {
    return { startISO: new Date("2000-01-01T00:00:00Z").toISOString(), endISO: todayEnd.toISOString() };
  }
  if (range === "hoje") {
    return { startISO: new Date(brToday + "T00:00:00" + TZ).toISOString(), endISO: todayEnd.toISOString() };
  }
  const days: Record<string, number> = { "7d": 6, "30d": 29 };
  const daysBack = days[range] ?? 6;
  const rangeStart = new Date(brToday + "T00:00:00" + TZ);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - daysBack);
  return { startISO: rangeStart.toISOString(), endISO: todayEnd.toISOString() };
}
