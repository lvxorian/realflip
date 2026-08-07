/**
 * ČSÚ — Indexy cen bytů (nabídkové ceny, 2010 = 100).
 * Zdroj: https://csu.gov.cz/produkty/ceny_bytu, kód 014008-26, vydáno 07/2026.
 *
 * Data jsou reálný výňatek z oficiální tabulky (stáhnuto a zparsováno 08/2026).
 * Slouží jako tržní trend (kontext k odhadu), nikoli jako bodové ocenění.
 * Meziroční růst: průměr 2025 → 2026 (poslední zveřejněná čísla).
 */

export interface CsuzIndexSnapshot {
  cr: number;
  crNoPraha: number;
  praha: number;
  /** meziroční růst indexu v % (průměr 2025 → průměr 2026) */
  growthPct: number;
  note: string;
  source: string;
  published: string;
}

export const CSUZ_INDEX: CsuzIndexSnapshot = {
  cr: 288.2,
  crNoPraha: 275.4,
  praha: 300.9,
  growthPct: Math.round(((288.2 / 266.4 - 1) * 1000)) / 10, // +8,2 % meziročně
  note: "Index nabídkových cen bytů, průměr roku 2010 = 100",
  source: "ČSÚ, Indexy cen bytů (014008-26)",
  published: "07/2026",
};

/** Kontextový řádek pro UI: „Trh rostl meziročně o X % dle ČSÚ". */
export function csuzTrendLabel(cityKey: string): string {
  const isPraha = cityKey === "praha";
  const value = isPraha ? CSUZ_INDEX.praha : CSUZ_INDEX.cr;
  return `${CSUZ_INDEX.source}: ${value.toLocaleString("cs-CZ")} (2010=100, ${CSUZ_INDEX.published}); meziroční růst ${CSUZ_INDEX.growthPct.toLocaleString("cs-CZ")} %`;
}
