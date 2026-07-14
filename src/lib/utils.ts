import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { cs } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatCompactPrice(price: number): string {
  if (price >= 1_000_000) {
    return `${(price / 1_000_000).toFixed(1)} mil. Kč`;
  }
  if (price >= 1_000) {
    return `${(price / 1_000).toFixed(0)} tis. Kč`;
  }
  return `${price} Kč`;
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "d. M. yyyy", { locale: cs });
}

export function formatRelative(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: cs });
}

export function daysAgo(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  return differenceInDays(new Date(), d);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trimEnd() + "...";
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function generateId(): string {
  return crypto.randomUUID().slice(0, 12);
}

export function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function investmentScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-green-400";
  if (score >= 40) return "text-yellow-400";
  if (score >= 20) return "text-orange-400";
  return "text-red-400";
}

export function investmentScoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-500/20 border-emerald-500/30";
  if (score >= 60) return "bg-green-500/20 border-green-500/30";
  if (score >= 40) return "bg-yellow-500/20 border-yellow-500/30";
  if (score >= 20) return "bg-orange-500/20 border-orange-500/30";
  return "bg-red-500/20 border-red-500/30";
}

export function recommendationLabel(score: number): string {
  if (score >= 70) return "KOUPIT";
  if (score >= 40) return "ZVÁŽIT";
  return "PŘESKOČIT";
}

export function recommendationColor(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-yellow-400";
  return "text-red-400";
}
