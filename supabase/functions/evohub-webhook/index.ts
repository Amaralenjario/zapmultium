import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SB_URL")!;
const supabaseKey = Deno.env.get("SB_SERVICE_KEY")!;
const webhookSecret = Deno.env.get("EVOHUB_WEBHOOK_SECRET") || "zapmultium-webhook-secret";

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Helpers resilientes ─────────────────────────────────────────────────────
// O supabase-js NÃO lança em erro de banco: devolve { error }. A versão antiga
// ignorava esse retorno — sob carga (pool/timeout, e a GABI recebe ~1800 leads/
// dia) o insert falhava e a mensagem do lead SUMIA em silêncio. Agora tudo tem
// retry e, se ainda assim falhar, grava um log gritante pra termos rastro.

async function insertMessageWithRetry(row: any, attempts = 4): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const { error } = await supabase.from("messages").insert(row);
    if (!error) return true;
    if (error.code === "23505") return true; // duplicata → já está lá, ok
    if (i < attempts - 1) {
      await sleep(200 * (i + 1)); // 200/400/600ms
    } else {
      console.error(
        "[EvoHub] PERDA DE MENSAGEM — insert falhou após", attempts, "tentativas:",
        error.message, "| conv:", row.conversation_id, "| wa_id:", row?.metadata?.wa_message_id,
      );
    }
  }
  return false;
}

async function upsertCustomerWithRetry(name: string, phone: string, attempts = 4): Promise<{ id: string } | null> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supabase
      .from("customers")
      .upsert({ name, phone, last_interaction_at: new Date().toISOString() }, { onConflict: "phone" })
      .select("id")
      .single();
    if (data?.id) return data as { id: string };
    lastErr = error;
    if (i < attempts - 1) await sleep(200 * (i + 1));
  }
  console.error("[EvoHub] PERDA DE LEAD — upsert do cliente falhou:", lastErr?.message, "| phone:", phone);
  return null;
}

// Resolve (ou cria) a conversa ATIVA do cliente NAQUELE número. Nunca deixa
// convId indefinido em silêncio: se tudo falhar, cai numa conversa ativa
// existente (melhor grudar no canal errado do que PERDER a mensagem) e loga.
async function resolveConversation(custId: string, phoneNumberId: string): Promise<{ id: string; unread: number; isNew: boolean } | null> {
  // 1) Já existe ativa NESTE número?
  for (let i = 0; i < 3; i++) {
    const { data, error } = await supabase
      .from("conversations")
      .select("id, unread_count")
      .eq("customer_id", custId)
      .eq("status", "active")
      .filter("metadata->>phone_number_id", "eq", phoneNumberId)
      .limit(1);
    if (!error) {
      if (data && data.length > 0) return { id: data[0].id, unread: (data[0].unread_count || 0) + 1, isNew: false };
      break; // sem erro e vazio → segue pra criar
    }
    await sleep(200 * (i + 1));
  }

  // 2) Criar. Em corrida (23505) → re-busca a que o outro processo criou.
  for (let i = 0; i < 3; i++) {
    const { data: newConv, error: insertErr } = await supabase
      .from("conversations")
      .insert({
        customer_id: custId,
        status: "active",
        source: "whatsapp",
        unread_count: 1,
        metadata: { phone_number_id: phoneNumberId },
      })
      .select("id")
      .single();
    if (!insertErr && newConv) return { id: newConv.id, unread: 1, isNew: true };

    // corrida ou constraint → tenta achar a ativa deste número
    const { data: raced } = await supabase
      .from("conversations")
      .select("id, unread_count")
      .eq("customer_id", custId)
      .eq("status", "active")
      .filter("metadata->>phone_number_id", "eq", phoneNumberId)
      .limit(1);
    if (raced && raced.length > 0) return { id: raced[0].id, unread: (raced[0].unread_count || 0) + 1, isNew: false };
    if (i < 2) await sleep(200 * (i + 1));
  }

  // 3) Último recurso: qualquer conversa ativa do cliente (evita DROP).
  const { data: anyActive } = await supabase
    .from("conversations")
    .select("id, unread_count")
    .eq("customer_id", custId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (anyActive && anyActive.length > 0) {
    console.error("[EvoHub] CONVERSA FALLBACK (canal diferente) — cliente:", custId, "| pid esperado:", phoneNumberId, "| usou conv:", anyActive[0].id);
    return { id: anyActive[0].id, unread: (anyActive[0].unread_count || 0) + 1, isNew: false };
  }

  console.error("[EvoHub] PERDA DE LEAD — não resolveu conversa:", custId, "| pid:", phoneNumberId);
  return null;
}

Deno.serve(async (req: Request) => {
  // GET: verificação do webhook Meta (hub.challenge)
  const url = new URL(req.url);
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === webhookSecret) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Verification failed", { status: 403 });
  }

  // POST: receber eventos
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.text();
    let payload: any;
    try {
      payload = JSON.parse(body);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }

    // Evento de ciclo de vida
    if (payload.event_type) {
      console.log("[EvoHub] Lifecycle:", payload.event_type, payload.channel_id);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Evento Meta - WhatsApp
    if (payload.object === "whatsapp_business_account") {
      await processWhatsAppMessages(payload);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error: any) {
    console.error("[EvoHub] Erro:", error.message);
    return new Response(JSON.stringify({ error: "Internal" }), { status: 500 });
  }
});

async function processWhatsAppMessages(payload: any) {
  const entries = payload.entry || [];

  for (const entry of entries) {
    const changes = entry.changes || [];

    for (const change of changes) {
      if (change.field !== "messages") continue;

      const value = change.value || {};
      const messages = value.messages || [];
      const statuses = value.statuses || [];
      const contact = value.contacts?.[0];
      const metadata = value.metadata || {};
      const phoneNumberId = metadata.phone_number_id || entry.id;

      // LOG CRU (caixa-preta): registra TODA mensagem recebida ANTES de processar.
      // msg no log cru mas NÃO em messages = a gente dropou; sumiu e nem no log cru
      // = EvoHub/Meta não mandou. É 1 insert barato e desnicessário travar por ele.
      if (messages.length > 0) {
        try {
          const raw = messages.map((m: any) => ({ wa_message_id: m.id, phone_number_id: phoneNumberId, from_phone: m.from || null }));
          await supabase.from("webhook_inbound_log").insert(raw);
        } catch (_e) { /* nunca bloqueia ingestão */ }
      }

      // Processa status de leitura (lead visualizou)
      if (statuses.length > 0) {
        await processReadReceipts(supabase, statuses);
      }

      if (messages.length === 0) continue;

      const from = messages[0]?.from || contact?.wa_id;
      if (!from) continue;

      const customerName = contact?.profile?.name || from;
      const customerPhone = from;

      // Upsert customer (com retry — não descarta o lote por soluço)
      const cust = await upsertCustomerWithRetry(customerName, customerPhone);
      if (!cust) continue; // já logado como PERDA DE LEAD

      // Resolve/cria conversa ativa deste número (nunca deixa convId indefinido)
      const resolved = await resolveConversation(cust.id, phoneNumberId);
      if (!resolved) continue; // já logado como PERDA DE LEAD
      const convId = resolved.id;
      const unread = resolved.unread;

      await supabase
        .from("conversations")
        .update({
          last_message_at: new Date().toISOString(),
          unread_count: unread,
          updated_at: new Date().toISOString(),
        })
        .eq("id", convId);

      // Nota de transferência: só quando a conversa é NOVA e o lead já foi
      // atendido por outro número antes.
      if (resolved.isNew) {
        const { data: prevConvs } = await supabase
          .from("conversations")
          .select("id, metadata")
          .eq("customer_id", cust.id)
          .neq("id", convId)
          .not("metadata->>phone_number_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(5);

        if (prevConvs && prevConvs.length > 0) {
          const sellerNames: Record<string, string> = {
            "897878513398151": "VH - 1692",
            "892228177298374": "GUSTAVO",
            "1034222499765101": "AMANDA",
            "976034132269824": "GABI",
            "1234821229708132": "NC - CAIO",
          };
          const seenSellers = new Set<string>();
          for (const pc of prevConvs) {
            const pid = (pc as any).metadata?.phone_number_id || "";
            const name = sellerNames[pid];
            if (name && !seenSellers.has(name)) seenSellers.add(name);
          }
          if (seenSellers.size > 0) {
            const sellersList = Array.from(seenSellers).join(", ");
            await insertMessageWithRetry({
              conversation_id: convId,
              sender_type: "system",
              content: `📋 Este lead já foi atendido por: ${sellersList}`,
              content_type: "text",
              metadata: { type: "transfer_note" },
            });
          }
        }
      }

      // Inserir mensagens
      for (const msg of messages) {
        let content = "";
        let contentType = "text";

        if (msg.type === "text") {
          content = msg.text?.body || "";
        } else if (msg.type === "image") {
          content = msg.image?.caption || "🖼 Imagem";
          contentType = "image";
        } else if (msg.type === "video") {
          content = msg.video?.caption || "🎬 Vídeo";
          contentType = "video";
        } else if (msg.type === "audio") {
          content = "🎤 Áudio";
          contentType = "audio";
        } else if (msg.type === "document") {
          content = msg.document?.filename || "📄 Documento";
          contentType = "document";
        } else if (msg.type === "location") {
          content = "📍 Localização";
          contentType = "location";
        } else if (msg.type === "sticker") {
          content = "🏴 Sticker";
          contentType = "sticker";
        } else if (msg.type === "reaction") {
          // Processar reação - atualiza a mensagem original
          const reactedMsgId = msg.reaction?.message_id;
          const emoji = msg.reaction?.emoji || "";
          if (reactedMsgId && emoji) {
            const { data: targetMsgs } = await supabase
              .from("messages")
              .select("id, metadata")
              .eq("conversation_id", convId)
              .filter("metadata->>wa_message_id", "eq", reactedMsgId)
              .limit(1);
            if (targetMsgs && targetMsgs.length > 0) {
              const target = targetMsgs[0];
              const meta = target.metadata || {};
              const reactions = meta.reactions || {};
              if (emoji === "") {
                delete reactions[msg.from || "unknown"];
              } else {
                reactions[msg.from || "unknown"] = emoji;
              }
              await supabase.from("messages").update({
                metadata: { ...meta, reactions },
              }).eq("id", target.id);

              const previewText = emoji === "" ? "removeu reação" : `reagiu ${emoji}`;
              await supabase.from("conversations").update({
                last_message: previewText,
                last_message_at: new Date().toISOString(),
                last_message_sender: "customer",
              }).eq("id", convId);
            }
          }
          continue; // Não criar mensagem
        } else if (msg.type === "button") {
          content = msg.button?.text || "[Botão]";
        } else if (msg.type === "interactive") {
          content = msg.interactive?.button_reply?.title ||
            msg.interactive?.list_reply?.title ||
            "[Interativo]";
        } else {
          content = `[${msg.type}]`;
        }

        if (content) {
          // Dedup por wa_message_id
          const waId = msg.id;
          if (waId) {
            const { data: existing } = await supabase
              .from("messages")
              .select("id")
              .eq("conversation_id", convId)
              .filter("metadata->>wa_message_id", "eq", waId)
              .limit(1);
            if (existing && existing.length > 0) continue;
          }

          const mediaId = msg.image?.id || msg.video?.id || msg.audio?.id || msg.document?.id || msg.sticker?.id || null;
          const caption = msg.image?.caption || msg.video?.caption || null;
          const context = msg.context || null;

          // Se é resposta, busca o conteúdo citado
          if (context?.id) {
            const { data: quoted } = await supabase
              .from("messages")
              .select("content, content_type, sender_type")
              .filter("metadata->>wa_message_id", "eq", context.id)
              .limit(1);
            if (quoted && quoted.length > 0) {
              context.quoted_content = quoted[0].content;
              context.quoted_content_type = quoted[0].content_type;
              context.quoted_sender_type = quoted[0].sender_type;
            }
          }

          await insertMessageWithRetry({
            conversation_id: convId,
            sender_type: "customer",
            content,
            content_type: contentType,
            metadata: { wa_message_id: msg.id, phone_number_id: phoneNumberId, media_id: mediaId, caption, context },
            created_at: msg.timestamp
              ? new Date(parseInt(msg.timestamp) * 1000).toISOString()
              : new Date().toISOString(),
          });
        }
      }

      // Atualizar last_message
      const lastMsg = messages[messages.length - 1];
      const mediaLabels: Record<string, string> = {
        audio: "🎵 Áudio",
        image: "📷 Imagem",
        video: "🎬 Vídeo",
        document: "📄 Documento",
        sticker: "🌟 Figurinha",
        location: "📍 Localização",
        contacts: "👤 Contato",
        reaction: "❤️ Reação",
        interactive: "💬 Interativo",
      };
      let lastContent = "";
      if (lastMsg.type === "text") lastContent = lastMsg.text?.body || "";
      else if (lastMsg.type === "button") lastContent = lastMsg.button?.text || "";
      else lastContent = mediaLabels[lastMsg.type] || `[${lastMsg.type}]`;

      await supabase
        .from("conversations")
        .update({
          last_message: lastContent,
          last_message_at: new Date().toISOString(),
          last_message_sender: "customer",
          last_message_read: false,
        })
        .eq("id", convId);
    }
  }
}

async function processReadReceipts(supabase: any, statuses: any[]) {
  for (const status of statuses) {
    if (status.status !== "read") continue;
    const waMessageId = status.id;
    if (!waMessageId) continue;

    await supabase
      .from("messages")
      .update({ read_at: new Date(parseInt(status.timestamp) * 1000).toISOString() })
      .filter("metadata->>wa_message_id", "eq", waMessageId);
  }
}
