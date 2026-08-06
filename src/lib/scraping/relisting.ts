// Detekce "re-listace" — inzerát, který zmizel z portálu a byl nahozen znovu
// pod novou URL. Cílem je konzervativní shoda, aby se znovunahozený inzerát
// oživil na původním záznamu (vč. leadu/pipe/výpočtů) místo vzniku duplicity.

export const PROPERTY_STATUS = {
  ACTIVE: "active",
  REMOVED: "removed",
} as const;

export const REMOVAL_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

const STOPWORDS = new Set([
  "prodej", "prode", "koup", "koupim", "kup", "novostavba", "nemovitost",
  "pezvedni", "umi", "ceska", "republica", // místo — radši držet
]);

// Normalizace: lowercase, bez diakritiky, bez interpunkce.
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// Významné tokeny (délka >= 3) pro porovnávání adres/titulků.
export function tokenize(text: string | null | undefined): string[] {
  if (!text) return [];
  return normalizeText(text)
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .filter((t) => !STOPWORDS.has(t));
}

function intersection(a: string[], b: string[]): string[] {
  const set = new Set(b);
  return a.filter((t) => set.has(t));
}

// Porovnání dispozice: "2+1" == "2+kk", "3" == "3+1" (hlavní číslo).
export function roomsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  const av = a ? parseInt(normalizeText(a).replace(/\D.*$/, ""), 10) : NaN;
  const bv = b ? parseInt(normalizeText(b).replace(/\D.*$/, ""), 10) : NaN;
  if (Number.isNaN(av) || Number.isNaN(bv)) return false;
  return av === bv;
}

// Plocha v rámci +/- 10 %. Vrací boolean | null (null = nelze porovnat).
export function areasWithin(a: number | null | undefined, b: number | null | undefined): boolean | null {
  if (a == null || b == null || a <= 0 || b <= 0) return null;
  return Math.abs(a - b) / Math.max(a, b) <= 0.1;
}

export interface RelistCandidate {
  id: string;
  portalName: string;
  title: string | null;
  address: string | null;
  rooms: string | null;
  area: number | null;
}

export interface NewListingLike {
  portalName: string;
  title: string;
  address: string | null;
  rooms: string | null;
  area: number | null;
}

// Konzervativní shoda znovu nahozeného inzerátu se stávajícím (neaktivním) záznamem.
export function listingMatches(listing: NewListingLike, existing: RelistCandidate): boolean {
  if (existing.portalName !== listing.portalName) return false;

  const ca = tokenize(existing.address);
  const la = tokenize(listing.address);
  const shared = intersection(ca, la);

  const roomsOk = roomsEqual(listing.rooms, existing.rooms);
  const areaOk = areasWithin(listing.area, existing.area);

  // Silná shoda: dvě a více vhatných tokenů adresy.
  if (shared.length >= 2) {
    return roomsOk && areaOk !== false;
  }

  // Slabá shoda: jeden specifický token (délka >= 4, např. ulice/město).
  if (shared.length === 1 && shared[0].length >= 4) {
    return roomsOk && areaOk === true;
  }

  // Adresa příliš řídká → shoda titulů (>= 3 tokenů) jako poslední záchrana.
  const ct = tokenize(existing.title);
  const lt = tokenize(listing.title);
  if (intersection(ct, lt).length >= 3) {
    return roomsOk && areaOk !== false;
  }

  return false;
}