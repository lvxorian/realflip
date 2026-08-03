import * as cheerio from "cheerio";
import { RawListing, filterImages, isValidPrice } from "./types";
import { inferConditionFromText } from "@/lib/analysis/condition";

export const BEZREALITKY_DISPOSITION: Record<string, string> = {
  GARSONET: "1+kk",
  GARSONKA: "1+kk",
  DISP_1_KK: "1+kk",
  DISP_1_1: "1+1",
  DISP_2_KK: "2+kk",
  DISP_2_1: "2+1",
  DISP_3_KK: "3+kk",
  DISP_3_1: "3+1",
  DISP_4_KK: "4+kk",
  DISP_4_1: "4+1",
  DISP_5_KK: "5+kk",
  DISP_5_1: "5+1",
  DISP_6: "6+",
};

export const BEZREALITKY_OFFER_LABEL: Record<string, string> = {
  PRODEJ: "Prodej",
  PRONAJEM: "Pronájem",
  DRAZBA: "Dražba",
};

export const BEZREALITKY_ESTATE_LABEL: Record<string, string> = {
  BYT: "bytu",
  DUM: "domu",
  POZEMEK: "pozemku",
  GARAZ: "garáže",
  NEZISTENO: "nemovitosti",
};

export const BEZREALITKY_CONDITION: Record<string, string> = {
  NEW_BUILDING: "new",
  AFTER_RENOVATION: "renovated",
  GOOD: "good",
  ORIGINAL: "original",
  BEFORE_RENOVATION: "dilapidated",
  BAD: "dilapidated",
  DEMOLITION: "dilapidated",
  UNDER_CONSTRUCTION: "new",
};

type Cache = Record<string, unknown>;

interface ImageRef {
  __ref?: string;
  url?: string;
  [key: string]: unknown;
}

interface AdvertLike {
  __typename?: string;
  uri?: string;
  id?: string | number;
  offerType?: string | null;
  estateType?: string | null;
  disposition?: string | null;
  surface?: number | null;
  price?: number | null;
  originalPrice?: number | null;
  currency?: string | null;
  condition?: string | null;
  construction?: string | null;
  age?: string | null;
  address?: string | null;
  city?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  description?: string | null;
  etage?: number | null;
  totalFloors?: number | null;
  gps?: { lat?: number | null; lng?: number | null } | null;
  publicImages?: Array<ImageRef | null> | null;
  mainImage?: ImageRef | null;
  regionTree?: { name?: string | null }[] | null;
  imageAltText?: string | null;
}

function cleanText(text: string | null | undefined): string | null {
  if (!text) return null;
  return text.replace(/\s+/g, " ").trim();
}

/** Vyřeší ref (Image:123) nebo objekt v Apollo cache na URL fotek. */
function resolveImageUrl(ref: ImageRef | null | undefined, cache: Cache): string | null {
  if (!ref) return null;
  if (typeof ref.__ref === "string") {
    const resolved = cache[ref.__ref] as ImageRef | undefined;
    if (!resolved) return null;
    // url je v podobě klíče "url({\"filter\":\"RECORD_MAIN\"})"
    const urlKey = Object.keys(resolved).find((k) => k.startsWith("url"));
    if (urlKey) return typeof resolved[urlKey] === "string" ? resolved[urlKey] : null;
    return null;
  }
  const urlKey = Object.keys(ref).find((k) => k.startsWith("url"));
  if (urlKey) return typeof ref[urlKey] === "string" ? ref[urlKey] : null;
  if (typeof ref.url === "string") return ref.url;
  return null;
}

/** Vyřeší ref (Advert:123) na plný advert objekt z cache. */
function resolveAdvertRef(ref: ImageRef, cache: Cache): AdvertLike | null {
  if (typeof ref.__ref === "string") {
    return (cache[ref.__ref] as AdvertLike) ?? null;
  }
  return ref as AdvertLike;
}

function buildTitle(advert: AdvertLike, address: string | null, rooms: string | null, surface: number | null): string {
  const parts = [
    BEZREALITKY_OFFER_LABEL[advert.offerType ?? ""] ?? advert.offerType ?? "",
    BEZREALITKY_ESTATE_LABEL[advert.estateType ?? ""] ?? (advert.estateType ? advert.estateType.toLowerCase() : ""),
    rooms,
    surface ? `${surface} m²` : null,
    address,
  ].filter(Boolean);
  return parts.join(" ").trim();
}

/**
 * Převod advert objektu (detail nebo search cache) na RawListing.
 * Používá se pro detail (url-scraper) i search výsledky (adapter).
 */
export function parseBezrealitkyAdvert(advert: AdvertLike, cache: Cache, url: string): RawListing {
  const surface = typeof advert.surface === "number" && advert.surface > 0 ? advert.surface : null;
  const rawPrice = typeof advert.price === "number" ? advert.price : null;
  const price = isValidPrice(rawPrice ?? 0) ? rawPrice! : isValidPrice(advert.originalPrice ?? 0) ? advert.originalPrice! : 0;

  const disposition = (advert.disposition ?? "").toUpperCase();
  const rooms = BEZREALITKY_DISPOSITION[disposition] ?? null;

  const address = advert.address ?? (advert.street ? [advert.street, advert.houseNumber].filter(Boolean).join(" ") : null);

  const title = cleanText(advert.imageAltText) ?? buildTitle(advert, address, rooms, surface);

  const description = advert.description ? cheerio.load(advert.description).text().replace(/\s+/g, " ").trim() : null;

  let condition: string | null = BEZREALITKY_CONDITION[(advert.condition ?? "").toUpperCase()] ?? null;
  if (!condition) condition = inferConditionFromText(description, title);

  const buildingType = normalizeBuildingType(advert.construction ?? null);

  const yearMatch = (advert.age ?? "").match(/\b(19|20)\d{2}\b/);
  const yearBuilt = yearMatch ? parseInt(yearMatch[0]) : null;

  const floor = typeof advert.etage === "number" ? advert.etage : null;

  const images = (advert.publicImages ?? [])
    .map((img) => resolveImageUrl(img, cache))
    .filter((u): u is string => !!u);
  const imageUrls = filterImages(images, "bezrealitky");

  const now = Date.now();
  return {
    portalName: "bezrealitky",
    url,
    title,
    price,
    pricePerSqm: price > 0 && surface ? Math.round(price / surface) : null,
    area: surface,
    rooms,
    floor,
    condition,
    buildingType,
    yearBuilt,
    address: address ?? advert.city ?? null,
    lat: advert.gps?.lat ?? null,
    lng: advert.gps?.lng ?? null,
    contactPhone: null,
    contactName: null,
    contactEmail: null,
    description,
    imageUrls,
    publishedAt: now,
    updatedAt: now,
  };
}

function normalizeBuildingType(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.toLowerCase().trim();
  if (/cihl/i.test(v)) return "brick";
  if (/panel/i.test(v)) return "panel";
  if (/skelet/i.test(v)) return "mixed";
  if (/sm[íi]šen/i.test(v)) return "mixed";
  if (/montovan/i.test(v)) return "panel";
  if (/d[řr]evostavba|modul[áa]rn/i.test(v)) return "new";
  if (/kamenn/i.test(v)) return "brick";
  return null;
}

interface NextData {
  props?: {
    pageProps?: {
      origAdvert?: AdvertLike | null;
      apolloCache?: Record<string, unknown>;
    };
  };
}

function extractNextData(html: string): NextData {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/);
  if (!match) throw new Error("Nepodařilo se načíst data inzerátu (BezRealitky)");
  try {
    return JSON.parse(match[1]) as NextData;
  } catch {
    throw new Error("Nepodařilo se přečíst data inzerátu (BezRealitky)");
  }
}

/** Detailní stránka inzerátu → RawListing. */
export function parseBezrealitkyDetail(html: string, url: string): RawListing {
  const nextData = extractNextData(html);
  const pageProps = nextData.props?.pageProps ?? {};
  const cache: Cache = (pageProps.apolloCache ?? {}) as Cache;

  let advert: AdvertLike | null = pageProps.origAdvert ?? null;
  if (!advert) {
    const matchId = url.match(/\/(\d{4,})/);
    const key = matchId ? `Advert:${matchId[1]}` : null;
    advert = (key && (cache[key] as AdvertLike)) ?? Object.values(cache).find((v) => (v as AdvertLike)?.__typename === "Advert") ?? null;
  }
  if (!advert) throw new Error("Nepodařilo se najít data inzerátu (BezRealitky)");

  return parseBezrealitkyAdvert(advert, cache, url);
}

/**
 * Search stránka /vyhledat → seznam RawListing + celkový počet.
 * Čte data z Apollo cache v __NEXT_DATA__ (listAdverts).
 */
export function parseBezrealitkySearch(html: string, sourceUrl: string): { listings: RawListing[]; totalCount: number } {
  const nextData = extractNextData(html);
  const pageProps = nextData.props?.pageProps ?? {};
  const cache: Cache = (pageProps.apolloCache ?? {}) as Cache;

  const rootQuery = (cache.ROOT_QUERY ?? {}) as Record<string, unknown>;
  const listKey = Object.keys(rootQuery).find((k) => k.startsWith("listAdverts({"));
  if (!listKey) return { listings: [], totalCount: 0 };

  const listData = rootQuery[listKey] as { list?: ImageRef[]; totalCount?: number } | null;
  const refs: ImageRef[] = Array.isArray(listData?.list) ? listData.list : [];
  const totalCount = typeof listData?.totalCount === "number" ? listData.totalCount : 0;

  const listings: RawListing[] = [];
  for (const ref of refs) {
    try {
      const advert = resolveAdvertRef(ref, cache);
      if (!advert) continue;
      const id = (typeof advert.id === "string" || typeof advert.id === "number") ? String(advert.id) : "";
      const uri = advert.uri ?? "";
      const detailUrl = id
        ? `https://www.bezrealitky.cz/nemovitosti-byty-domy/${uri.startsWith(id) ? uri : `${id}-${uri}`}`
        : sourceUrl;
      listings.push(parseBezrealitkyAdvert(advert, cache, detailUrl));
    } catch {
      // skip malformed
    }
  }

  return { listings, totalCount };
}
