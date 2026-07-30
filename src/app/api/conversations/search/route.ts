import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  const supabase = getAdminClient();
  const pattern = `%${q}%`;

  // 1. Find matching customers
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, phone")
    .or(`name.ilike.${pattern},phone.ilike.${pattern}`)
    .limit(30);

  const customerIds = (customers || []).map((c) => c.id);

  // 2. Find conversations with matching customers OR messages
  let convIds = new Set<string>();

  if (customerIds.length > 0) {
    const { data: convsByCustomer } = await supabase
      .from("conversations")
      .select("id")
      .in("customer_id", customerIds)
      .limit(50);
    (convsByCustomer || []).forEach((c) => convIds.add(c.id));
  }

  // 3. Find conversations with matching messages
  const { data: msgs } = await supabase
    .from("messages")
    .select("conversation_id")
    .ilike("content", pattern)
    .limit(50);

  (msgs || []).forEach((m) => convIds.add(m.conversation_id));

  if (convIds.size === 0) return NextResponse.json([]);

  // 4. Fetch full conversations
  const ids = Array.from(convIds).slice(0, 50);
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, status, archived, last_message, last_message_at, last_message_sender, last_message_read, unread_count, created_at, metadata, customer:customer_id(name, phone, avatar_url)")
    .in("id", ids)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);

  return NextResponse.json(conversations || []);
}
