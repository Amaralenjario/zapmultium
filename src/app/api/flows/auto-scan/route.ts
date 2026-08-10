import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { saoPauloWeekday, processFlowStep } from "@/lib/flow-engine";

export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      // no-store: impede o Next.js Data Cache de congelar o vínculo dos fluxos (days/channels).
      global: { fetch: (input, init) => fetch(input as RequestInfo, { ...init, cache: "no-store" }) },
    }
  );
}

// Varre mensagens recentes de clientes e dispara os fluxos VINCULADOS ao dia de hoje
// (trigger_type='auto', trigger_value={days:[...], channels:[...]|null}). Chamado pelo
// poller do FlowScheduler. Dedup: 1x por conversa por dia por fluxo (fuso de São Paulo).
export async function GET() {
  const supabase = getSupabase();
  const weekday = saoPauloWeekday();
  const dayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const lookbackISO = new Date(Date.now() - 15 * 60000).toISOString();

  // Fluxos automáticos que valem PRA HOJE.
  const { data: flows } = await supabase.from("flows").select("id, config, trigger_value").eq("trigger_type", "schedule");
  const autoFlows = ((flows as any[]) || [])
    .map((f) => {
      let cfg: any = {};
      try { cfg = f.trigger_value ? JSON.parse(f.trigger_value) : {}; } catch { /* ignore */ }
      const channels = Array.isArray(cfg.channels) && cfg.channels.length ? cfg.channels.map((c: any) => String(c)) : null;
      const startNode = ((f.config as any)?.steps || []).find((s: any) => s.type === "start");
      return { id: f.id as string, days: Array.isArray(cfg.days) ? cfg.days.map(Number) : [], channels, startNodeId: startNode?.id as string | undefined };
    })
    .filter((f) => f.days.includes(weekday) && f.startNodeId);

  if (autoFlows.length === 0) return NextResponse.json({ ok: true, weekday, triggered: 0, reason: "nenhum fluxo vinculado hoje" });

  const anyAllChannels = autoFlows.some((f) => f.channels === null);
  const channelSet = new Set<string>();
  autoFlows.forEach((f) => f.channels?.forEach((c: string) => channelSet.add(c)));

  // Mensagens recentes de clientes (últimos 15 min).
  const { data: recent } = await supabase
    .from("messages")
    .select("conversation_id, metadata, created_at")
    .eq("sender_type", "customer")
    .gt("created_at", lookbackISO)
    .order("created_at", { ascending: false })
    .limit(300);

  // Candidatos únicos por conversa+canal.
  const seen = new Set<string>();
  const candidates: { conversation_id: string; phone_number_id: string }[] = [];
  for (const m of (recent as any[]) || []) {
    const pid = m.metadata?.phone_number_id || "";
    if (!pid) continue;
    if (!anyAllChannels && !channelSet.has(pid)) continue;
    const key = `${m.conversation_id}|${pid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ conversation_id: m.conversation_id, phone_number_id: pid });
  }
  if (candidates.length === 0) return NextResponse.json({ ok: true, weekday, triggered: 0 });

  // Telefone do cliente por conversa.
  const convIds = Array.from(new Set(candidates.map((c) => c.conversation_id)));
  const { data: convs } = await supabase.from("conversations").select("id, customer:customer_id(phone)").in("id", convIds);
  const phoneByConv: Record<string, string> = {};
  for (const c of (convs as any[]) || []) {
    const cust = Array.isArray(c.customer) ? c.customer[0] : c.customer;
    if (cust?.phone) phoneByConv[c.id] = cust.phone;
  }

  let triggered = 0;
  for (const cand of candidates) {
    const customerPhone = phoneByConv[cand.conversation_id];
    if (!customerPhone) continue;
    for (const f of autoFlows) {
      if (f.channels && !f.channels.includes(cand.phone_number_id)) continue;

      // Dedup ATÔMICO 1x/conversa/dia: chave determinística + índice único.
      // Se dois pollers rodarem ao mesmo tempo, só um insere; o outro colide e é ignorado.
      const dedupeKey = `sched:${f.id}:${cand.conversation_id}:${dayStr}`;

      // Já existe outro fluxo ativo na conversa? então entra na fila (1 por vez).
      const { data: active } = await supabase
        .from("flow_executions").select("id")
        .eq("conversation_id", cand.conversation_id)
        .in("status", ["running", "paused", "pending", "awaiting_reply"]).limit(1);
      const status = active && active.length > 0 ? "queued" : "pending";

      const { data: inserted } = await supabase
        .from("flow_executions")
        .upsert({
          flow_id: f.id, conversation_id: cand.conversation_id, customer_phone: customerPhone,
          phone_number_id: cand.phone_number_id, current_node_id: f.startNodeId,
          status, context: {}, execution_key: dedupeKey,
        }, { onConflict: "execution_key", ignoreDuplicates: true })
        .select("id");

      if (!inserted || inserted.length === 0) continue; // já disparado hoje (colisão)
      triggered++;
      if (status === "pending") {
        try { await processFlowStep(inserted[0].id); } catch { /* fila cuida */ }
      }
    }
  }

  return NextResponse.json({ ok: true, weekday, triggered });
}
