import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveExtensionKey, sellerPhoneNumberIds, CORS } from "@/lib/extension-auth";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Dispara um fluxo pra um lead (por número), vindo da extensão do WhatsApp Web.
// Faz find-or-create da conversa e usa o motor (startFlow) — mesmo caminho do painel.
export async function POST(request: Request) {
  try {
    const key = request.headers.get("x-zpx-key");
    const actor = await resolveExtensionKey(key);
    if (!actor) return NextResponse.json({ error: "Código inválido" }, { status: 401, headers: CORS });

    const body = await request.json();
    const flowId = body?.flow_id;
    const leadPhone = String(body?.lead_phone || "").replace(/\D/g, ""); // só dígitos
    let phoneNumberId = body?.phone_number_id ? String(body.phone_number_id) : "";
    if (!flowId || !leadPhone) {
      return NextResponse.json({ error: "flow_id e lead_phone são obrigatórios" }, { status: 400, headers: CORS });
    }

    const admin = createAdminClient();
    const isAdmin = actor.role === "admin" || actor.role === "supervisor";
    const myPhones = await sellerPhoneNumberIds(actor.userId);

    // 1) cliente (find-or-create por telefone, robusto a corrida — 4 tentativas)
    let customerId: string | null = null;
    for (let i = 0; i < 4 && !customerId; i++) {
      const { data: found } = await admin.from("customers").select("id").eq("phone", leadPhone).maybeSingle();
      if (found) { customerId = found.id; break; }
      const { data: created, error } = await admin.from("customers").insert({ name: leadPhone, phone: leadPhone, last_interaction_at: new Date().toISOString() }).select("id").single();
      if (created?.id) { customerId = created.id; break; }
      if (error?.code !== "23505" && i < 3) await new Promise((r) => setTimeout(r, 150 * (i + 1)));
    }
    if (!customerId) return NextResponse.json({ error: "Não foi possível resolver o lead" }, { status: 500, headers: CORS });

    // 2) DE QUAL número disparar + a conversa.
    // Preferência: a conversa ATIVA que o lead JÁ tem num canal do vendedor (o número onde
    // ele está falando de fato). Isso resolve o vendedor com VÁRIOS números (ex.: Luiz) — não
    // precisa escolher, usa onde o lead está.
    let conversationId: string | null = null;
    const { data: activeConvs } = await admin
      .from("conversations")
      .select("id, metadata")
      .eq("customer_id", customerId).eq("status", "active")
      .order("last_message_at", { ascending: false, nullsFirst: false });
    for (const c of activeConvs || []) {
      const pid = (c as any).metadata?.phone_number_id;
      if (pid && (isAdmin || myPhones.includes(pid))) { conversationId = c.id; phoneNumberId = pid; break; }
    }

    // Sem conversa existente num canal do vendedor → precisa decidir o número e criar a conversa.
    if (!conversationId) {
      if (phoneNumberId) {
        if (!isAdmin && !myPhones.includes(phoneNumberId)) return NextResponse.json({ error: "Esse número não é seu" }, { status: 403, headers: CORS });
      } else if (myPhones.length === 1) {
        phoneNumberId = myPhones[0];
      } else if (myPhones.length === 0) {
        return NextResponse.json({ error: "Você não tem número vinculado" }, { status: 400, headers: CORS });
      } else {
        return NextResponse.json({ error: "Lead sem conversa — informe de qual número disparar", need_phone: true, phones: myPhones }, { status: 409, headers: CORS });
      }
      for (let i = 0; i < 4 && !conversationId; i++) {
        const { data: found } = await admin.from("conversations").select("id").eq("customer_id", customerId).eq("status", "active").filter("metadata->>phone_number_id", "eq", phoneNumberId).limit(1);
        if (found && found.length > 0) { conversationId = found[0].id; break; }
        const { data: created, error } = await admin.from("conversations").insert({ customer_id: customerId, status: "active", source: "extension", unread_count: 0, metadata: { phone_number_id: phoneNumberId } }).select("id").single();
        if (created?.id) { conversationId = created.id; break; }
        if (error?.code !== "23505" && i < 3) await new Promise((r) => setTimeout(r, 150 * (i + 1)));
      }
    }
    if (!conversationId || !phoneNumberId) return NextResponse.json({ error: "Não foi possível abrir a conversa" }, { status: 500, headers: CORS });

    // 3) dispara pelo motor EM BACKGROUND (waitUntil) → resposta INSTANTÂNEA pra extensão.
    // O vendedor não espera o 1º envio: já pode navegar/disparar o próximo. O startFlow
    // trata dup/fila e o processamento segue no servidor mesmo após responder.
    const { startFlow } = await import("@/lib/flow-engine");
    waitUntil(startFlow({ flow_id: flowId, conversation_id: conversationId, customer_phone: leadPhone, phone_number_id: phoneNumberId }).catch(() => {}));

    return NextResponse.json({ ok: true, message: "Disparando…", conversation_id: conversationId }, { headers: CORS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS });
  }
}
