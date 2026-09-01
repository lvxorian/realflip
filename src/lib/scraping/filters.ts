import type { RawListing, SearchFilters } from "./types";

function listingText(listing: RawListing): string {
  return [listing.address, listing.title].filter(Boolean).join(" ").toLowerCase();
}

/** Bounding box České republiky pro validaci GPS souřadnic. */
const CZ_BBOX = { latMin: 48.5, latMax: 51.06, lngMin: 12.1, lngMax: 18.9 };

/** Textové markery zahraničních lokací (použité, když v inzerátu chybí GPS). */
/** Textové markery zahraničních lokací (použité, když v inzerátu chybí GPS). */
const FOREIGN_ADDRESS_MARKERS: RegExp[] = [
  /\bberl/,
  /deutschland/i,
  /\bgermany\b/i,
  /münchen|muenchen/i,
  /\bhamburg\b/i,
  /\bwien\b/i,
  /warszaw/i,
  /bratislav/i,
  /dresden/i,
  /leipzig/i,
  /frankfurt/i,
  /\bköl[nk]\b/i,
  /německu|nemecku|německo|nemecko/i,
  // Balkán – bulharská/chorvatská letoviska a města
  /\bnesebar/i,
  /\bsveti\b/i,
  /\bvarna\b/i,
  /\bburgas\b/i,
  /\bsunny beach\b/i,
  /\bvir\b/i,
  /bulharsk|bulgari|болга/i,
  /chorvat|chorvats|croat/i,
];

/**
 * Ověří, že inzerát pochází z České republiky. Prioritně se řídí GPS
 * souřadnicemi (bounding box ČR); pokud GPS chybí, použijí se textové
 * markery v adrese/titulku. Zabraňuje proplouvání zahraničních inzerátů
 * do databáze (např. Berlín z bezrealitky).
 */
export function isCzechListing(
  listing: Pick<RawListing, "lat" | "lng" | "address" | "title">
): boolean {
  if (listing.lat != null && listing.lng != null) {
    return (
      listing.lat >= CZ_BBOX.latMin &&
      listing.lat <= CZ_BBOX.latMax &&
      listing.lng >= CZ_BBOX.lngMin &&
      listing.lng <= CZ_BBOX.lngMax
    );
  }

  const text = [listing.address, listing.title].filter(Boolean).join(" ").toLowerCase();
  return !FOREIGN_ADDRESS_MARKERS.some((m) => m.test(text));
}

const PROPERTY_TYPE_PATTERNS: { type: string; patterns: RegExp[] }[] = [
  // FLAT má přednost před house/land/garage (stejné rozhodnutí jako inferType
  // v Odhadu, Phase 48): „Prodej bytu 3+1 v rodinném domě…", „byt se zahradou",
  // „byt s garáží" jsou byty — dříve je house/land/garage regex strhly na sebe
  // a saved-search s filtrem „byty" je tiše zahazoval.
  {
    type: "flat",
    patterns: [/bytu\b/i, /byty\b/i, /byt\b/i, /garsonk/i, /bytov[áé]? jednotk/i, /mezon[eu]/i],
  },
  {
    type: "garage",
    patterns: [/gar[áa]ž/i, /garage/i, /parkovac[íi] st[áa]n[ií]/i],
  },
  {
    type: "land",
    patterns: [/pozemk/i, /stavebn[íi] parcela/i, /zahrad/i],
  },
  {
    type: "house",
    patterns: [
      /dom[uů]/i,
      /vil[ay]/i,
      /chalup/i,
      /usedlost/i,
      /dvougenera[čc]/i,
      /rodinn[éý]ho? domu/i,
    ],
  },
  {
    type: "commercial",
    patterns: [
      /kancel[áa][řr]/i,
      /komer[čc]n/i,
      /obchodn[íi] prostor/i,
      /provozovn/i,
      /sklad/i,
      /administrativn/i,
      /restaurac/i,
      /hotel/i,
      /kav[áa]rn/i,
    ],
  },
];

export function detectPropertyType(title: string | null, url?: string): string | null {
  const text = [title, url].filter(Boolean).join(" ").toLowerCase();
  if (!text) return null;

  for (const { type, patterns } of PROPERTY_TYPE_PATTERNS) {
    if (patterns.some((p) => p.test(text))) return type;
  }

  // Room patterns (2+1, 3+kk) imply a flat when no other type is detected
  if (/(\d)\s*\+\s*(\d|kk)/i.test(text)) return "flat";

  return null;
}

/** Zafolduje českou diakritiku a převede na lowercase (pro robustní hledání). */
function normalizeText(s: string): string {
  const map: Record<string, string> = {
    á: "a", č: "c", ď: "d", é: "e", ě: "e", í: "i", ň: "n",
    ó: "o", ř: "r", š: "s", ť: "t", ú: "u", ů: "u", ý: "y", ž: "z",
  };
  return s.toLowerCase().split("").map((ch) => map[ch] ?? ch).join("");
}

/** Nájemní signály v titulku/adrese/URL — inzerát tímto je nájem. */
const RENT_MAIN_PATTERNS: RegExp[] = [
  /\bpron[áa]jem\b/,
  /\bpronajmu\b/,
  /\bpronajmeme\b/,
  /\bpronaj[íi]m[áa]m\b/,
  /\bpodn[áa]jem\b/,
  /\bpodn[áa]jm[uů]\b/,
  /\bprenajem\b/,
  /\bn[áa]\s+pron[áa]jem\b/,
  /\bk\s+pron[áa]jm[uů]\b/,
];

/** Nájemní signály v popisu — jen jednoznačné nabídky, ne marketingové zmínky. */
const RENT_BODY_PATTERNS: RegExp[] = [
  /\bpronajmeme\b/,
  /\bpronaj[íi]m[áa]m\b/,
  /\bpodn[áa]jem\b/,
  /\bpodn[áa]jm[uů]\b/,
];

/** Nákupní poptávky — signály v hlavním textu (titulek/adresa/URL). */
const BUY_MAIN_PATTERNS: RegExp[] = [
  /\bpopt[áa]vk/,
  /\bkoup[íi]m\b/,
  /\bkoup[íi]me\b/,
  /\bkupuji\b/,
  /\bhled[áa]m[ei]?\s+(?:byt|byty|d[ůu]m|nemovit)/i,
  /\bsh[áa]n[ěei]?m?\b/,
  /\bnab[íi]dn[ěe]te\b/,
];

/** Nákupní poptávky — signály v popisu, které se v prodejním marketingovém textu neobjeví. */
const BUY_BODY_PATTERNS: RegExp[] = [
  /\bkoup[íi]m\b/,
  /\bkoup[íi]me\b/,
  /\bkupuji\b/,
  /\bhled[áa]m[ei]?\s+(?:byt|byty|d[ůu]m|nemovit)/i,
  /\bsh[áa]n[ěei]?m?\b/,
  /\bnab[íi]dn[ěe]te\b/,
];

const BUY_VERB_PATTERN = /\bkoupi\b/;

const SALE_SAFE_PHRASES: RegExp[] = [
  /\bke\s+koupi\b/,
  /\bk\s+koupi\b/,
  /\bna\s+prodej\b/,
  /\bprodej/,
  /\bproda[á]m\b/,
  /\bk\s+prodeji\b/,
  /\bprod[áa]v[ám]/i,
];

/**
 * Říká, zda je inzerát prodejní nabídkou. Vrací false pro:
 * - nákupní poptávky (koupím/koupí jako sloveso, poptávka, hledáme byt, nabídněte...),
 * - nájemní nabídky (pronájem, podnájem).
 * Výrazy pro prodej ("Byt ke koupi", "na prodej", "prodám") vrací true.
 * Zmínka o tržní poptávce nebo možnosti pronájmu v popisu prodejního inzerátu
 * inzerát nezatracuje.
 */
export function isSaleListing(
  listing: Pick<RawListing, "title" | "url"> &
    Partial<Pick<RawListing, "address" | "description">>
): boolean {
  const mainText = normalizeText(
    [listing.title, listing.address, listing.url].filter(Boolean).join(" ")
  );
  const bodyText = normalizeText(listing.description ?? "");

  if (RENT_MAIN_PATTERNS.some((re) => re.test(mainText))) return false;
  if (RENT_BODY_PATTERNS.some((re) => re.test(bodyText))) return false;
  if (BUY_MAIN_PATTERNS.some((re) => re.test(mainText))) return false;
  if (BUY_BODY_PATTERNS.some((re) => re.test(bodyText))) return false;

  if (hasBuyVerbPattern(mainText) && !SALE_SAFE_PHRASES.some((re) => re.test(mainText))) {
    return false;
  }

  return true;
}

function hasBuyVerbPattern(text: string): boolean {
  return BUY_VERB_PATTERN.test(text);
}

export function matchFilters(listing: RawListing, filters: SearchFilters): boolean {
  if (filters.location) {
    const loc = filters.location.toLowerCase().trim();
    if (loc && !listingText(listing).includes(loc)) return false;
  }
  if (filters.district) {
    const dist = filters.district.toLowerCase().trim();
    if (dist && !listingText(listing).includes(dist)) return false;
  }
  if (filters.propertyType) {
    const detected = detectPropertyType(listing.title, listing.url);
    if (detected && detected !== filters.propertyType) return false;
  }
  if (filters.priceMin != null && listing.price < filters.priceMin) return false;
  if (filters.priceMax != null && listing.price > filters.priceMax) return false;
  if (filters.areaMin != null && (listing.area ?? 0) < filters.areaMin) return false;
  if (filters.areaMax != null && (listing.area ?? 0) > filters.areaMax) return false;
  return true;
}
