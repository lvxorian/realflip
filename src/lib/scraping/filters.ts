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
  {
    type: "flat",
    patterns: [/bytu\b/i, /byty\b/i, /byt\b/i, /garsonk/i, /bytov[áé]? jednotk/i],
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
