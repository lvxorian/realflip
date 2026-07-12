export type PropertyCondition = "new" | "renovated" | "good" | "original" | "dilapidated";

type Signal = { pattern: RegExp; category: PropertyCondition; weight: number };

const SIGNALS: Signal[] = [
  { pattern: /novostavba/i, category: "new", weight: 10 },
  { pattern: /nov[ýy]\s*objekt/i, category: "new", weight: 10 },
  { pattern: /ve\s*výstavbě/i, category: "new", weight: 10 },
  { pattern: /zkolaudováno/i, category: "new", weight: 8 },

  { pattern: /dezolátn[íi]/i, category: "dilapidated", weight: 10 },
  { pattern: /k\s*demolici/i, category: "dilapidated", weight: 10 },
  { pattern: /zřícen[ýy]/i, category: "dilapidated", weight: 10 },

  { pattern: /po\s*(kompletní|generální|celkové)?\s*rekonstrukci/i, category: "renovated", weight: 6 },
  { pattern: /zrekonstruovan[ýy]/i, category: "renovated", weight: 6 },
  { pattern: /kompletní\s*rekonstrukce/i, category: "renovated", weight: 5 },
  { pattern: /generální\s*rekonstrukce/i, category: "renovated", weight: 5 },
  { pattern: /rekonstruovan[ýy]/i, category: "renovated", weight: 4 },
  { pattern: /zrekonstruov[aá]no\s*v\s*roce/i, category: "renovated", weight: 4 },

  { pattern: /nov[áa]\s*koupelna/i, category: "renovated", weight: 2 },
  { pattern: /nov[áa]\s*kuchyn[ěe]/i, category: "renovated", weight: 2 },
  { pattern: /nov[áa]\s*okna/i, category: "renovated", weight: 1 },
  { pattern: /nov[ée]\s*podlahy/i, category: "renovated", weight: 1 },

  { pattern: /původn[íi]\s*stav/i, category: "original", weight: 5 },
  { pattern: /původn[íi]/i, category: "original", weight: 3 },
  { pattern: /před\s*rekonstrukc[íi]/i, category: "original", weight: 4 },
  { pattern: /k\s*(celkové)?\s*rekonstrukci/i, category: "original", weight: 4 },
  { pattern: /nutn[áa]\s*rekonstrukce/i, category: "original", weight: 3 },
  { pattern: /špatn[ýy]\s*stav/i, category: "original", weight: 3 },
  { pattern: /project/i, category: "original", weight: 3 },

  { pattern: /velmi\s*dobr[ýy]\s*stav/i, category: "good", weight: 3 },
  { pattern: /udržovan[ýy]/i, category: "good", weight: 3 },
  { pattern: /zateplen[ýy]/i, category: "good", weight: 2 },
  { pattern: /po\s*částečné\s*rekonstrukci/i, category: "good", weight: 3 },
  { pattern: /částečně\s*rekonstruovan[ýy]/i, category: "good", weight: 3 },
  { pattern: /stavebně\s*upraven[oý]/i, category: "good", weight: 2 },
  { pattern: /dobr[ýy]\s*stav/i, category: "good", weight: 1 },
];

export function inferConditionFromText(...texts: (string | null | undefined)[]): PropertyCondition | null {
  const combined = texts.filter(Boolean).join(" ");
  if (!combined) return null;

  const scores: Record<string, number> = {};

  for (const { pattern, category, weight } of SIGNALS) {
    if (pattern.test(combined)) {
      scores[category] = (scores[category] || 0) + weight;
    }
  }

  const n = scores["new"] || 0;
  const r = scores["renovated"] || 0;
  const g = scores["good"] || 0;
  const o = scores["original"] || 0;
  const d = scores["dilapidated"] || 0;

  if (n >= 10) return "new";
  if (d >= 10) return "dilapidated";
  if (r >= 5) return "renovated";
  if (o >= 5 && r >= 2) return "good";
  if (o >= 5) return "original";
  if (r >= 2) return "good";
  if (g >= 2) return "good";
  if (o >= 2) return "original";

  return null;
}

export function normalizeCondition(raw: string | null): PropertyCondition | null {
  if (!raw) return null;
  const c = raw.toLowerCase().trim();

  if (c === "new" || c === "renovated" || c === "good" || c === "original" || c === "dilapidated") return c;
  if (c === "project") return "original";

  return inferConditionFromText(c) ?? null;
}
