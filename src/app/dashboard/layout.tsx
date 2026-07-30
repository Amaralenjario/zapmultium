import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import FlowScheduler from "@/components/flows/FlowScheduler";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex bg-gray-50 dark:bg-gray-950 min-h-screen overflow-x-hidden">
      <Sidebar />
      <main className="flex-1 p-8 overflow-x-hidden">{children}</main>
      <FlowScheduler />
    </div>
  );
}
