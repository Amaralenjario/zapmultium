import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import webpush from "web-push";

// Envia uma notificação de teste pras inscrições do próprio usuário logado.
export async function POST() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) return NextResponse.json({ error: "Servidor sem chaves VAPID configuradas" }, { status: 503 });
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contato@zapmultium.com", pub, priv);

    const admin = createAdminClient();
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", user.id);
    if (!subs || subs.length === 0) return NextResponse.json({ error: "Nenhuma inscrição ativa neste aparelho" }, { status: 400 });

    const payload = JSON.stringify({
      title: "🔔 Teste — ZapMultium",
      body: "As notificações estão funcionando! Você será avisado quando chegar mensagem de um lead.",
      url: "/dashboard/chat-ao-vivo",
      tag: "teste",
    });

    let ok = 0;
    for (const s of subs as any[]) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        ok++;
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    }
    return NextResponse.json({ ok: true, sent: ok });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
