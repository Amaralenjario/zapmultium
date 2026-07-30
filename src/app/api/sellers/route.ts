import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Check role
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "supervisor") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const adminClient = getAdminClient() || supabase;

  const { data: profiles } = await adminClient
    .from("profiles")
    .select("id, full_name, email, avatar_url, role, is_active, created_at")
    .eq("is_active", true);

  const { data: sellerChannels } = await adminClient.from("seller_channels").select("user_id, evohub_channel_id");
  const channelMap: Record<string, string> = {};
  for (const sc of sellerChannels || []) {
    if (sc.user_id && sc.evohub_channel_id) channelMap[sc.user_id] = sc.evohub_channel_id;
  }

  const { data: opChannels } = await adminClient
    .from("operations_channels")
    .select("evohub_channel_id, evohub_channel_name, phone_number_id, operation:operation_id(name)")
    .eq("is_active", true);

  const channelNameMap: Record<string, { name: string; phoneId: string; opName: string }> = {};
  for (const oc of opChannels || []) {
    const op = Array.isArray(oc.operation) ? oc.operation[0] : oc.operation;
    channelNameMap[oc.evohub_channel_id] = { name: oc.evohub_channel_name || "", phoneId: oc.phone_number_id || "", opName: op?.name || "" };
  }

  const merged = (profiles || []).map((p) => {
    const chId = channelMap[p.id] || "";
    const chInfo = chId ? channelNameMap[chId] : null;
    return {
      id: p.id, name: p.full_name, email: p.email || "",
      avatar_url: p.avatar_url, role: p.role, is_active: p.is_active,
      instancia: chInfo?.name || chInfo?.opName || null,
      evohub_channel_id: chId || null, created_at: p.created_at,
    };
  });

  return NextResponse.json(merged);
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { name, email, password, role, evohub_channel_id } = await request.json();
  if (!email || !password) return NextResponse.json({ error: "Email e senha obrigatórios" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres" }, { status: 400 });

  const normalizedEmail = email.trim().toLowerCase();
  const fullName = name?.trim() || email;
  let userId: string | null = null;

  // Try admin.createUser first
  const adminClient = getAdminClient();
  if (adminClient) {
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail, password, email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (!authError && authData?.user) userId = authData.user.id;
  }

  // Fallback to signUp
  if (!userId) {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail, password,
      options: { data: { full_name: fullName } },
    });
    if (signUpError || !signUpData?.user) {
      return NextResponse.json({ error: signUpError?.message || "Falha ao criar usuário" }, { status: 400 });
    }
    userId = signUpData.user.id;
  }

  // Save profile - use admin client if available
  const dbClient = adminClient || supabase;
  await dbClient.from("profiles").upsert({
    id: userId, full_name: fullName, email: normalizedEmail,
    role: role || "operator", is_active: true,
  });

  if (evohub_channel_id) {
    await dbClient.from("seller_channels").delete().eq("user_id", userId);
    await dbClient.from("seller_channels").insert({ user_id: userId, evohub_channel_id });
  }

  return NextResponse.json({ id: userId, name: fullName, email: normalizedEmail, role: role || "operator" }, { status: 201 });
}
