import { NextResponse } from "next/server";
import { listChannelsForUser, enrichChannelsWithPhoneNumbers } from "@/lib/evohub";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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
      phoneId: row.phone_number_id || "",
      opName: op?.name || row.evohub_channel_name,
      opColor: op?.color || "#6b7280",
      opId: op?.id || "",
    };
  }

  return NextResponse.json({ channels: enriched, phoneMap });
}
