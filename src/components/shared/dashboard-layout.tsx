"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, getInitials } from "@/lib/utils";
import { NotificationBell } from "@/components/ui/notification-bell";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  House,
  Buildings,
  MagnifyingGlass,
  Funnel,
  GitBranch,
  Phone,
  UsersThree,
  HandCoins,
  Briefcase,
  ChartBar,
  Bell,
  GearSix,
  Calculator,
  Sidebar,
  SignOut,
  Gavel,
  ListChecks,
  Scales,
  ChartLineUp,
  X,
  GridFour,
  type Icon,
} from "@phosphor-icons/react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: House },
  { href: "/properties", label: "Nemovitosti", icon: Buildings },
  { href: "/analyzer", label: "Analyzátor", icon: MagnifyingGlass },
  { href: "/calculator", label: "Kalkulačka", icon: Calculator },
  { href: "/odhad", label: "Odhad", icon: Scales },
  { href: "/searches", label: "Hledání", icon: Funnel },
  { href: "/leads", label: "Pipeline", icon: GitBranch },
  { href: "/call-mode", label: "Call Mode", icon: Phone },
  { href: "/contacts", label: "Kontakty", icon: UsersThree },
  { href: "/investors", label: "Investoři", icon: HandCoins },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/vykupy", label: "Výkupy", icon: Gavel },
  { href: "/market", label: "Trh", icon: ChartBar },
  { href: "/radar", label: "Radar", icon: ChartLineUp },
  { href: "/alerts", label: "Alerty", icon: Bell },
  { href: "/tasks", label: "Úkoly", icon: ListChecks },
  { href: "/settings", label: "Nastavení", icon: GearSix },
] satisfies NavItem[];

interface NavItem {
  href: string;
  label: string;
  icon: Icon;
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const [investorBadge, setInvestorBadge] = useState(0);

  useEffect(() => {
    if (!session?.user) return;
    const load = async () => {
      try {
        const res = await fetch("/api/investors/unread-reservations");
        if (res.ok) {
          const d = await res.json();
          setInvestorBadge(d.total ?? 0);
        }
      } catch { /* ignore */ }
    };
    // Polling jen pro viditelnou záložku (snižuje DB egress na pozadí).
    const poll = () => { if (!document.hidden) load(); };
    const onVisibility = () => { if (!document.hidden) load(); };
    load();
    const t = setInterval(poll, 60_000);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [session?.user, pathname]);

  // Zavřít mobilní drawer po navigaci
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Zámek scrollu při otevřeném mobilním draweru
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const brand = (
    <span className="font-semibold tracking-tight text-sm flex-1 min-w-0 truncate">RealFlip</span>
  );

  return (
    <div className="flex min-h-[100dvh]">
      {/* ===== Mobilní iOS sheet ===== */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex max-h-[85vh] flex-col overflow-hidden rounded-t-3xl border-t border-border/50 bg-card/95 backdrop-blur-xl"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-border" />
              </div>

              {/* Hlavička + utility (zvoneček, theme toggle) — mimo scroll */}
              <div className="flex items-center gap-1.5 border-b border-border/40 px-4 py-2">
                {brand}
                <NotificationBell dropdownAlign="right" />
                <ThemeToggle collapsed className="h-10 w-10 px-0 py-0 justify-center" />
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Zavřít menu"
                  className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-card-hover transition-colors text-muted hover:text-foreground"
                >
                  <X size={18} weight="bold" />
                </button>
              </div>

              <MobileNavLinks navItems={navItems} pathname={pathname} investorBadge={investorBadge} />

              <div className="border-t border-border/50 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)]">
                {session?.user && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent text-xs font-mono font-medium">
                      {getInitials(session.user.name || session.user.email || "?")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {session.user.name || session.user.email}
                      </p>
                      <button
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="text-xs text-muted hover:text-danger transition-colors flex items-center gap-1"
                      >
                        <SignOut size={12} weight="bold" />
                        Odhlásit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===== Desktop sidebar ===== */}
      <aside
        className={cn(
          "hidden lg:flex fixed left-0 top-0 z-30 h-full flex-col bg-card/80 backdrop-blur-xl border-r border-border/50 transition-[width] duration-300",
          collapsed ? "w-[68px]" : "w-[240px]"
        )}
      >
        <div className={cn("flex h-14 items-center border-b border-border/50", collapsed ? "justify-center" : "gap-1 px-3")}>
          {!collapsed && (
            <>
              <NotificationBell />
              {brand}
            </>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Rozbalit menu" : "Zabalit menu"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-card-hover transition-colors text-muted hover:text-foreground"
          >
            <Sidebar size={18} weight="duotone" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  layout
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-accent-soft text-accent"
                      : "text-muted hover:text-foreground hover:bg-card-hover",
                    collapsed && "justify-center px-0"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-lg bg-accent/10 border border-accent/20 pointer-events-none"
                      transition={{ type: "spring", stiffness: 200, damping: 25 }}
                    />
                  )}
                  <div className="relative z-10">
                    <item.icon
                      size={20}
                      weight={isActive ? "fill" : "regular"}
                    />
                    {item.href === "/investors" && investorBadge > 0 && (
                      <span className="absolute -top-1.5 -right-2 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white px-1">
                        {investorBadge > 9 ? "9+" : investorBadge}
                      </span>
                    )}
                  </div>
                  <AnimatePresence mode="wait">
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        className="relative z-10"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border/50 p-3 space-y-1">
          <ThemeToggle collapsed={collapsed} />
          {session?.user && (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent text-xs font-mono font-medium">
                {getInitials(session.user.name || session.user.email || "?")}
              </div>
              <AnimatePresence mode="wait">
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 min-w-0"
                  >
                    <p className="text-sm font-medium truncate">
                      {session.user.name || session.user.email}
                    </p>
                    <button
                      onClick={() => signOut({ callbackUrl: "/login" })}
                      className="text-xs text-muted hover:text-danger transition-colors flex items-center gap-1"
                    >
                      <SignOut size={12} weight="bold" />
                      Odhlásit
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </aside>

      <main
        className={cn(
          "flex-1 min-h-[100dvh] bg-grid transition-all duration-300",
          collapsed ? "lg:ml-[68px]" : "lg:ml-[240px]"
        )}
      >
        <div className="max-w-[1400px] mx-auto p-3 sm:p-4 lg:p-8 pb-24 lg:pb-8">{children}</div>
      </main>

      {/* ===== Mobilní bottom nav ===== */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/50 bg-card/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 h-16">
          {bottomNavItems.map((item) => {
            const isActive = item.href === "/more" ? mobileOpen : pathname === item.href || pathname.startsWith(item.href + "/");
            return item.href === "/more" ? (
              <button
                key={item.href}
                onClick={() => setMobileOpen(true)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  isActive ? "text-accent" : "text-muted hover:text-foreground"
                )}
              >
                <item.icon size={22} weight={isActive ? "fill" : "regular"} />
                {item.label}
              </button>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  isActive ? "text-accent" : "text-muted hover:text-foreground"
                )}
              >
                <item.icon size={22} weight={isActive ? "fill" : "regular"} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

const bottomNavItems: NavItem[] = [
  { href: "/dashboard", label: "Domů", icon: House },
  { href: "/properties", label: "Nemovitosti", icon: Buildings },
  { href: "/searches", label: "Hledání", icon: Funnel },
  { href: "/leads", label: "Pipeline", icon: GitBranch },
  { href: "/more", label: "Více", icon: GridFour },
];

function MobileNavLinks({
  navItems,
  pathname,
  investorBadge,
}: {
  navItems: NavItem[];
  pathname: string;
  investorBadge: number;
}) {
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link key={item.href} href={item.href}>
            <div
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors",
                isActive
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:text-foreground hover:bg-card-hover"
              )}
            >
              {isActive && (
                <div className="absolute inset-0 rounded-lg bg-accent/10 border border-accent/20 pointer-events-none" />
              )}
              <div className="relative z-10">
                <item.icon size={18} weight={isActive ? "fill" : "regular"} />
                {item.href === "/investors" && investorBadge > 0 && (
                  <span className="absolute -top-1.5 -right-2 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white px-1">
                    {investorBadge > 9 ? "9+" : investorBadge}
                  </span>
                )}
              </div>
              <span className="relative z-10">{item.label}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
