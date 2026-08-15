"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const THEME_KEY = "rf-theme";

function getInitialTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyTheme(theme: "dark" | "light") {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

interface ThemeToggleProps {
  collapsed?: boolean;
  className?: string;
}

export function ThemeToggle({ collapsed = false, className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setTheme(getInitialTheme());
    applyTheme(getInitialTheme());
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // localStorage unavailable (private mode) — theme still applies for the session
    }
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      title={isDark ? "Přepnout na světlý mód" : "Přepnout na tmavý mód"}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors text-muted hover:text-foreground hover:bg-card-hover",
        collapsed && "justify-center px-0",
        className
      )}
    >
      {isDark ? (
        <Sun size={18} weight="duotone" className="shrink-0" />
      ) : (
        <Moon size={18} weight="duotone" className="shrink-0" />
      )}
      {!collapsed && (
        <span>{isDark ? "Světlý mód" : "Tmavý mód"}</span>
      )}
    </button>
  );
}
