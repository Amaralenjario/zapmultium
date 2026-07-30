import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente (Vercel > Settings > Environment Variables)");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET() {
  try {
    const supabase = getAdminClient();
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

  try {
    const supabase = getAdminClient();

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: name?.trim() || email },
    });

    if (authError || !authData?.user) {
      return NextResponse.json({
        error: authError?.message || "Falha ao criar usuário. Verifique a variável SUPABASE_SERVICE_ROLE_KEY no Vercel.",
        code: authError?.status || 500,
      }, { status: 400 });
    }

    const userId = authData.user.id;

    await supabase.from("profiles").upsert({
      id: userId, full_name: name?.trim() || email,
      email: email.trim().toLowerCase(), role: role || "operator", is_active: true,
    });

    if (evohub_channel_id) {
      await supabase.from("seller_channels").delete().eq("user_id", userId);
      await supabase.from("seller_channels").insert({ user_id: userId, evohub_channel_id });
    }

    return NextResponse.json({ id: userId, name, email, role: role || "operator" }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro interno. Verifique SUPABASE_SERVICE_ROLE_KEY no Vercel." }, { status: 500 });
  }
}
