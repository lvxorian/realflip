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

export function formatDate(date: Date | string | number): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return format(d, "d. M. yyyy", { locale: cs });
}

export function formatRelative(date: Date | string | number): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: cs });
}

export function daysAgo(date: Date | string | number): number {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
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

export function ts(): number {
  return Date.now();
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

const CONDITION_LABELS: Record<string, string> = {
  new: "Novostavba",
  renovated: "Po rekonstrukci",
  good: "Dobrý",
  original: "Původní",
  dilapidated: "Zchátralý",
  project: "Projekt",
};

export function conditionLabel(condition: string | null): string {
  return condition ? CONDITION_LABELS[condition] ?? condition : "—";
}

const BUILDING_TYPE_LABELS: Record<string, string> = {
  brick: "Cihlový",
  panel: "Panelový",
  new: "Novostavba",
  mixed: "Smíšený",
};

export function buildingTypeLabel(type: string | null): string {
  return type ? BUILDING_TYPE_LABELS[type] ?? type : "—";
}

const OCCUPANCY_LABELS: Record<string, string> = {
  tenant: "Nájemník",
  owner: "Majitel",
  vacant: "Prázdný",
};

export function occupancyLabel(occupancy: string | null): string {
  return occupancy ? OCCUPANCY_LABELS[occupancy] ?? occupancy : "—";
}

const LOCATION_CATEGORY_LABELS: Record<string, string> = {
  best: "Nejlepší",
  good: "Dobrá",
  ok: "Průměrná",
  niche: "Okrajová",
  poor: "Slabá",
  stable: "Stabilní",
  growing: "Rostoucí",
};

export function locationCategoryLabel(category: string | null): string {
  return category ? LOCATION_CATEGORY_LABELS[category] ?? category : "—";
}

const PORTAL_LABELS: Record<string, string> = {
  sreality: "Sreality",
  bazos: "Bazos",
  annonce: "Annonce",
  mmreality: "MMReality",
  "reality-cz": "Reality.cz",
  hyperinzerce: "Hyperinzerce",
  bezrealitky: "BezRealitky",
  remax: "RE/MAX",
  century21: "Century 21",
};

export function portalLabel(name: string | null): string {
  return name ? PORTAL_LABELS[name] ?? name.charAt(0).toUpperCase() + name.slice(1) : "—";
}

export function formatPhone(phone: string | null): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\s+/g, "");
  const match = cleaned.match(/^(\+\d{3})(\d{3})(\d{3})(\d{3})$/);
  if (match) return `${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
  const localMatch = cleaned.match(/^(\d{3})(\d{3})(\d{3})$/);
  if (localMatch) return `${localMatch[1]} ${localMatch[2]} ${localMatch[3]}`;
  return phone;
}
