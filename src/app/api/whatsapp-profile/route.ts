import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSb } from "@supabase/supabase-js";
import { getRealChannelToken } from "@/lib/instances";
import { resolveChannelMaps } from "@/lib/attribution";

export const dynamic = "force-dynamic";

const BASE = process.env.EVOHUB_API_URL || "https://api.evohub.ai";

// Campos editáveis do perfil comercial (Business Profile API do WhatsApp Cloud).
const PROFILE_FIELDS = "about,address,description,email,profile_picture_url,websites,vertical";

// Resolve os canais (número) do usuário logado.
async function resolveUserChannels(userId: string) {
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = createSb(process.env.NEXT_PUBLIC_SUPABASE_URL!, svcKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { channelToPhone } = await resolveChannelMaps(admin);
  const { data: sc } = await admin.from("seller_channels").select("evohub_channel_id").eq("user_id", userId);
  const out: { channelId: string; phoneId: string }[] = [];
  for (const s of sc || []) {
    const phoneId = channelToPhone[s.evohub_channel_id];
    if (phoneId) out.push({ channelId: s.evohub_channel_id, phoneId });
  }
  return out;
}

async function metaGet(phoneId: string, token: string, path = "", query = "") {
  const url = `${BASE}/meta/v23.0/${phoneId}${path}${query}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  return res.json();
}

export async function GET(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const channels = await resolveUserChannels(user.id);
  if (channels.length === 0) {
    return NextResponse.json({ channels: [], selected: null });
  }

  // Info básica (número + nome) de cada canal, pra listar/trocar.
  const list = await Promise.all(channels.map(async (c) => {
    const token = await getRealChannelToken(c.channelId);
    if (!token) return { phoneId: c.phoneId, number: null, name: null };
    const info = await metaGet(c.phoneId, token, "", "?fields=display_phone_number,verified_name").catch(() => ({}));
    return { phoneId: c.phoneId, number: info?.display_phone_number || null, name: info?.verified_name || null };
  }));

  const wanted = new URL(request.url).searchParams.get("phoneId");
  const sel = channels.find((c) => c.phoneId === wanted) || channels[0];
  const selToken = await getRealChannelToken(sel.channelId);
  const selInfo = list.find((l) => l.phoneId === sel.phoneId);

  let profile: any = {};
  if (selToken) {
    const resp = await metaGet(sel.phoneId, selToken, "/whatsapp_business_profile", `?fields=${PROFILE_FIELDS}`).catch(() => ({}));
    profile = (resp?.data && resp.data[0]) || {};
  }

  return NextResponse.json({
    channels: list,
    selected: {
      phoneId: sel.phoneId,
      number: selInfo?.number || null,
      name: selInfo?.name || null,
      profilePicture: profile.profile_picture_url || null,
      about: profile.about || "",
      description: profile.description || "",
      address: profile.address || "",
      email: profile.email || "",
      websites: Array.isArray(profile.websites) ? profile.websites : [],
      vertical: profile.vertical || "",
    },
  });
}

export async function PUT(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json();
  const { phoneId } = body;
  if (!phoneId) return NextResponse.json({ error: "phoneId obrigatório" }, { status: 400 });

  // Segurança: o número precisa pertencer ao usuário.
  const channels = await resolveUserChannels(user.id);
  const ch = channels.find((c) => c.phoneId === phoneId);
  if (!ch) return NextResponse.json({ error: "Número não pertence a você" }, { status: 403 });

  // Escrita do perfil exige token com permissão whatsapp_business_management.
  // O channel token do EvoHub só tem escopo de mensagens (GET ok, POST dá #200).
  // Se houver um token da Meta (System User, EAA...) em META_MGMT_TOKEN, grava direto no Graph.
  const mgmt = process.env.META_MGMT_TOKEN;
  const token = mgmt || await getRealChannelToken(ch.channelId);
  if (!token) return NextResponse.json({ error: "Token do canal indisponível" }, { status: 502 });
  // Com token de gerenciamento, vai direto na Graph API; senão, pelo proxy do EvoHub.
  const endpoint = mgmt
    ? `https://graph.facebook.com/v23.0/${phoneId}/whatsapp_business_profile`
    : `${BASE}/meta/v23.0/${phoneId}/whatsapp_business_profile`;

  // Monta só os campos enviados (limites da API oficial).
  const payload: any = { messaging_product: "whatsapp" };
  if (body.about !== undefined) payload.about = String(body.about).slice(0, 139);
  if (body.description !== undefined) payload.description = String(body.description).slice(0, 512);
  if (body.address !== undefined) payload.address = String(body.address).slice(0, 256);
  if (body.email !== undefined) payload.email = String(body.email).slice(0, 128);
  if (body.vertical !== undefined) payload.vertical = body.vertical || "UNDEFINED";
  if (body.websites !== undefined) {
    payload.websites = (Array.isArray(body.websites) ? body.websites : [])
      .map((w: string) => (w || "").trim())
      .filter(Boolean)
      .slice(0, 2);
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    const code = data?.error?.code;
    // #200 = token sem permissão de gerenciar o perfil (escopo do gateway/EvoHub).
    const msg = code === 200
      ? "Edição bloqueada pelo provedor: o token do número ainda não tem permissão para gerenciar o perfil comercial. (pendência com o EvoHub)"
      : (data?.error?.message || "Falha ao atualizar perfil");
    return NextResponse.json({ error: msg, code }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
