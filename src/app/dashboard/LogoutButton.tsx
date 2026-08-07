"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400 px-3.5 py-1.5 text-sm font-semibold hover:bg-red-500/20 dark:hover:bg-red-500/25 transition-colors duration-150"
    >
      <LogOut className="w-3.5 h-3.5" strokeWidth={2} />
      Sair
    </button>
  );
}
