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
          const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname === item.href || pathname.startsWith(item.href + "/");
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
  return (<svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>);
}
function ChatIcon() {
  return (<svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>);
}
function CrmIcon() {
  return (<svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>);
}
function FlowIcon() {
  return (<svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>);
}
function WhatsAppIcon() {
  return (<svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>);
}
function SellerIcon() {
  return (<svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>);
}
function OpIcon() {
  return (<svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>);
}
