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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Bem-vindo de volta, {displayName}</p>
        </div>
        <LogoutButton />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Conversas ativas" value={activeConversations ?? 0} subtitle="no momento" color="green" icon={<ChatIcon />} />
        <MetricCard title="Total conversas" value={totalConversations ?? 0} subtitle="desde o início" color="blue" icon={<AllChatIcon />} />
        <MetricCard title="Leads este mês" value={monthlyLeads ?? 0} subtitle="capturados" color="purple" icon={<LeadIcon />} />
        <MetricCard title="Total leads" value={totalLeads ?? 0} subtitle="na base" color="yellow" icon={<UsersIcon />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ConversationsChart data={conversationsByDayChart} />
        <LeadsByStatus data={leadsByStatusChart} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentConversations data={recentConversationItems} />
        <RecentLeads data={recentLeadItems} />
      </div>
    </div>
  );
}

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); }

function timeAgo(date: Date) { const diff = Date.now() - date.getTime(); const mins = Math.floor(diff / 60000); if (mins < 1) return "agora"; if (mins < 60) return `${mins}min`; const hours = Math.floor(mins / 60); if (hours < 24) return `${hours}h`; const days = Math.floor(hours / 24); return `${days}d`; }

function ChatIcon() { return (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>); }
function AllChatIcon() { return (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>); }
function LeadIcon() { return (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>); }
function UsersIcon() { return (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>); }
