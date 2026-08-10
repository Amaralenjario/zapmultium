"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, MessagesSquare, Contact, Workflow, Smartphone, Building2, Headset, MessageCircle, X, User, LogOut, Swords, Zap, type LucideIcon } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { createClient } from "@/lib/supabase/client";

const menuItems: { label: string; href: string; icon: LucideIcon; section: string; adminOnly?: boolean; beta?: boolean; novo?: boolean }[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, section: "main" },
  { label: "Chat ao vivo", href: "/dashboard/chat-ao-vivo", icon: MessagesSquare, section: "main" },
  { label: "CRM Leads", href: "/dashboard/crm-leads", icon: Contact, section: "main" },
  { label: "Fluxos", href: "/dashboard/fluxos", icon: Workflow, section: "main" },
  { label: "Automações", href: "/dashboard/automacoes", icon: Zap, section: "main", novo: true },
  { label: "Ranking", href: "/dashboard/ranking", icon: Swords, section: "main" },
  { label: "Meu WhatsApp", href: "/dashboard/meu-numero", icon: Smartphone, section: "main" },
  { label: "Meu perfil", href: "/dashboard/perfil", icon: User, section: "main" },
  { label: "WhatsApps", href: "/dashboard/whatsapps", icon: Smartphone, section: "admin", adminOnly: true },
  { label: "Operações", href: "/dashboard/operacoes", icon: Building2, section: "admin", adminOnly: true },
  { label: "Vendedores", href: "/dashboard/vendedores", icon: Headset, section: "admin", adminOnly: true },
];

function MenuItem({ item, isActive, onClose }: { item: typeof menuItems[number]; isActive: boolean; onClose?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={`group relative flex items-center gap-3 px-4 py-[0.65rem] rounded-control text-[14px] transition-all duration-150 ease-out ${
        isActive
          ? "bg-accentsoft text-accent font-bold"
          : "text-tx2 font-medium hover:bg-hover hover:text-tx"
      }`}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-accent" />
      )}
      <Icon className="w-[1.15rem] h-[1.15rem] flex-shrink-0" strokeWidth={isActive ? 2.1 : 1.9} />
      {item.label}
      {item.novo && (
        <span className="ml-auto text-[9px] font-extrabold uppercase tracking-wider text-white bg-gradient-to-r from-emerald-500 to-accent rounded-full px-1.5 py-0.5">Novo</span>
      )}
      {item.beta && (
        <span className={`text-[9px] font-extrabold uppercase tracking-wider text-white bg-gradient-to-r from-accent to-violet-500 rounded-full px-1.5 py-0.5 ${item.novo ? "" : "ml-auto"}`}>Beta</span>
      )}
    </Link>
  );
}

function initialsOf(name: string) {
  return (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserName(user.user_metadata?.full_name || user.email || "");
        supabase.from("profiles").select("role, full_name, avatar_url").eq("id", user.id).single().then(({ data }) => {
          const role = data?.role || "";
          setUserRole(role);
          if (data?.full_name) setUserName(data.full_name);
          setUserAvatar(data?.avatar_url || null);
          setIsAdmin(role === "admin" || role === "supervisor");
          setLoaded(true);
        });
      } else {
        setLoaded(true);
      }
    });
  }, []);

  // Atualiza avatar/nome na hora quando o perfil é salvo (sem precisar recarregar a página)
  useEffect(() => {
    const onProfileUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.full_name !== undefined && detail.full_name !== null) setUserName(detail.full_name);
      if (detail.avatar_url !== undefined) setUserAvatar(detail.avatar_url || null);
    };
    window.addEventListener("profile-updated", onProfileUpdated);
    return () => window.removeEventListener("profile-updated", onProfileUpdated);
  }, []);

  const { mainItems, adminItems } = useMemo(() => {
    // Enquanto o papel não carregou, NUNCA mostra itens de admin (evita o flash).
    // Só aparecem depois de confirmado que é admin/supervisor.
    const visible = menuItems.filter(item => !item.adminOnly || (loaded && isAdmin));
    return {
      mainItems: visible.filter(item => item.section === "main"),
      adminItems: visible.filter(item => item.section === "admin"),
    };
  }, [loaded, isAdmin]);

  const roleLabel: Record<string, string> = { admin: "Administrador", supervisor: "Supervisor", operator: "Vendedor", seller: "Vendedor" };
  const isSidebarOpen = open !== undefined ? open : false;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    onClose?.();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside
      className={`w-64 h-screen border-r border-bd bg-surface flex flex-col flex-shrink-0 lg:flex ${
        open !== undefined
          ? (isSidebarOpen ? "fixed inset-y-0 left-0 z-50 flex" : "hidden lg:flex")
          : "hidden lg:flex"
      }`}
    >
      {/* Logo */}
      <div className="px-5 py-[1.35rem] flex items-center justify-between">
        <Link href="/dashboard" onClick={onClose} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 shadow-glow">
            <MessageCircle className="w-[1.1rem] h-[1.1rem] text-white" strokeWidth={2.2} />
          </div>
          <span className="text-lg font-extrabold tracking-[-0.03em] text-tx">ZapMultium</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {onClose && (
            <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg text-tx3 hover:text-tx hover:bg-hover transition">
              <X className="w-5 h-5" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-line" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-1">
        {mainItems.map((item) => {
          const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname === item.href || pathname.startsWith(item.href + "/");
          return <MenuItem key={item.href} item={item} isActive={isActive} onClose={onClose} />;
        })}

        {adminItems.length > 0 && (
          <div className="pt-6 pb-1">
            <p className="px-4 mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-tx3">
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

      {/* Footer - perfil do usuário (clica pra editar) + sair */}
      <div className="px-3 py-3 border-t border-bd">
        <div className="flex items-center gap-1">
          <Link href="/dashboard/perfil" onClick={onClose} className="flex items-center gap-2.5 px-2 py-1.5 rounded-control hover:bg-hover transition min-w-0 flex-1">
            {userAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userAvatar} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-1 ring-bd" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                <span className="text-[12px] font-bold text-white">{initialsOf(userName) || "?"}</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-tx truncate">{userName || "Usuário"}</p>
              <p className="text-[11px] text-tx3 truncate">{roleLabel[userRole] || "Membro"}</p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            title="Sair"
            aria-label="Sair"
            className="p-2 rounded-control text-tx3 hover:text-red-500 hover:bg-red-500/10 transition flex-shrink-0"
          >
            <LogOut className="w-[1.15rem] h-[1.15rem]" strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  );
}
