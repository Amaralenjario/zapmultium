"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { createClient } from "@/lib/supabase/client";

const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: HomeIcon, section: "main" },
  { label: "Chat ao vivo", href: "/dashboard/chat-ao-vivo", icon: ChatIcon, section: "main" },
  { label: "CRM Leads", href: "/dashboard/crm-leads", icon: CrmIcon, section: "main" },
  { label: "Fluxos", href: "/dashboard/fluxos", icon: FlowIcon, section: "main" },
  { label: "WhatsApps", href: "/dashboard/whatsapps", icon: WhatsAppIcon, section: "admin", adminOnly: true },
  { label: "Operações", href: "/dashboard/operacoes", icon: OpIcon, section: "admin", adminOnly: true },
  { label: "Vendedores", href: "/dashboard/vendedores", icon: SellerIcon, section: "admin", adminOnly: true },
];

const iconBase = "w-[1.15rem] h-[1.15rem] flex-shrink-0 stroke-[1.7]";

function MenuItem({ item, isActive, onClose }: { item: typeof menuItems[number]; isActive: boolean; onClose?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={`group relative flex items-center gap-3 px-4 py-[0.65rem] rounded-xl text-[14px] font-medium transition-all duration-150 ease-out ${
        isActive
          ? "bg-emerald-500/12 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 font-semibold"
          : "text-emerald-900/30 dark:text-emerald-200/30 hover:bg-emerald-500/[0.06] dark:hover:bg-emerald-500/[0.06] hover:text-emerald-700/60 dark:hover:text-emerald-300/60"
      }`}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
      )}
      <span className={iconBase}>
        <item.icon />
      </span>
      {item.label}
    </Link>
  );
}

export default function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from("profiles").select("role").eq("id", user.id).single().then(({ data }) => {
          setIsAdmin(data?.role === "admin" || data?.role === "supervisor");
          setLoaded(true);
        });
      } else {
        setLoaded(true);
      }
    });
  }, []);

  const { mainItems, adminItems } = useMemo(() => {
    const visible = loaded ? menuItems.filter(item => !item.adminOnly || isAdmin) : menuItems;
    return {
      mainItems: visible.filter(item => item.section === "main"),
      adminItems: visible.filter(item => item.section === "admin"),
    };
  }, [loaded, isAdmin]);

  const isSidebarOpen = open !== undefined ? open : false;

  return (
    <aside
      className={`w-64 min-h-screen border-r border-gray-200 dark:border-emerald-950/40 bg-white dark:bg-[#0a0f14] flex flex-col flex-shrink-0 lg:flex ${
        open !== undefined
          ? (isSidebarOpen ? "fixed inset-y-0 left-0 z-50 flex" : "hidden lg:flex")
          : "hidden lg:flex"
      }`}
    >
      {/* Logo */}
      <div className="px-5 py-[1.35rem] flex items-center justify-between">
        <Link href="/dashboard" onClick={onClose} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <svg className="w-[1.1rem] h-[1.1rem] text-white" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">ZapMultium</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {onClose && (
            <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-emerald-900/20 to-transparent" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-1">
        {mainItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return <MenuItem key={item.href} item={item} isActive={isActive} onClose={onClose} />;
        })}

        {adminItems.length > 0 && (
          <div className="pt-6 pb-1">
            <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
              Administração
            </p>
            <div className="space-y-1">
              {adminItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return <MenuItem key={item.href} item={item} isActive={isActive} onClose={onClose} />;
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-emerald-950/30">
        <span className="text-[11px] text-gray-400 dark:text-gray-600">ZapMultium v1.0</span>
      </div>
    </aside>
  );
}

function HomeIcon() {
  return (<svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>);
}
function ChatIcon() {
  return (<svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3a49.5 49.5 0 01-4.02-.163 2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" /></svg>);
}
function CrmIcon() {
  return (<svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>);
}
function FlowIcon() {
  return (<svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875v4.5h.52m10.943 2.25A7.5 7.5 0 014.27 9m0 0h3.896M19.5 18.375v-4.5h-.521m0 0a7.5 7.5 0 01-13.818-2.25m13.818 2.25H14.25" /></svg>);
}
function WhatsAppIcon() {
  return (<svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l2.655-2.655" /></svg>);
}
function SellerIcon() {
  return (<svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>);
}
function OpIcon() {
  return (<svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375a8.25 8.25 0 11-16.5 0 8.25 8.25 0 0116.5 0zM12 6.375v5.25m0 0l3-2.25m-3 2.25l-3-2.25M3.375 18.75h17.25" /></svg>);
}
