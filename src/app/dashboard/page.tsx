import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import MetricCard from "@/components/dashboard/MetricCard";
import MessageVolumeChart from "@/components/dashboard/MessageVolumeChart";
import OperationDonut from "@/components/dashboard/OperationDonut";
import SellerPerformanceTable from "@/components/dashboard/SellerPerformanceTable";
import RecentConversations from "@/components/dashboard/RecentConversations";
import DashboardFilter from "@/components/dashboard/DashboardFilter";
import WolfTeaser from "@/components/dashboard/WolfTeaser";
import AutoFlowPanel from "@/components/dashboard/AutoFlowPanel";
import { MessageSquarePlus, Clock, MessagesSquare, Timer, Inbox, Send, Workflow, Hourglass } from "lucide-react";

const kpiIcon = "w-[1.15rem] h-[1.15rem]";

// phone_number_ids conhecidos por canal (fallback)
const KNOWN_PHONES: Record<string, string> = {
  "5145a0c0-a358-43e5-8269-c5ace26ca023": "897878513398151",
  "effa72d1-47f6-445b-acbc-7693ef21ee24": "976034132269824",
  "c5505ddf-f9ef-4837-9337-45ed3de40d6a": "892228177298374",
  "346e4eef-bc78-41ec-a7ae-ec7ec75bf177": "1034222499765101",
  "b1c6879b-e962-4f50-95f7-14f1a04601a5": "1234821229708132",
};

function getDateRange(range: string, start?: string, end?: string) {
  const TZ = "-03:00";
  if (range === "custom" && start && end) {
    return {
      startISO: new Date(start + "T00:00:00" + TZ).toISOString(),
      endISO: new Date(end + "T23:59:59.999" + TZ).toISOString(),
    };
  }
  const now = new Date();
  let brToday: string;
  try {
    // en-CA devolve YYYY-MM-DD; timeZone garante a data no fuso do Brasil
    // independente do fuso da máquina/servidor.
    brToday = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  } catch {
    brToday = new Date(now.getTime() - 3 * 3600000).toISOString().split("T")[0];
  }
  const todayEnd = new Date(brToday + "T23:59:59.999" + TZ);
  if (range === "hoje") {
    return { startISO: new Date(brToday + "T00:00:00" + TZ).toISOString(), endISO: todayEnd.toISOString() };
  }
  if (range === "ontem") {
    const y = new Date(brToday + "T00:00:00" + TZ);
    y.setUTCDate(y.getUTCDate() - 1);
    const yEnd = new Date(y);
    yEnd.setUTCHours(26, 59, 59, 999);
    return { startISO: y.toISOString(), endISO: yEnd.toISOString() };
  }
  const days: Record<string, number> = { "7d": 6, "15d": 14, "30d": 29 };
  const daysBack = days[range] ?? 0;
  const rangeStart = new Date(brToday + "T00:00:00" + TZ);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - daysBack);
  return { startISO: rangeStart.toISOString(), endISO: todayEnd.toISOString() };
}

function fmtDuration(sec: number | null): string {
  if (sec == null || !isFinite(sec) || sec <= 0) return "—";
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return rm > 0 ? `${h}h ${rm}min` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

function fmtNum(n: number): string {
  return (n || 0).toLocaleString("pt-BR");
}

function timeAgo(date: Date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { range?: string; start?: string; end?: string; op?: string };
}) {
  const activeRange = searchParams.range || "hoje";
  const opFilter = searchParams.op;
  const { startISO, endISO } = getDateRange(activeRange, searchParams.start, searchParams.end);

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const displayName = user?.user_metadata?.full_name || user?.email;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = serviceKey
    ? createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : supabase;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id || "").single();
  const isAdmin = profile?.role === "admin" || profile?.role === "supervisor";

  // Mapas de canais (phone_number_id -> operação / nome), e canal -> phone
  const { data: opChannels } = await admin
    .from("operations_channels")
    .select("phone_number_id, evohub_channel_id, evohub_channel_name, operation:operation_id(name, color)")
    .eq("is_active", true);

  const phoneToOp: Record<string, { name: string; color: string }> = {};
  const phoneToName: Record<string, string> = {};
  const channelToPhone: Record<string, string> = { ...Object.fromEntries(Object.entries(KNOWN_PHONES)) };
  const allPhones: string[] = [];
  for (const ch of opChannels || []) {
    const op = Array.isArray(ch.operation) ? (ch.operation[0] as any) : (ch.operation as any);
    if (ch.phone_number_id) {
      if (op) phoneToOp[ch.phone_number_id] = { name: op.name, color: op.color };
      if (ch.evohub_channel_name) phoneToName[ch.phone_number_id] = ch.evohub_channel_name;
      if (ch.evohub_channel_id) channelToPhone[ch.evohub_channel_id] = ch.phone_number_id;
      allPhones.push(ch.phone_number_id);
    }
  }

  // Operação -> phones (para filtro por operação)
  const opPhoneIds = opFilter
    ? allPhones.filter((p) => phoneToOp[p]?.name === opFilter)
    : null;

  // Vendedor (operator) -> apenas seus canais
  let sellerPhoneIds: string[] | null = null;
  const phoneToSeller: Record<string, string> = {};
  if (!isAdmin) {
    const { data: sc } = await admin.from("seller_channels").select("evohub_channel_id").eq("user_id", user?.id || "");
    sellerPhoneIds = (sc || []).map((s) => channelToPhone[s.evohub_channel_id]).filter(Boolean);
  }

  // Mapa phone -> vendedor (para tabela admin)
  if (isAdmin) {
    const { data: sc } = await admin.from("seller_channels").select("user_id, evohub_channel_id");
    for (const s of sc || []) {
      const phone = channelToPhone[s.evohub_channel_id];
      if (phone) phoneToSeller[phone] = s.user_id;
    }
  }

  // Operações que ESTE usuário pode filtrar (admin = todas; vendedor = só as dos canais dele)
  const visibleOpsSeen: Record<string, string> = {};
  for (const [phone, op] of Object.entries(phoneToOp)) {
    if (!isAdmin && !(sellerPhoneIds || []).includes(phone)) continue;
    if (!visibleOpsSeen[op.name]) visibleOpsSeen[op.name] = op.color;
  }
  const visibleOperations = Object.entries(visibleOpsSeen).map(([name, color]) => ({ name, color }));

  // phones efetivos para as RPCs (null = todos)
  let effectivePhones: string[] | null;
  if (isAdmin) {
    effectivePhones = opPhoneIds; // null = todos, ou filtrado por operação
  } else {
    const base = sellerPhoneIds || [];
    effectivePhones = opPhoneIds ? base.filter((p) => opPhoneIds.includes(p)) : base;
  }

  // Bucket do gráfico: por hora em dia único, senão por dia
  const bucket = activeRange === "hoje" || activeRange === "ontem" ? "hour" : "day";

  // ── Chamadas ao banco (funções SQL — precisas, sem teto de 1000) ──
  const [summaryRes, channelRes, volumeRes, waitingRes, recentRes] = await Promise.all([
    admin.rpc("dashboard_summary", { p_start: startISO, p_end: endISO, p_phones: effectivePhones }),
    admin.rpc("dashboard_by_channel", { p_start: startISO, p_end: endISO, p_phones: effectivePhones }),
    admin.rpc("dashboard_volume", { p_start: startISO, p_end: endISO, p_phones: effectivePhones, p_bucket: bucket }),
    // Fila: conversas aguardando resposta há mais tempo
    (() => {
      let q = admin
        .from("conversations")
        .select("id, last_message, last_message_at, customer:customer_id(name, phone), metadata")
        .eq("status", "active")
        .eq("last_message_sender", "customer")
        .order("last_message_at", { ascending: true })
        .limit(6);
      if (effectivePhones && effectivePhones.length === 1) q = q.eq("metadata->>phone_number_id", effectivePhones[0]);
      else if (effectivePhones && effectivePhones.length > 1) q = q.or(effectivePhones.map((id) => `metadata->>phone_number_id.eq.${id}`).join(","));
      else if (effectivePhones && effectivePhones.length === 0) q = q.eq("metadata->>phone_number_id", "__none__");
      return q;
    })(),
    // Conversas recentes
    (() => {
      let q = admin
        .from("conversations")
        .select("id, status, last_message, last_message_sender, customer:customer_id(name, phone), updated_at, metadata")
        .order("updated_at", { ascending: false })
        .limit(6);
      if (effectivePhones && effectivePhones.length === 1) q = q.eq("metadata->>phone_number_id", effectivePhones[0]);
      else if (effectivePhones && effectivePhones.length > 1) q = q.or(effectivePhones.map((id) => `metadata->>phone_number_id.eq.${id}`).join(","));
      else if (effectivePhones && effectivePhones.length === 0) q = q.eq("metadata->>phone_number_id", "__none__");
      return q;
    })(),
  ]);

  const s = (summaryRes.data as any) || {};
  const channels: any[] = (channelRes.data as any[]) || [];
  const volume: any[] = (volumeRes.data as any[]) || [];

  // Gráfico de volume
  const volumeData = volume.map((v) => {
    const d = new Date(v.bucket);
    const label = bucket === "hour"
      ? `${String(d.getUTCHours()).padStart(2, "0")}h`
      : `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
    return { label, enviadas: Number(v.enviadas), recebidas: Number(v.recebidas) };
  });

  // Donut por operação (novas conversas no período)
  const opAgg: Record<string, { name: string; color: string; value: number }> = {};
  for (const ch of channels) {
    const op = phoneToOp[ch.phone];
    if (!op) continue;
    if (!opAgg[op.name]) opAgg[op.name] = { name: op.name, color: op.color, value: 0 };
    opAgg[op.name].value += Number(ch.novas);
  }
  const opSlices = Object.values(opAgg).sort((a, b) => b.value - a.value);
  const opTotal = opSlices.reduce((a, b) => a + b.value, 0);

  // Tabela por vendedor (admin) — mini ranking por vendas. Só vendedores (admins fora).
  let sellerRows: any[] = [];
  if (isAdmin) {
    // Vendas reais por vendedor no período (banco Multium), casadas por nome normalizado.
    const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
    const vendasByName: Record<string, number> = {};
    const mUrl = process.env.MULTIUM_SUPABASE_URL;
    const mKey = process.env.MULTIUM_SUPABASE_ANON_KEY;
    if (mUrl && mKey) {
      try {
        const m = createAdminClient(mUrl, mKey, { auth: { autoRefreshToken: false, persistSession: false } });
        const toBrDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        const { data: vr } = await m.rpc("x1_ranking", { p_start: toBrDate(startISO), p_end: toBrDate(endISO) });
        for (const r of (vr as any[]) || []) vendasByName[norm(r.nome)] = Number(r.vendas) || 0;
      } catch { /* sem fonte de vendas → 0 */ }
    }

    const bySeller: Record<string, { userId: string; novas: number; enviadas: number; recebidas: number }> = {};
    for (const ch of channels) {
      const uid = phoneToSeller[ch.phone];
      if (!uid) continue; // só canais ligados a um vendedor
      if (!bySeller[uid]) bySeller[uid] = { userId: uid, novas: 0, enviadas: 0, recebidas: 0 };
      bySeller[uid].novas += Number(ch.novas);
      bySeller[uid].enviadas += Number(ch.enviadas);
      bySeller[uid].recebidas += Number(ch.recebidas);
    }
    const userIds = Object.keys(bySeller);
    const names: Record<string, string> = {};
    const avatars: Record<string, string> = {};
    const roles: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profs } = await admin.from("profiles").select("id, full_name, email, avatar_url, role").in("id", userIds);
      for (const p of profs || []) {
        names[p.id] = (p as any).full_name || (p as any).email || p.id;
        if ((p as any).avatar_url) avatars[p.id] = (p as any).avatar_url;
        roles[p.id] = (p as any).role || "";
      }
    }
    sellerRows = Object.values(bySeller)
      .filter((v) => roles[v.userId] !== "admin" && roles[v.userId] !== "supervisor") // admins não aparecem
      .map((v) => {
        const nm = names[v.userId] || "Vendedor";
        const vendas = vendasByName[norm(nm)] || 0;
        const taxaConversao = v.novas > 0 ? Math.round((vendas / v.novas) * 100) : 0;
        return { name: nm, avatar: avatars[v.userId], novas: v.novas, enviadas: v.enviadas, recebidas: v.recebidas, vendas, taxaConversao };
      })
      .sort((a, b) => b.vendas - a.vendas || (b.enviadas + b.recebidas) - (a.enviadas + a.recebidas));
  }

  const mapConv = (c: any) => {
    const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
    return {
      id: c.id,
      name: customer?.name || customer?.phone || "Desconhecido",
      phone: customer?.phone || "",
      status: c.status,
      message: c.last_message || undefined,
      time: timeAgo(new Date(c.last_message_at || c.updated_at)),
    };
  };
  const waitingItems = ((waitingRes.data as any[]) || []).map((c) => ({ ...mapConv(c), status: "aguardando" }));
  const recentItems = ((recentRes.data as any[]) || []).map(mapConv);

  const taxaConclusao = s.fluxos_disparados > 0 ? Math.round((s.fluxos_concluidos / s.fluxos_disparados) * 100) : 0;
  const pctAguardando = s.ativas_agora > 0 ? Math.round((s.aguardando / s.ativas_agora) * 100) : 0;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-tx">Dashboard</h1>
          <p className="text-tx2 text-sm mt-0.5">
            Bem-vindo de volta, {displayName}
            {!isAdmin && <span className="text-tx3"> · seus canais</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Suspense fallback={<div className="h-8 w-48 bg-surface2 rounded-control animate-pulse" />}>
            <DashboardFilter operations={visibleOperations} />
          </Suspense>
        </div>
      </div>

      {/* Teaser gamificado: Lobo do X1 */}
      <div className="mb-4">
        <WolfTeaser />
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <MetricCard title="Conversas novas" value={fmtNum(s.novas_conversas || 0)} subtitle="no período" icon={<MessageSquarePlus className={kpiIcon} strokeWidth={1.9} />} />
        <MetricCard title="Aguardando resposta" value={fmtNum(s.aguardando || 0)} subtitle={`${pctAguardando}% das ativas`} icon={<Clock className={kpiIcon} strokeWidth={1.9} />} />
        <MetricCard title="Conversas ativas" value={fmtNum(s.ativas_agora || 0)} subtitle="no momento" icon={<MessagesSquare className={kpiIcon} strokeWidth={1.9} />} />
        <MetricCard title="Tempo de resposta" value={fmtDuration(s.tmr_mediana_seg)} subtitle="mediana (1ª resposta)" icon={<Timer className={kpiIcon} strokeWidth={1.9} />} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Mensagens recebidas" value={fmtNum(s.msgs_recebidas || 0)} subtitle="no período" icon={<Inbox className={kpiIcon} strokeWidth={1.9} />} />
        <MetricCard title="Mensagens enviadas" value={fmtNum(s.msgs_enviadas || 0)} subtitle="no período" icon={<Send className={kpiIcon} strokeWidth={1.9} />} />
        <MetricCard title="Fluxos disparados" value={fmtNum(s.fluxos_disparados || 0)} subtitle={`${taxaConclusao}% concluídos`} icon={<Workflow className={kpiIcon} strokeWidth={1.9} />} />
        <MetricCard title="Duração média" value={fmtDuration(s.duracao_media_seg)} subtitle="por conversa" icon={<Hourglass className={kpiIcon} strokeWidth={1.9} />} />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <div className="lg:col-span-2">
          <MessageVolumeChart
            data={volumeData}
            subtitle={bucket === "hour" ? "Enviadas × recebidas por hora" : "Enviadas × recebidas por dia"}
          />
        </div>
        <OperationDonut data={opSlices} total={opTotal} subtitle={`${fmtNum(opTotal)} novas no período`} />
      </div>

      {/* Atendimento automático (admin) — vincular fluxo a dia/horário/canal/condição */}
      {isAdmin && (
        <div className="mb-6">
          <AutoFlowPanel />
        </div>
      )}

      {/* Performance por vendedor (admin) */}
      {isAdmin && (
        <div className="mb-6">
          <SellerPerformanceTable data={sellerRows} />
        </div>
      )}

      {/* Fila + recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RecentConversations data={waitingItems} title="Aguardando resposta" emptyText="Nenhuma conversa na fila 🎉" />
        <RecentConversations data={recentItems} title="Conversas recentes" />
      </div>
    </div>
  );
}
