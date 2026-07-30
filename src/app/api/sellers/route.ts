import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET() {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, role, is_active, created_at");

  const { data: sellerChannels } = await supabase.from("seller_channels").select("user_id, evohub_channel_id");

  // Build channel map: user_id → evohub_channel_id
  const channelMap: Record<string, string> = {};
  for (const sc of sellerChannels || []) {
    if (sc.user_id && sc.evohub_channel_id) channelMap[sc.user_id] = sc.evohub_channel_id;
  }

  // Fetch channel names from operations_channels
  const { data: opChannels } = await supabase
    .from("operations_channels")
    .select("evohub_channel_id, evohub_channel_name, phone_number_id, operation:operation_id(name)")
    .eq("is_active", true);

  const channelNameMap: Record<string, { name: string; phoneId: string; opName: string }> = {};
  for (const oc of opChannels || []) {
    const op = Array.isArray(oc.operation) ? oc.operation[0] : oc.operation;
    channelNameMap[oc.evohub_channel_id] = {
      name: oc.evohub_channel_name || "",
      phoneId: oc.phone_number_id || "",
      opName: op?.name || "",
    };
  }

  const { data: sellers } = await supabase.from("vendedores").select("*");

  const merged = (profiles || []).map((p) => {
    const seller = (sellers || []).find((s) => s.nome === p.full_name || s.id === p.id);
    const chId = channelMap[p.id] || "";
    const chInfo = chId ? channelNameMap[chId] : null;
    return {
      id: p.id,
      name: p.full_name,
      email: p.email || "",
      avatar_url: p.avatar_url,
      role: p.role,
      is_active: p.is_active,
      instancia: chInfo?.name || chInfo?.opName || seller?.instancia_evolution || null,
      evohub_channel_id: chId || null,
      created_at: p.created_at,
    };
  });

  for (const s of sellers || []) {
    if (!merged.find((m) => m.name === s.nome)) {
      const chId = channelMap[s.id] || "";
      const chInfo = chId ? channelNameMap[chId] : null;
      merged.push({
        id: s.id,
        name: s.nome,
        email: "",
        avatar_url: null,
        role: "operator",
        is_active: true,
        instancia: chInfo?.name || chInfo?.opName || s.instancia_evolution || null,
        evohub_channel_id: chId || null,
        created_at: s.created_at,
      });
    }
  }

  return NextResponse.json(merged);
}

export async function POST(request: Request) {
  const { name, email, password, role, evohub_channel_id } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email e senha obrigatórios" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres" }, { status: 400 });
  }

  // Criar usuário no Auth com email auto-confirmado
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { full_name: name?.trim() || email },
  });

  if (authError || !authData?.user) {
    console.error("Erro ao criar auth user:", authError);
    return NextResponse.json({
      error: authError?.message || "Falha ao criar usuário. Verifique o email e a senha.",
      code: authError?.status || 500,
    }, { status: 400 });
  }

  const userId = authData.user.id;

  // Criar perfil - upsert sem especificar coluna de conflito (usa PK)
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    full_name: name?.trim() || email,
    email: email.trim().toLowerCase(),
    role: role || "operator",
    is_active: true,
  });

  if (profileError) {
    console.error("Erro ao criar profile:", profileError);
    // Remove o auth user se o profile falhar (rollback)
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Falha ao criar perfil do vendedor" }, { status: 500 });
  }

  // Save channel assignment
  if (evohub_channel_id) {
    await supabase.from("seller_channels").delete().eq("user_id", userId);
    await supabase.from("seller_channels").insert({ user_id: userId, evohub_channel_id });
  }

  return NextResponse.json({
    id: userId,
    name: name?.trim() || email,
    email: email.trim().toLowerCase(),
    role: role || "operator",
  }, { status: 201 });
}
