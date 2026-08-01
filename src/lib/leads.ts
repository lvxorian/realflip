export const LEAD_STAGES = [
  { key: "new", label: "Nový", color: "border-l-accent", dot: "bg-accent" },
  { key: "contacted", label: "Kontaktován", color: "border-l-blue-500", dot: "bg-blue-500" },
  { key: "meeting", label: "Schůzka", color: "border-l-amber-500", dot: "bg-amber-500" },
  { key: "offer", label: "Nabídka", color: "border-l-emerald-500", dot: "bg-emerald-500" },
  { key: "negotiation", label: "Vyjednávání", color: "border-l-emerald-400", dot: "bg-emerald-400" },
  { key: "closed", label: "Uzavřeno", color: "border-l-emerald-600", dot: "bg-emerald-600" },
  { key: "lost", label: "Ztraceno", color: "border-l-red-500", dot: "bg-red-500" },
] as const;

export const LEAD_STAGE_KEYS = new Set<string>(LEAD_STAGES.map((s) => s.key));

export function isValidLeadStage(stage: string): boolean {
  return LEAD_STAGE_KEYS.has(stage);
}
