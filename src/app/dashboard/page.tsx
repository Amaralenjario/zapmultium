import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LogoutButton from "./LogoutButton";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const displayName = user.user_metadata?.full_name || user.email;

  return (
    <div className="min-h-screen p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-green-500">ZapMultium</h1>
          <p className="text-gray-400 text-sm">Painel de Atendimento</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-300 text-sm">{displayName}</span>
          <LogoutButton />
        </div>
      </header>

      <main className="rounded-xl border border-gray-800 bg-gray-900 p-8">
        <h2 className="text-xl font-semibold mb-4">Conversas</h2>
        <div className="flex items-center justify-center h-64 text-gray-500 border border-dashed border-gray-700 rounded-lg">
          <div className="text-center">
            <p className="text-lg">Nenhuma conversa ativa</p>
            <p className="text-sm mt-1">Conecte seus canais de WhatsApp para começar</p>
          </div>
        </div>
      </main>
    </div>
  );
}
