import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const displayName = user?.user_metadata?.full_name || user?.email;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-400 text-sm">Bem-vindo, {displayName}</p>
        </div>
        <LogoutButton />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Conversas hoje"
          value="0"
          subtitle="ativas"
          color="green"
        />
        <StatCard
          title="Leads capturados"
          value="0"
          subtitle="este mês"
          color="blue"
        />
        <StatCard
          title="Fluxos ativos"
          value="0"
          subtitle="em execução"
          color="purple"
        />
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: "green" | "blue" | "purple";
}) {
  const colors = {
    green: "bg-green-600/10 border-green-600/30 text-green-400",
    blue: "bg-blue-600/10 border-blue-600/30 text-blue-400",
    purple: "bg-purple-600/10 border-purple-600/30 text-purple-400",
  };

  return (
    <div className={`rounded-xl border p-6 ${colors[color]}`}>
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
      <p className="text-xs mt-1 opacity-70">{subtitle}</p>
    </div>
  );
}

import LogoutButton from "./LogoutButton";
