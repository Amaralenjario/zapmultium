import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./LogoutButton";
import MetricCard from "@/components/dashboard/MetricCard";
import ConversationsChart from "@/components/dashboard/ConversationsChart";
import LeadsByStatus from "@/components/dashboard/LeadsByStatus";
import RecentConversations from "@/components/dashboard/RecentConversations";
import RecentLeads from "@/components/dashboard/RecentLeads";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const displayName = user?.user_metadata?.full_name || user?.email;

  // Get user role and seller phone filter
  let sellerPhoneIds: string[] | null = null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id || "").single();

  if (profile?.role !== "admin" && profile?.role !== "supervisor") {
    // Operator: filter by assigned channels
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminClient = serviceKey
      ? createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : supabase;

    const { data: sc } = await adminClient.from("seller_channels").select("evohub_channel_id").eq("user_id", user?.id || "");
    if (sc && sc.length > 0) {
      const channelIds = sc.map((s) => s.evohub_channel_id);
      const phoneIdMap: Record<string, string> = {
        "5145a0c0-a358-43e5-8269-c5ace26ca023": "897878513398151",
        "effa72d1-47f6-445b-acbc-7693ef21ee24": "976034132269824",
        "c5505ddf-f9ef-4837-9337-45ed3de40d6a": "892228177298374",
        "346e4eef-bc78-41ec-a7ae-ec7ec75bf177": "1034222499765101",
        "b1c6879b-e962-4f50-95f7-14f1a04601a5": "1234821229708132",
      };
      const { data: oc } = await supabase.from("operations_channels").select("evohub_channel_id, phone_number_id").eq("is_active", true);
      for (const row of oc || []) { if (row.phone_number_id) phoneIdMap[row.evohub_channel_id] = row.phone_number_id; }
      sellerPhoneIds = channelIds.map((cid) => phoneIdMap[cid]).filter(Boolean);
    }
  }

  // Build filter for seller
  const addPhoneFilter = (query: any) => {
    if (sellerPhoneIds && sellerPhoneIds.length > 0) {
      if (sellerPhoneIds.length === 1) {
        return query.eq("metadata->>phone_number_id", sellerPhoneIds[0]);
      }
      const orClauses = sellerPhoneIds.map((id) => `metadata->>phone_number_id.eq.${id}`).join(",");
      return query.or(orClauses);
    }
    return query;
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // For leads, filter by customer phones from conversations
  let leadPhones: string[] = [];
  if (sellerPhoneIds && sellerPhoneIds.length > 0) {
    const convQuery = addPhoneFilter(supabase.from("conversations").select("customer:customer_id(phone)"));
    const { data: convs } = await convQuery;
    const allPhones = (convs || []).map((c: any) => Array.isArray(c.customer) ? c.customer[0]?.phone : c.customer?.phone).filter(Boolean);
    leadPhones = [...new Set(allPhones)] as string[];
  }

  const addLeadFilter = (query: any) => {
    if (sellerPhoneIds === null || sellerPhoneIds === undefined) return query; // admin/supervisor - no filter
    if (leadPhones.length === 0) return query.eq("phone", "__none__"); // operator with no leads
    if (leadPhones.length === 1) return query.eq("phone", leadPhones[0]);
    return query.in("phone", leadPhones.slice(0, 50));
  };

  const [
    { count: activeConversations },
    { count: totalConversations },
    { count: monthlyLeads },
    { count: totalLeads },
    { data: recentConversations },
    { data: recentLeads },
    { data: leadsByStatus },
    { data: conversationsByDay },
  ] = await Promise.all([
    addPhoneFilter(supabase.from("conversations").select("*", { count: "exact", head: true })).eq("status", "active"),
    addPhoneFilter(supabase.from("conversations").select("*", { count: "exact", head: true })),
    addLeadFilter(supabase.from("leads").select("*", { count: "exact", head: true })).gte("created_at", monthStart),
    addLeadFilter(supabase.from("leads").select("*", { count: "exact", head: true })),
    addPhoneFilter(supabase.from("conversations").select("id, status, last_message, customer:customer_id(name, phone), updated_at").order("updated_at", { ascending: false }).limit(5)),
    addLeadFilter(supabase.from("leads").select("id, name, phone, status, priority, created_at").order("created_at", { ascending: false }).limit(5)),
    addLeadFilter(supabase.from("leads").select("status")),
    addPhoneFilter(supabase.from("conversations").select("created_at, status").gte("created_at", daysAgo(7))),
  ]);

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Bem-vindo de volta, {displayName}</p>
        </div>
        <LogoutButton />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-6">
        <MetricCard title="Conversas ativas" value={activeConversations ?? 0} subtitle="no momento" icon={<ChatIcon />} />
        <MetricCard title="Total conversas" value={totalConversations ?? 0} subtitle="desde o início" icon={<AllChatIcon />} />
        <MetricCard title="Leads este mês" value={monthlyLeads ?? 0} subtitle="capturados" icon={<LeadIcon />} />
        <MetricCard title="Total leads" value={totalLeads ?? 0} subtitle="na base" icon={<UsersIcon />} />
      </div>

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

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); }

function timeAgo(date: Date) { const diff = Date.now() - date.getTime(); const mins = Math.floor(diff / 60000); if (mins < 1) return "agora"; if (mins < 60) return `${mins}min`; const hours = Math.floor(mins / 60); if (hours < 24) return `${hours}h`; const days = Math.floor(hours / 24); return `${days}d`; }

function ChatIcon() { return (<svg className="w-[1.15rem] h-[1.15rem]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3a49.5 49.5 0 01-4.02-.163 2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951" /></svg>); }
function AllChatIcon() { return (<svg className="w-[1.15rem] h-[1.15rem]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>); }
function LeadIcon() { return (<svg className="w-[1.15rem] h-[1.15rem]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>); }
function UsersIcon() { return (<svg className="w-[1.15rem] h-[1.15rem]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>); }
