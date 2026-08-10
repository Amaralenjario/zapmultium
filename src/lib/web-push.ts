import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

// Configura o web-push com as chaves VAPID (uma vez por processo).
let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contato@zapmultium.com";
  if (!pub || !priv) return false; // sem chaves → push desligado (não quebra nada)
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export function pushEnabled(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

interface SubRow { id: string; endpoint: string; p256dh: string; auth: string }

// Envia um push pra uma inscrição. Remove a inscrição se ela expirou (404/410).
async function sendOne(supabase: SupabaseClient, sub: SubRow, payload: string): Promise<void> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload
    );
  } catch (err: any) {
    const code = err?.statusCode;
    if (code === 404 || code === 410) {
      // Inscrição morta (app desinstalado / permissão revogada) → limpa.
      await supabase.from("push_subscriptions").delete().eq("id", sub.id);
    }
  }
}

// Notifica os vendedores donos do canal (phone_number_id) sobre uma mensagem nova do lead.
// Fail-safe: qualquer erro aqui NUNCA deve quebrar a ingestão da mensagem.
export async function notifyNewMessage(
  supabase: SupabaseClient,
  args: { phoneNumberId: string; conversationId: string; customerName: string; content: string }
): Promise<void> {
  try {
    if (!ensureConfigured()) return;
    const { phoneNumberId, conversationId, customerName, content } = args;
    if (!phoneNumberId) return;

    // phone_number_id → evohub_channel_id(s) → user_id(s) dos vendedores desse canal
    const { data: oc } = await supabase
      .from("operations_channels")
      .select("evohub_channel_id")
      .eq("phone_number_id", phoneNumberId);
    const evohubIds = (oc || []).map((r: any) => r.evohub_channel_id).filter(Boolean);
    if (evohubIds.length === 0) return;

    const { data: sc } = await supabase
      .from("seller_channels")
      .select("user_id")
      .in("evohub_channel_id", evohubIds);
    const userIds = Array.from(new Set((sc || []).map((r: any) => r.user_id).filter(Boolean)));
    if (userIds.length === 0) return;

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", userIds);
    if (!subs || subs.length === 0) return;

    const payload = JSON.stringify({
      title: customerName || "Novo lead",
      body: (content || "Nova mensagem").slice(0, 140),
      url: `/dashboard/chat-ao-vivo?c=${conversationId}`,
      tag: conversationId, // agrupa por conversa (não empilha 10 notificações do mesmo lead)
    });

    await Promise.allSettled((subs as SubRow[]).map((s) => sendOne(supabase, s, payload)));
  } catch {
    // silencioso de propósito — push é "best effort"
  }
}
