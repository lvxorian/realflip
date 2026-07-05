"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  Phone,
  KanbanSquare,
  Users,
  Briefcase,
  TrendingUp,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/properties", label: "Nemovitosti", icon: Building2 },
  { href: "/leads", label: "Pipeline", icon: KanbanSquare },
  { href: "/call-mode", label: "Call Mode", icon: Phone },
  { href: "/contacts", label: "Kontakty", icon: Users },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/market", label: "Trh", icon: TrendingUp },
  { href: "/alerts", label: "Alerty", icon: Bell },
  { href: "/settings", label: "Nastavení", icon: Settings },
];

interface SidebarProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <motion.aside
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="relative flex flex-col border-r border-border bg-card/50 backdrop-blur-xl z-30"
      >
        {/* Logo */}
        <div className={cn("flex items-center gap-3 px-4 h-16 border-b border-border", collapsed && "justify-center")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 border border-accent/30">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="text-lg font-bold bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent whitespace-nowrap"
              >
                RealFlip
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-accent/15 text-accent border border-accent/30"
                    : "text-muted hover:bg-card-hover hover:text-foreground hover:border hover:border-border",
                  collapsed && "justify-center px-2"
                )}
              >
                <Icon size={20} className="shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="active-nav"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-accent rounded-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className={cn("border-t border-border p-3", collapsed && "flex flex-col items-center")}>
          {session?.user && (
            <div className={cn("flex items-center gap-3", collapsed && "flex-col")}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/20 border border-accent/30 text-sm font-medium text-accent">
                {getInitials(session.user.name || session.user.email || "U")}
              </div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 min-w-0"
                  >
                    <p className="text-sm font-medium truncate">
                      {session.user.name || "Uživatel"}
                    </p>
                    <p className="text-xs text-muted truncate">{session.user.email}</p>
                  </motion.div>
                )}
              </AnimatePresence>
              {!collapsed && (
                <button
                  onClick={() => signOut()}
                  className="shrink-0 text-muted hover:text-danger transition-colors"
                  title="Odhlásit se"
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted hover:text-foreground transition-colors z-10"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </motion.aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-grid">
        <div className="noise-overlay" />
        <div className="relative z-10 p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
