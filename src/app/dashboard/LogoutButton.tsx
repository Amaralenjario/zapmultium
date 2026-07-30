"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

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
      className="rounded-lg bg-red-50 text-red-600 dark:bg-red-600/20 dark:text-red-400 px-4 py-2 text-sm hover:bg-red-100 dark:hover:bg-red-600/30 transition"
    >
      Sair
    </button>
  );
}
