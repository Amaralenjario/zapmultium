import { listChannelsForUser, enrichChannelsWithPhoneNumbers } from "@/lib/evohub";
import { createClient } from "@/lib/supabase/server";
import WhatsappPageClient from "./WhatsappPageClient";

const KNOWN_PHONE_IDS: Record<string, string> = {
  "5145a0c0-a358-43e5-8269-c5ace26ca023": "897878513398151",
  "effa72d1-47f6-445b-acbc-7693ef21ee24": "976034132269824",
  "c5505ddf-f9ef-4837-9337-45ed3de40d6a": "892228177298374",
  "346e4eef-bc78-41ec-a7ae-ec7ec75bf177": "1034222499765101",
  "b1c6879b-e962-4f50-95f7-14f1a04601a5": "1234821229708132",
};

export default async function WhatsappsPage() {
  const channels = await listChannelsForUser();
  const enriched = await enrichChannelsWithPhoneNumbers(channels);

  const supabase = createClient();
  const { data: opChannels } = await supabase
    .from("operations_channels")
    .select("evohub_channel_id, phone_number_id, evohub_channel_name, operation:operation_id(id, name, color)")
    .eq("is_active", true);

  const phoneMap: Record<string, { phoneId: string; opName: string; opColor: string; opId: string }> = {};
  for (const row of opChannels || []) {
    const op = Array.isArray(row.operation) ? row.operation[0] : row.operation;
    phoneMap[row.evohub_channel_id] = {
      phoneId: row.phone_number_id || KNOWN_PHONE_IDS[row.evohub_channel_id] || "",
      opName: op?.name || "",
      opColor: op?.color || "#6b7280",
      opId: op?.id || "",
    };
  }

  // Fallback: se canal não tem mapeamento mas conhecemos o phoneId
  for (const ch of enriched) {
    if (!phoneMap[ch.id] && KNOWN_PHONE_IDS[ch.id]) {
      phoneMap[ch.id] = { phoneId: KNOWN_PHONE_IDS[ch.id], opName: "", opColor: "#6b7280", opId: "" };
    }
  }

  return <WhatsappPageClient initialChannels={enriched as any} phoneMap={phoneMap} />;
}
