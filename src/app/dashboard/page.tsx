import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./LogoutButton";
import MetricCard from "@/components/dashboard/MetricCard";
import ConversationsChart from "@/components/dashboard/ConversationsChart";
import LeadsByStatus from "@/components/dashboard/LeadsByStatus";
import RecentConversations from "@/components/dashboard/RecentConversations";
import RecentLeads from "@/components/dashboard/RecentLeads";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const displayName = user?.user_metadata?.full_name || user?.email;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

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
    supabase.from("conversations").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("conversations").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("*", { count: "exact", head: true }).gte("created_at", monthStart),
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("conversations").select("id, status, last_message, customer:customer_id(name, phone), updated_at").order("updated_at", { ascending: false }).limit(5),
    supabase.from("leads").select("id, name, phone, status, priority, created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("leads").select("status"),
    supabase.from("conversations").select("created_at, status").gte("created_at", daysAgo(7)),
  ]);

  const leadsByStatusCounts = (leadsByStatus || []).reduce(
    (acc: Record<string, number>, lead: { status: string }) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    },
    {}
  );

  const leadsByStatusChart = ["new", "contacted", "qualified", "converted", "lost"].map((status) => ({
    status,
    count: leadsByStatusCounts[status] || 0,
  }));

  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const conversationsByDayChart = last7Days.map((day) => {
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    const dayConversations = (conversationsByDay || []).filter((c) => {
      const d = new Date(c.created_at);
      return d >= day && d <= dayEnd;
    });
    return {
      date: dayNames[day.getDay()] + " " + day.getDate(),
      total: dayConversations.length,
      active: dayConversations.filter((c) => c.status === "active").length,
    };
  });

  const recentConversationItems = (recentConversations || []).map((c) => {
    const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
    return {
      id: c.id,
      name: customer?.name || customer?.phone || "Desconhecido",
      phone: customer?.phone || "",
      status: c.status,
      message: c.last_message || undefined,
      time: timeAgo(new Date(c.updated_at)),
    };
  });

  const recentLeadItems = (recentLeads || []).map((l) => ({
    id: l.id,
    name: l.name,
    phone: l.phone,
    status: l.status,
    priority: l.priority,
    time: timeAgo(new Date(l.created_at)),
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-400 text-sm">Bem-vindo de volta, {displayName}</p>
        </div>
        <LogoutButton />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Conversas ativas"
          value={activeConversations ?? 0}
          subtitle="no momento"
          color="green"
          icon={<ChatIcon />}
        />
        <MetricCard
          title="Total conversas"
          value={totalConversations ?? 0}
          subtitle="desde o início"
          color="blue"
          icon={<AllChatIcon />}
        />
        <MetricCard
          title="Leads este mês"
          value={monthlyLeads ?? 0}
          subtitle="capturados"
          color="purple"
          icon={<LeadIcon />}
        />
        <MetricCard
          title="Total leads"
          value={totalLeads ?? 0}
          subtitle="na base"
          color="yellow"
          icon={<UsersIcon />}
        />
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

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function timeAgo(date: Date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function ChatIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function AllChatIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  );
}

function LeadIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
