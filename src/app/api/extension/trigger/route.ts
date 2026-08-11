import { NextResponse } from "next/server";
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

    // Resolve o número do vendedor (de qual canal a mensagem sai).
    const myPhones = await sellerPhoneNumberIds(actor.userId);
    if (phoneNumberId) {
      // se passou um, precisa ser um canal do vendedor (admin pode qualquer um)
      if (actor.role !== "admin" && actor.role !== "supervisor" && !myPhones.includes(phoneNumberId)) {
        return NextResponse.json({ error: "Esse número não é seu" }, { status: 403, headers: CORS });
      }
    } else {
      if (myPhones.length === 0) return NextResponse.json({ error: "Você não tem número vinculado" }, { status: 400, headers: CORS });
      if (myPhones.length > 1) return NextResponse.json({ error: "Você tem mais de um número — a extensão precisa informar qual", need_phone: true, phones: myPhones }, { status: 409, headers: CORS });
      phoneNumberId = myPhones[0];
    }

    const admin = createAdminClient();

    // 1) cliente (find-or-create por telefone, sem sobrescrever nome existente)
    let customerId: string | null = null;
    const { data: existingCust } = await admin.from("customers").select("id").eq("phone", leadPhone).maybeSingle();
    if (existingCust) customerId = existingCust.id;
    else {
      const { data: created } = await admin.from("customers").insert({ name: leadPhone, phone: leadPhone, last_interaction_at: new Date().toISOString() }).select("id").single();
      customerId = created?.id || null;
      if (!customerId) {
        const { data: again } = await admin.from("customers").select("id").eq("phone", leadPhone).maybeSingle();
        customerId = again?.id || null;
      }
    }
    if (!customerId) return NextResponse.json({ error: "Não foi possível resolver o lead" }, { status: 500, headers: CORS });

    // 2) conversa ativa desse cliente NESSE número (find-or-create)
    let conversationId: string | null = null;
    const { data: conv } = await admin.from("conversations").select("id").eq("customer_id", customerId).eq("status", "active").filter("metadata->>phone_number_id", "eq", phoneNumberId).limit(1);
    if (conv && conv.length > 0) conversationId = conv[0].id;
    else {
      const { data: newConv } = await admin.from("conversations").insert({ customer_id: customerId, status: "active", source: "extension", unread_count: 0, metadata: { phone_number_id: phoneNumberId } }).select("id").single();
      conversationId = newConv?.id || null;
      if (!conversationId) {
        const { data: again } = await admin.from("conversations").select("id").eq("customer_id", customerId).eq("status", "active").filter("metadata->>phone_number_id", "eq", phoneNumberId).limit(1);
        conversationId = again?.[0]?.id || null;
      }
    }
    if (!conversationId) return NextResponse.json({ error: "Não foi possível abrir a conversa" }, { status: 500, headers: CORS });

    // 3) dispara pelo motor (mesmo caminho do painel: trata dup/fila/processa)
    const { startFlow } = await import("@/lib/flow-engine");
    const result = await startFlow({ flow_id: flowId, conversation_id: conversationId, customer_phone: leadPhone, phone_number_id: phoneNumberId });

    const msg: Record<string, string> = {
      started: "Fluxo disparado!",
      queued: "Fluxo na fila (já tem um rodando nessa conversa).",
      already_active: "Esse fluxo já está ativo nessa conversa.",
      no_start: "Fluxo sem nó de início.",
      not_found: "Fluxo não encontrado.",
    };
    const ok = result === "started" || result === "queued";
    return NextResponse.json({ ok, result, message: msg[result] || result, conversation_id: conversationId }, { headers: CORS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: CORS });
  }
}
