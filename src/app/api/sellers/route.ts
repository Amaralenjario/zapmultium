import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  // Fallback to anon key
  return createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET() {
  try {
    const supabase = getClient();
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, role, is_active, created_at")
      .eq("is_active", true);

    const { data: sellerChannels } = await supabase.from("seller_channels").select("user_id, evohub_channel_id");
    const channelMap: Record<string, string> = {};
    for (const sc of sellerChannels || []) {
      if (sc.user_id && sc.evohub_channel_id) channelMap[sc.user_id] = sc.evohub_channel_id;
    }

    const { data: opChannels } = await supabase
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { name, email, password, role, evohub_channel_id } = await request.json();
  if (!email || !password) return NextResponse.json({ error: "Email e senha obrigatórios" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres" }, { status: 400 });

  const normalizedEmail = email.trim().toLowerCase();
  const fullName = name?.trim() || email;
  let userId: string | null = null;

  // Try admin.createUser first (requires SUPABASE_SERVICE_ROLE_KEY)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (!authError && authData?.user) {
      userId = authData.user.id;
    }
    // If admin fails, log and fall through to signUp
  }

  // Fallback: use signUp with anon key (works without service role key)
  if (!userId) {
    const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: signUpData, error: signUpError } = await anonClient.auth.signUp({
      email: normalizedEmail,
      password,
      options: { data: { full_name: fullName } },
    });
    if (signUpError || !signUpData?.user) {
      return NextResponse.json({
        error: signUpError?.message || (serviceKey ? "Falha ao criar usuário (admin e signUp)" : "Falha ao criar usuário. Verifique SUPABASE_SERVICE_ROLE_KEY no Vercel."),
      }, { status: 400 });
    }
    userId = signUpData.user.id;
  }

  // Save profile + channel
  const profileClient = serviceKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

  await profileClient.from("profiles").upsert({
    id: userId, full_name: fullName,
    email: normalizedEmail, role: role || "operator", is_active: true,
  });

  // Save channel assignment (works with anon key if RLS not enabled)
  if (evohub_channel_id) {
    try {
      await profileClient.from("seller_channels").delete().eq("user_id", userId);
      await profileClient.from("seller_channels").insert({ user_id: userId, evohub_channel_id });
    } catch {}
  }

  return NextResponse.json({ id: userId, name: fullName, email: normalizedEmail, role: role || "operator" }, { status: 201 });
}
