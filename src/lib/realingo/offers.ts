import { getRealingoClient } from "./graphql-client";
import type { RealingoOffer, RealingoPriceStats, RealingoUser } from "./types";
import type { RawListing } from "@/lib/scraping/types";

export const REALINGO_PORTAL = "realingo" as const;

/** Výchozí/nastavitelné vyhledávací kritéria pro sync z Realingo. */
export interface RealingoSearchConfig {
  address: string;
  purpose: string; // SELL | RENT
  property: string; // FLAT | HOUSE | ...
  buildingStatuses: string[]; // BEFORE_RECONSTRUCTION | ...
  sort: string;
  first: number;
  maxAge?: number | null;
}

export const DEFAULT_REALINGO_SEARCH: RealingoSearchConfig = {
  address: "Praha",
  purpose: "SELL",
  property: "FLAT",
  buildingStatuses: ["BEFORE_RECONSTRUCTION"],
  sort: "NEWEST",
  // max nabídek na jeden sync (dřív 40 = jediná stránka → do DB se nikdy
  // nedostalo víc; paginace + tento strop řeší "ber jen 40")
  first: 300,
  maxAge: null,
};

const SEARCH_OFFER_QUERY = `query SearchOffer($purpose: OfferPurpose, $property: PropertyType, $address: String, $buildingStatuses: [BuildingStatus!], $maxAge: Int, $sort: OfferSort, $first: Int, $skip: Int) {
  searchOffer(filter: {purpose: $purpose, property: $property, saved: false, address: $address, buildingStatuses: $buildingStatuses, maxAge: $maxAge}, sort: $sort, first: $first, skip: $skip) {
    total
    lockedOffersCount
    items {
      id
      url
      purpose
      property
      isLocked
      createdAt
      category
      price { type total canonical squareMeter squareMeterCanonical currency }
      area { main plot }
      photos { main list }
      location { address latitude longitude }
    }
  }
}`;

const LOAD_PRICE_STATS_QUERY = `query LoadPriceStats($ids: [ID!]!) {
  loadPriceStats(ids: $ids) {
    offerId
    status
    stats { tier label iqrDeviation n lowConfidence effectivePriceCzk bands { label minCzk maxCzk } }
    error
  }
}`;

const PREMIUM_STATUS_QUERY = `query ValuationDialogGetUserPremiumStatus {
  auth { user { id email premiumPlan } }
}`;

interface SearchOfferResp {
  searchOffer: {
    total: number;
    lockedOffersCount: number;
    items: RealingoOffer[];
  };
}

interface PriceStatsResp {
  loadPriceStats: RealingoPriceStats[];
}

/**
 * Fotky z SearchOffer. Realingo mění tvar (string vs {url} objekt, list vs
 * pole) a locked/předstih nabídky fotky v searchu nevrací vůbec — proto
 * tolerantní parsování + prázdný výsledek (na řadě pak obohacujeme z detailu).
 */
function photoUrl(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["url", "raw", "path", "src"]) {
      if (typeof o[k] === "string") return o[k] as string;
    }
  }
  return null;
}

function pickMainPhoto(o: RealingoOffer): string[] {
  const raw: unknown[] = [];
  const p = o.photos as unknown as
    | { main?: unknown; list?: unknown }
    | string[]
    | null
    | undefined;
  if (Array.isArray(p)) {
    raw.push(...p);
  } else if (p && typeof p === "object") {
    raw.push(p.main ?? null);
    if (Array.isArray(p.list)) raw.push(...(p.list as unknown[]));
    else if (p.list) raw.push(p.list);
  }
  const all = raw
    .map(photoUrl)
    .filter((u): u is string => Boolean(u && u.startsWith("http")));
  return [...new Set(all)].slice(0, 10);
}

const PURPOSE_CZ: Record<string, string> = { SELL: "Prodej", RENT: "Pronájem" };
const PROPERTY_CZ: Record<string, string> = {
  FLAT: "bytu",
  HOUSE: "domu",
  LAND: "pozemku",
  GARAGE: "garáže",
  OFFICE: "kanceláře",
  COMMERCIAL: "komerčního prostoru",
  OTHER: "nemovitosti",
};

/**
 * Dispozice („3+kk") z SEO slugu Realinga: /prodej/byt-3+1-bukovecka-praha/…
 * `category` od API bývá null a „ostatni-byty" dispozici neobsahuje → null.
 */
export function roomsFromRealingoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:^|[-_/])(\d\+(?:kk|nn|\d{1,2}))(?:[-_/.]|$)/i);
  return m ? m[1].toLowerCase() : null;
}

/** Titulek karty: „Prodej bytu 3+1 · 71 m²“ (adresa se ukazuje pod ním zvlášť). */
function slugTitle(o: RealingoOffer, rooms: string | null): string {
  const action = PURPOSE_CZ[(o.purpose ?? "").toUpperCase()] ?? "Nabídka";
  const what = PROPERTY_CZ[(o.property ?? "").toUpperCase()] ?? "nemovitosti";
  const area = o.area?.main ? `${Math.round(o.area.main)} m²` : null;
  const head = `${action} ${what}${rooms ? ` ${rooms}` : ""}`;
  return [head, area].filter(Boolean).join(" · ") || `Realingo ${o.id}`;
}

/** Namapuje Realingo nabídku na RawListing pro saveListing (včetně ratingu Valuo). */
export function toRawListing(
  o: RealingoOffer,
  stats?: RealingoPriceStats | null,
  earlyOffer = false
): RawListing {
  const pricePerSqm = o.price?.squareMeterCanonical ?? o.price?.squareMeter ?? null;
  const s = stats?.stats;
  const rooms = (typeof (o as { rooms?: unknown }).rooms === "string" ? (o as { rooms?: string }).rooms : null)
    ?? roomsFromRealingoUrl(o.url);
  return {
    portalName: REALINGO_PORTAL,
    url: o.url.startsWith("http") ? o.url : `https://www.realingo.cz${o.url}`,
    title: slugTitle(o, rooms),
    price: o.price?.canonical ?? o.price?.total ?? 0,
    pricePerSqm: pricePerSqm ?? null,
    area: o.area?.main ?? null,
    rooms: rooms,
    floor: null,
    condition: null,
    buildingType: null,
    yearBuilt: null,
    address: o.location?.address ?? null,
    lat: o.location?.latitude ?? null,
    lng: o.location?.longitude ?? null,
    contactPhone: null,
    contactName: null,
    contactEmail: null,
    description: null,
    imageUrls: pickMainPhoto(o),
    publishedAt: o.createdAt ? Date.parse(o.createdAt) : Date.now(),
    updatedAt: Date.now(),
    realingoId: o.id,
    priceRating: s?.label ?? null,
    priceTier: s?.tier ?? null,
    priceRatingJson: s ? JSON.stringify(s) : null,
    isEarlyOffer: earlyOffer,
  };
}

/** Vyhledá nabídky + jejich cenové ratingy (Valuo) naráz. */
export async function fetchRealingoOffers(
  cfg: RealingoSearchConfig = DEFAULT_REALINGO_SEARCH,
  skip = 0
): Promise<{
  items: RealingoOffer[];
  stats: Map<string, RealingoPriceStats>;
  total: number;
  lockedOffersCount: number;
}> {
  const client = getRealingoClient();
  const vars = {
    purpose: cfg.purpose,
    property: cfg.property,
    address: cfg.address,
    buildingStatuses: cfg.buildingStatuses,
    maxAge: cfg.maxAge ?? null,
    sort: cfg.sort,
    first: cfg.first,
    skip,
  };
  const res = await client.gql<SearchOfferResp>(
    SEARCH_OFFER_QUERY,
    "SearchOffer",
    vars as Record<string, unknown>
  );
  if (res.errors?.length) {
    throw new Error(res.errors.map((e) => e.message).join("; "));
  }
  const data = res.data?.searchOffer;
  const items = data?.items ?? [];

  let stats = new Map<string, RealingoPriceStats>();
  if (items.length > 0) {
    const ids = items.map((i) => i.id);
    const sres = await client.gql<PriceStatsResp>(LOAD_PRICE_STATS_QUERY, "LoadPriceStats", { ids });
    if (sres.data?.loadPriceStats) {
      stats = new Map(sres.data.loadPriceStats.map((s) => [s.offerId, s]));
    }
  }

  return {
    items,
    stats,
    total: data?.total ?? 0,
    lockedOffersCount: data?.lockedOffersCount ?? 0,
  };
}

export const REALINGO_PAGE_SIZE = 100;

/** Doplňkový odběr ratingů jen pro vybrané id (pending stats po prvním kole). */
export async function fetchPriceStatsByIds(
  ids: string[]
): Promise<Map<string, RealingoPriceStats>> {
  const stats = new Map<string, RealingoPriceStats>();
  if (ids.length === 0) return stats;
  const client = getRealingoClient();
  for (let i = 0; i < ids.length; i += REALINGO_PAGE_SIZE) {
    const chunk = ids.slice(i, i + REALINGO_PAGE_SIZE);
    const res = await client.gql<PriceStatsResp>(LOAD_PRICE_STATS_QUERY, "LoadPriceStats", { ids: chunk });
    for (const s of res.data?.loadPriceStats ?? []) stats.set(s.offerId, s);
  }
  return stats;
}

/** Ověří účet a vrátí informace o uživateli (příp. plán). */
export async function getRealingoUser(): Promise<RealingoUser | null> {
  const client = getRealingoClient();
  const res = await client.gql<{ auth: { user: RealingoUser } }>(
    PREMIUM_STATUS_QUERY,
    "ValuationDialogGetUserPremiumStatus",
    {}
  );
  return res.data?.auth?.user ?? null;
}

/**
 * Kompletní paginovaný odběr nabídek: `maxItems` = uživatelský strop
 * (dřívější chování = jediná stránka `first: 40`, takže se do DB nikdy
 * nedostalo víc než 40 newest). `timeBudgetMs` chrání 60s serverless limit —
 * sync se ukončí na.complete stránce a zbytek doručí až příště (NEWEST
 * řazení + idempotentní saveListing = bez ztrát).
 */
export async function fetchAllRealingoOffers(
  cfg: RealingoSearchConfig,
  opts: { maxItems?: number; timeBudgetMs?: number } = {}
): Promise<{
  items: RealingoOffer[];
  stats: Map<string, RealingoPriceStats>;
  total: number;
  lockedOffersCount: number;
  complete: boolean;
}> {
  const maxItems = Math.max(1, opts.maxItems ?? cfg.first ?? DEFAULT_REALINGO_SEARCH.first);
  const timeBudgetMs = opts.timeBudgetMs ?? 45_000;
  const started = Date.now();
  const items: RealingoOffer[] = [];
  const stats = new Map<string, RealingoPriceStats>();
  let total = 0;
  let lockedOffersCount = 0;
  let complete = false;

  while (items.length < maxItems) {
    const pageSize = Math.min(REALINGO_PAGE_SIZE, maxItems - items.length);
    const page = await fetchRealingoOffers({ ...cfg, first: pageSize }, items.length);
    total = page.total;
    lockedOffersCount = page.lockedOffersCount;
    for (const it of page.items) items.push(it);
    for (const [k, v] of page.stats) stats.set(k, v);
    if (page.items.length === 0 || items.length >= total) {
      complete = true;
      break;
    }
    if (Date.now() - started > timeBudgetMs) break; // časový budget → zbytek příště
  }

  return { items: items.slice(0, maxItems), stats, total, lockedOffersCount, complete };
}
