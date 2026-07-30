import { createClient } from "@/lib/supabase/server";

export interface Operation {
  id: string;
  name: string;
  slug: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  channels?: OperationChannel[];
}

export interface OperationChannel {
  id: string;
  operation_id: string;
  evohub_channel_id: string;
  evohub_channel_name: string;
  phone_number_id: string | null;
  is_active: boolean;
}

export async function getAllOperations() {
  const supabase = createClient();
  const { data } = await supabase
    .from("operations")
    .select("*, channels:operations_channels(*)")
    .eq("is_active", true)
    .order("name");
  return data || [];
}

export async function getOperationByPhoneId(phoneNumberId: string) {
  if (!phoneNumberId) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("operations_channels")
    .select("operation:operation_id(*), evohub_channel_name")
    .eq("phone_number_id", phoneNumberId)
    .eq("is_active", true)
    .single();
  const op = data?.operation;
  return Array.isArray(op) ? op[0] : op || null;
}

export async function getOperationName(phoneNumberId: string): Promise<string | null> {
  const op = await getOperationByPhoneId(phoneNumberId);
  return op?.name || null;
}

export async function getOperationColor(phoneNumberId: string): Promise<string> {
  const op = await getOperationByPhoneId(phoneNumberId);
  return op?.color || "#6b7280";
}
