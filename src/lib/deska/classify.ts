export type DeskaCategory =
  | "PRODEJ"
  | "DRAZBA"
  | "EXEKUCE"
  | "DEDICTVI"
  | "STAVEBNI_RIZENI"
  | "JINE";

export type DeskaRelevance = "HIGH" | "MEDIUM" | "LOW";

const CATEGORY_KEYWORDS: Record<DeskaCategory, string[]> = {
  PRODEJ: [
    "prodej",
    "odprodej",
    "záměr prodeje",
    "zamer prodeje",
    "prodej majetku",
    "prodej nemovitosti",
    "prodej pozemku",
    "nabídka prodeje",
    "nabidka prodeje",
    "prodej bytu",
    "prodej domu",
    "prodej rodinného domu",
    "prodej garáže",
    "prodej nebytového prostoru",
    "veřejná soutěž",
    "verejna soutez",
    "poptávka prodej",
  ],
  DRAZBA: [
    "dražba",
    "drazba",
    "dražba nemovitost",
    "drazba nemovitosti",
    "veřejná dražba",
    "verejna drazba",
    "dražební vyhláška",
    "drazbni vyhlaska",
    "dražebník",
    "drazbnik",
  ],
  EXEKUCE: [
    "exekuce",
    "exekuční",
    "exekucni",
    "výkonnáí řízení",
    "vykonaci rizeni",
    "nařízení exekuce",
    "narezeni exekuce",
    "exekuční příkaz",
    "exekucni prikaz",
    "soudní exekuce",
    "soudni exekuce",
  ],
  DEDICTVI: [
    "odúmrtí",
    "odumrti",
    "hledání dědiců",
    "hledani dedicu",
    "dědické řízení",
    "dedicke rizeni",
    "nepoctivý dědic",
    "nepoctivy dedic",
    "odúmrtnost",
    "odumrtnost",
    "nepřihlášený dědic",
    "neprisliceny dedic",
  ],
  STAVEBNI_RIZENI: [
    "stavební řízení",
    "stavebni rizeni",
    "územní rozhodnutí",
    "uzemni rozhodnuti",
    "kolaudace",
    "stavební povolení",
    "stavebni povoleni",
    "ohlášení stavby",
    "ohlaseni stavby",
    "územní plán",
    "uzemni plan",
    "změna územního plánu",
    "zmena uzemniho planu",
    "stavební úpravy",
    "stavebni upravy",
    "stavební záměr",
    "stavebni zamer",
    "demolice",
    "návrh na umístění",
    "navrh na umisteni",
    "územní souhlas",
    "uzemni souhlas",
    "stavební dokumentace",
    "stavebni dokumentace",
  ],
  JINE: [],
};

const RELEVANCE_MAP: Record<string, DeskaRelevance> = {
  PRODEJ: "HIGH",
  DRAZBA: "HIGH",
  EXEKUCE: "HIGH",
  DEDICTVI: "MEDIUM",
  STAVEBNI_RIZENI: "MEDIUM",
  JINE: "LOW",
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyDocument(
  name: string,
  textContent?: string | null,
): { category: DeskaCategory; relevance: DeskaRelevance; keywordsMatched: string[] } {
  const combined = normalizeText(`${name} ${textContent ?? ""}`);
  const matchedKeywords: string[] = [];
  let bestCategory: DeskaCategory = "JINE";

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [DeskaCategory, string[]][]) {
    if (category === "JINE") continue;
    for (const kw of keywords) {
      if (combined.includes(normalizeText(kw))) {
        matchedKeywords.push(kw);
        bestCategory = category;
        break;
      }
    }
  }

  return {
    category: bestCategory,
    relevance: RELEVANCE_MAP[bestCategory],
    keywordsMatched: [...new Set(matchedKeywords)],
  };
}
