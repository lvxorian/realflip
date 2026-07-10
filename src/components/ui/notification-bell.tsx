"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  data: { propertyId?: string; undervaluationPct?: number; price?: number } | null;
  createdAt: Date;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items);
        setUnreadCount(d.unreadCount);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-card-hover transition-colors text-muted hover:text-foreground"
      >
        <Bell size={16} weight={open ? "fill" : "regular"} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-[14px] flex items-center justify-center rounded-full bg-danger text-[8px] font-bold text-white px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute left-0 top-full mt-2 w-80 rounded-2xl border border-border/50 bg-card shadow-xl overflow-hidden z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <h3 className="text-xs font-semibold tracking-tight uppercase text-muted">
                Upozornění
              </h3>
              {unreadCount > 0 && (
                <span className="text-[10px] text-muted">
                  {unreadCount} nových
                </span>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted">
                  Žádná upozornění
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-card-hover cursor-pointer border-b border-border/30 last:border-0",
                      !item.read && "bg-accent/5"
                    )}
                    onClick={() => {
                      markRead(item.id);
                      if (item.data?.propertyId) {
                        window.location.href = `/properties/${item.data.propertyId}`;
                      }
                      setOpen(false);
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold tracking-tight">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-muted mt-0.5 line-clamp-2">
                        {item.message}
                      </p>
                    </div>
                    {!item.read && (
                      <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0 mt-1" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markRead(item.id);
                      }}
                      className="shrink-0 text-muted hover:text-foreground"
                    >
                      <X size={12} weight="bold" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <Link
              href="/alerts"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-center text-xs text-accent hover:bg-accent/5 border-t border-border/50 font-medium"
            >
              Spravovat alerty
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
