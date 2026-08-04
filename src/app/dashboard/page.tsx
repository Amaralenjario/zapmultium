import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./LogoutButton";
import MetricCard from "@/components/dashboard/MetricCard";
import ConversationsChart from "@/components/dashboard/ConversationsChart";
import LeadsByStatus from "@/components/dashboard/LeadsByStatus";
import RecentConversations from "@/components/dashboard/RecentConversations";
import RecentLeads from "@/components/dashboard/RecentLeads";
import DashboardFilter from "@/components/dashboard/DashboardFilter";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const KNOWN_PHONES: Record<string, string> = {
  "5145a0c0-a358-43e5-8269-c5ace26ca023": "897878513398151",
  "effa72d1-47f6-445b-acbc-7693ef21ee24": "976034132269824",
  "c5505ddf-f9ef-4837-9337-45ed3de40d6a": "892228177298374",
  "346e4eef-bc78-41ec-a7ae-ec7ec75bf177": "1034222499765101",
  "b1c6879b-e962-4f50-95f7-14f1a04601a5": "1234821229708132",
};

const PHONE_NAMES: Record<string, string> = {
  "897878513398151": "VH - 1692",
  "976034132269824": "GABI - 8176",
  "892228177298374": "GUSTAVO - LUIS",
  "1034222499765101": "AMANDA - JÉ",
  "1234821229708132": "NC - CAIO",
};

function getDateRange(range: string, start?: string, end?: string) {
  const endDate = end ? new Date(end) : new Date();
  endDate.setHours(23, 59, 59, 999);
  const endISO = endDate.toISOString();

  let startISO: string;
  if (range === "custom" && start) {
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    startISO = s.toISOString();
  } else {
    const days: Record<string, number> = { hoje: 0, ontem: 1, "7d": 6, "15d": 14, "30d": 29 };
    const d = new Date();
    d.setDate(d.getDate() - (days[range] || 6));
    d.setHours(0, 0, 0, 0);
    startISO = d.toISOString();
  }
  return { startISO, endISO };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { range?: string; start?: string; end?: string };
}) {
  const range = searchParams.range;
  const start = searchParams.start;
  const end = searchParams.end;
  const activeRange = range || "7d";
  const { startISO, endISO } = getDateRange(activeRange, start, end);

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const displayName = user?.user_metadata?.full_name || user?.email;

  let sellerPhoneIds: string[] | null = null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id || "").single();

  if (profile?.role !== "admin" && profile?.role !== "supervisor") {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminClient = serviceKey
      ? createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : supabase;

    const { data: sc } = await adminClient.from("seller_channels").select("evohub_channel_id").eq("user_id", user?.id || "");
    if (sc && sc.length > 0) {
      const channelIds = sc.map((s) => s.evohub_channel_id);
      const { data: oc } = await supabase.from("operations_channels").select("evohub_channel_id, phone_number_id").eq("is_active", true);
      const phoneIdMap: Record<string, string> = {};
      for (const [chId, phoneId] of Object.entries(KNOWN_PHONES)) phoneIdMap[chId] = phoneId;
      for (const row of oc || []) { if (row.phone_number_id) phoneIdMap[row.evohub_channel_id] = row.phone_number_id; }
      sellerPhoneIds = channelIds.map((cid) => phoneIdMap[cid]).filter(Boolean);
    }
  }

  const addPhoneFilter = (query: any) => {
    if (sellerPhoneIds && sellerPhoneIds.length > 0) {
      if (sellerPhoneIds.length === 1) return query.eq("metadata->>phone_number_id", sellerPhoneIds[0]);
      return query.or(sellerPhoneIds.map((id) => `metadata->>phone_number_id.eq.${id}`).join(","));
    }
    return query;
  };

  let leadPhones: string[] = [];
  if (sellerPhoneIds && sellerPhoneIds.length > 0) {
    const { data: convs } = await addPhoneFilter(supabase.from("conversations").select("customer:customer_id(phone)"));
    leadPhones = [...new Set((convs || []).map((c: any) => Array.isArray(c.customer) ? c.customer[0]?.phone : c.customer?.phone).filter(Boolean))] as string[];
  }

  const addLeadFilter = (query: any) => {
    if (sellerPhoneIds === null) return query;
    if (leadPhones.length === 0) return query.eq("phone", "__none__");
    if (leadPhones.length === 1) return query.eq("phone", leadPhones[0]);
    return query.in("phone", leadPhones.slice(0, 50));
  };

  const convBase = (q: any) => addPhoneFilter(q).gte("created_at", startISO).lte("created_at", endISO);
  const leadBase = (q: any) => addLeadFilter(q).gte("created_at", startISO).lte("created_at", endISO);
  const allTimeConv = (q: any) => addPhoneFilter(q);

  // Fetch operations_channels for leads-by-operation mapping
  const { data: opChannels } = await supabase
    .from("operations_channels")
    .select("phone_number_id, operation:operation_id(name, color)")
    .eq("is_active", true)
    .not("phone_number_id", "is", null);

  // Fetch seller_channels for leads-by-seller mapping (admin only)
  const isAdminOrSupervisor = profile?.role === "admin" || profile?.role === "supervisor";
  let sellerChannels: { user_id: string; phone_number_id: string }[] = [];
  if (isAdminOrSupervisor) {
    const { data: sc } = await supabase
      .from("seller_channels")
      .select("user_id, evohub_channel_id");
    if (sc) {
      const phoneIdMap: Record<string, string> = {};
      for (const ch of opChannels || []) {
        if (ch.phone_number_id) phoneIdMap[ch.phone_number_id] = ch.phone_number_id;
      }
      // Also use known phone IDs
      const knownPhones: Record<string, string> = {
        "5145a0c0-a358-43e5-8269-c5ace26ca023": "897878513398151",
        "effa72d1-47f6-445b-acbc-7693ef21ee24": "976034132269824",
        "c5505ddf-f9ef-4837-9337-45ed3de40d6a": "892228177298374",
        "346e4eef-bc78-41ec-a7ae-ec7ec75bf177": "1034222499765101",
        "b1c6879b-e962-4f50-95f7-14f1a04601a5": "1234821229708132",
      };
      for (const [chId, phoneId] of Object.entries(knownPhones)) {
        phoneIdMap[chId] = phoneId;
      }
      sellerChannels = sc.map(s => ({
        user_id: s.user_id,
        phone_number_id: phoneIdMap[s.evohub_channel_id] || "",
      })).filter(s => s.phone_number_id);
    }
  }

  const [
    { count: activeConversations },
    { count: totalConversations },
    { count: flowsTriggered },
    { data: recentConversations },
    { data: recentLeads },
    { data: leadsByStatus },
    { data: conversationsByDay },
    { data: allMessages },
    { data: newConversations },
    { data: firstMessages },
  ] = await Promise.all([
    allTimeConv(supabase.from("conversations").select("*", { count: "exact", head: true })).eq("status", "active"),
    allTimeConv(supabase.from("conversations").select("*", { count: "exact", head: true })),
    supabase.from("flow_executions").select("*", { count: "exact", head: true }).gte("started_at", startISO).lte("started_at", endISO),
    addPhoneFilter(supabase.from("conversations").select("id, status, last_message, customer:customer_id(name, phone), updated_at").order("updated_at", { ascending: false }).limit(5)),
    leadBase(supabase.from("leads").select("id, name, phone, status, priority, created_at").order("created_at", { ascending: false }).limit(5)),
    leadBase(supabase.from("leads").select("status")),
    convBase(supabase.from("conversations").select("created_at, status")),
    supabase.from("messages").select("metadata, sender_type").gte("created_at", startISO).lte("created_at", endISO).limit(10000),
    addPhoneFilter(supabase.from("conversations").select("id, metadata, created_at").gte("created_at", startISO).lte("created_at", endISO).limit(10000)),
    supabase.from("messages").select("conversation_id, content, sender_type, created_at").eq("sender_type", "customer").order("created_at", { ascending: true }).limit(10000),
  ]);

  // Seller message stats
  const sellerStats: Record<string, { sent: number; received: number; name: string }> = {};
  for (const phoneId of Object.keys(PHONE_NAMES)) {
    sellerStats[phoneId] = { sent: 0, received: 0, name: PHONE_NAMES[phoneId] || phoneId };
  }
  for (const m of (allMessages || [])) {
    const pid = (m.metadata as any)?.phone_number_id || "";
    if (sellerStats[pid]) {
      if (m.sender_type === "agent") sellerStats[pid].sent++;
      else if (m.sender_type === "customer") sellerStats[pid].received++;
    }
  }

  // If seller-filtered, only show their channels
  if (sellerPhoneIds) {
    for (const key of Object.keys(sellerStats)) {
      if (!sellerPhoneIds.includes(key)) delete sellerStats[key];
    }
  }

  const sellerTotal = Object.values(sellerStats).reduce((a, b) => a + b.sent + b.received, 0);
  const sellerStatsArray = Object.entries(sellerStats)
    .filter(([, v]) => v.sent > 0 || v.received > 0)
    .sort((a, b) => (b[1].sent + b[1].received) - (a[1].sent + a[1].received));

  // Leads por operação - conta conversas novas no período agrupadas por phone_number_id
  const opsMap: Record<string, { opName: string; opColor: string; count: number }> = {};
  const phoneToOp: Record<string, { opName: string; opColor: string }> = {};
  for (const ch of opChannels || []) {
    const op = Array.isArray(ch.operation) ? (ch.operation[0] as any) : (ch.operation as any);
    if (ch.phone_number_id && op) {
      phoneToOp[ch.phone_number_id] = { opName: op.name, opColor: op.color };
    }
  }
  for (const conv of (newConversations || [])) {
    const pid = (conv as any).metadata?.phone_number_id || "";
    const op = phoneToOp[pid];
    if (!op) continue;
    if (!opsMap[op.opName]) opsMap[op.opName] = { opName: op.opName, opColor: op.opColor, count: 0 };
    opsMap[op.opName].count++;
  }
  const leadsByOperation = Object.values(opsMap).sort((a, b) => b.count - a.count);
  const totalNewLeads = leadsByOperation.reduce((a, b) => a + b.count, 0);

  // Leads por vendedor (admin only)
  const sellerLeadMap: Record<string, { userId: string; count: number }> = {};
  const phoneToSeller: Record<string, string> = {};
  for (const sc of sellerChannels) {
    phoneToSeller[sc.phone_number_id] = sc.user_id;
  }
  for (const conv of (newConversations || [])) {
    const pid = (conv as any).metadata?.phone_number_id || "";
    const userId = phoneToSeller[pid];
    if (!userId) continue;
    if (!sellerLeadMap[userId]) sellerLeadMap[userId] = { userId, count: 0 };
    sellerLeadMap[userId].count++;
  }

  // Get seller names from profiles
  const sellerNames: Record<string, string> = {};
  if (isAdminOrSupervisor && Object.keys(sellerLeadMap).length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", Object.keys(sellerLeadMap));
    if (profiles) {
      for (const p of profiles) {
        sellerNames[p.id] = (p as any).full_name || (p as any).email || p.id;
      }
    }
  }
  const leadsBySeller = Object.values(sellerLeadMap)
    .map(s => ({ name: sellerNames[s.userId] || s.userId, count: s.count }))
    .sort((a, b) => b.count - a.count);

  // Leads por frase-chave - primeira mensagem por operação
  const convIdsInPeriod = new Set((newConversations || []).map((c: any) => c.id));
  // Mapa: conversation_id → { content, phone_number_id }
  const convMeta: Record<string, { phoneId: string }> = {};
  for (const c of (newConversations || [])) {
    convMeta[(c as any).id] = { phoneId: (c as any).metadata?.phone_number_id || "" };
  }
  const firstMsgByConv: Record<string, string> = {};
  for (const msg of (firstMessages || [])) {
    const cid = (msg as any).conversation_id;
    if (!convIdsInPeriod.has(cid)) continue;
    if (firstMsgByConv[cid]) continue;
    firstMsgByConv[cid] = (msg as any).content || "";
  }

  // Agrupa por operação → frase → count
  const opPhrases: Record<string, { opName: string; opColor: string; phrases: Record<string, number> }> = {};
  for (const [convId, content] of Object.entries(firstMsgByConv)) {
    if (!content.trim()) continue;
    const pid = convMeta[convId]?.phoneId || "";
    const op = phoneToOp[pid];
    if (!op) continue;
    if (!opPhrases[op.opName]) opPhrases[op.opName] = { opName: op.opName, opColor: op.opColor, phrases: {} };
    const normalized = content.trim().slice(0, 150); // trunca pra evitar frases gigantes
    opPhrases[op.opName].phrases[normalized] = (opPhrases[op.opName].phrases[normalized] || 0) + 1;
  }

  // Converte pra array ordenado, top 5 por operação
  const leadsByPhrasePerOp = Object.values(opPhrases).map(op => ({
    ...op,
    phrases: Object.entries(op.phrases)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8), // top 8 frases por operação
  })).filter(op => op.phrases.length > 0);

  const leadsByStatusCounts = (leadsByStatus || []).reduce(
    (acc: Record<string, number>, lead: { status: string }) => { acc[lead.status] = (acc[lead.status] || 0) + 1; return acc; }, {}
  );
  const leadsByStatusChart = ["new", "contacted", "qualified", "converted", "lost"].map((status) => ({ status, count: leadsByStatusCounts[status] || 0 }));

  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0); return d;
  });
  const conversationsByDayChart = last7Days.map((day) => {
    const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
    const dayConversations = (conversationsByDay || []).filter((c: any) => {
      const d = new Date(c.created_at); return d >= day && d <= dayEnd;
    });
    return { date: dayNames[day.getDay()] + " " + day.getDate(), total: dayConversations.length, active: dayConversations.filter((c: any) => c.status === "active").length };
  });

  const recentConversationItems = (recentConversations || []).map((c: any) => {
    const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
    return { id: c.id, name: customer?.name || customer?.phone || "Desconhecido", phone: customer?.phone || "", status: c.status, message: c.last_message || undefined, time: timeAgo(new Date(c.updated_at)) };
  });

  const recentLeadItems = (recentLeads || []).map((l: any) => ({ id: l.id, name: l.name, phone: l.phone, status: l.status, priority: l.priority, time: timeAgo(new Date(l.created_at)) }));

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Bem-vindo de volta, {displayName}</p>
        </div>
        <div className="flex items-center gap-3">
          <Suspense fallback={<div className="h-8 w-48 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />}>
            <DashboardFilter />
          </Suspense>
          <LogoutButton />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-5 mb-6">
        <MetricCard title="Conversas ativas" value={activeConversations ?? 0} subtitle="no momento" icon={<ChatIcon />} />
        <MetricCard title="Total conversas" value={totalConversations ?? 0} subtitle="desde o início" icon={<AllChatIcon />} />
        <MetricCard title="Leads no período" value={totalNewLeads ?? 0} subtitle="capturados" icon={<LeadIcon />} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-5 mb-6">
        <MetricCard title="Fluxos disparados" value={flowsTriggered ?? 0} subtitle="no período" icon={<FlowIcon />} />
        <MetricCard title="Mensagens enviadas" value={Object.values(sellerStats).reduce((a, b) => a + b.sent, 0)} subtitle="no período" icon={<SendIcon />} />
        <MetricCard title="Mensagens recebidas" value={sellerTotal - Object.values(sellerStats).reduce((a, b) => a + b.sent, 0)} subtitle="no período" icon={<ReceiveIcon />} />
      </div>

      {sellerStatsArray.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Mensagens por vendedor</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {sellerStatsArray.map(([phoneId, stats]) => {
              const total = stats.sent + stats.received;
              const pctSent = total > 0 ? Math.round((stats.sent / total) * 100) : 0;
              const pctRecv = total > 0 ? 100 - pctSent : 0;
              return (
                <div key={phoneId} className="rounded-xl border border-gray-200 dark:border-emerald-950/40 bg-white dark:bg-gray-900 p-4 shadow-sm">
                  <p className="text-xs font-medium text-gray-400 dark:text-gray-500 truncate mb-3">{stats.name}</p>
                  <div className="flex items-end gap-1 h-8 mb-3">
                    <div className="bg-emerald-500 rounded-t-sm transition-all" style={{ width: `${Math.max(pctSent, 8)}%`, height: `${Math.max(pctSent * 0.28, 8)}%` }} />
                    <div className="bg-gray-300 dark:bg-gray-700 rounded-t-sm transition-all" style={{ width: `${Math.max(pctRecv, 8)}%`, height: `${Math.max(pctRecv * 0.28, 8)}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span className="text-gray-500 dark:text-gray-400">Enviadas</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{stats.sent}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 flex-shrink-0" />
                      <span className="text-gray-500 dark:text-gray-400">Recebidas</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{stats.received}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {leadsByOperation.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Leads por operação</h3>
            <span className="text-[11px] text-gray-400">{totalNewLeads} no período</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {leadsByOperation.map((op) => {
              const maxLeads = leadsByOperation[0]?.count || 1;
              const barW = Math.max((op.count / maxLeads) * 100, 8);
              return (
                <div key={op.opName} className="rounded-xl border border-gray-200 dark:border-emerald-950/40 bg-white dark:bg-gray-900 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: op.opColor }} />
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{op.opName}</p>
                    <span className="text-xs font-bold text-gray-800 dark:text-white ml-auto">{op.count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${barW}%`, backgroundColor: op.opColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isAdminOrSupervisor && leadsBySeller.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Leads por vendedor</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {leadsBySeller.map((s) => {
              const maxLeads = leadsBySeller[0]?.count || 1;
              const barW = Math.max((s.count / maxLeads) * 100, 8);
              return (
                <div key={s.name} className="rounded-xl border border-gray-200 dark:border-emerald-950/40 bg-white dark:bg-gray-900 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {s.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{s.name}</p>
                    <span className="text-xs font-bold text-gray-800 dark:text-white ml-auto">{s.count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${barW}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {leadsByPhrasePerOp.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Primeira mensagem por operação</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {leadsByPhrasePerOp.map((op) => (
              <div key={op.opName} className="rounded-xl border border-gray-200 dark:border-emerald-950/40 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800" style={{ borderLeftColor: op.opColor, borderLeftWidth: "3px" }}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: op.opColor }} />
                  <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{op.opName}</p>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  {op.phrases.map((p, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-start gap-2">
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex-shrink-0 mt-0.5">{p.count}</span>
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2">{p.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <ConversationsChart data={conversationsByDayChart} />
        <LeadsByStatus data={leadsByStatusChart} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RecentConversations data={recentConversationItems} />
        <RecentLeads data={recentLeadItems} />
      </div>
    </div>
  );
}

function timeAgo(date: Date) { const diff = Date.now() - date.getTime(); const mins = Math.floor(diff / 60000); if (mins < 1) return "agora"; if (mins < 60) return `${mins}min`; const hours = Math.floor(mins / 60); if (hours < 24) return `${hours}h`; const days = Math.floor(hours / 24); return `${days}d`; }

function ChatIcon() { return (<svg className="w-[1.15rem] h-[1.15rem]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3a49.5 49.5 0 01-4.02-.163 2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951" /></svg>); }
function AllChatIcon() { return (<svg className="w-[1.15rem] h-[1.15rem]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>); }
function LeadIcon() { return (<svg className="w-[1.15rem] h-[1.15rem]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>); }
function UsersIcon() { return (<svg className="w-[1.15rem] h-[1.15rem]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>); }
function FlowIcon() { return (<svg className="w-[1.15rem] h-[1.15rem]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>); }
function SendIcon() { return (<svg className="w-[1.15rem] h-[1.15rem]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>); }
function ReceiveIcon() { return (<svg className="w-[1.15rem] h-[1.15rem]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 18 8.25m-9 0h10.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>); }
