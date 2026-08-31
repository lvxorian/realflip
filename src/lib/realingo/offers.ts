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
  first: 40,
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

/** Vytáhne hlavní fotku (list je ve full-size). */
function pickMainPhoto(o: RealingoOffer): string[] {
  const list = (o.photos?.list ?? []).filter(Boolean);
  const main = o.photos?.main;
  const all = [main, ...list].filter((u): u is string => Boolean(u && u.startsWith("http")));
  // de-duplikace
  return [...new Set(all)].slice(0, 10);
}

function slugTitle(o: RealingoOffer): string {
  const cat = o.category ?? "";
  const addr = o.location?.address ?? "";
  const pieces = [cat.toUpperCase() === "PRODEJ" ? "Prodej" : o.purpose, addr, o.area?.main ? `${o.area.main} m²` : ""]
    .filter(Boolean);
  return pieces.join(" — ") || `Realingo ${o.id}`;
}

/** Namapuje Realingo nabídku na RawListing pro saveListing (včetně ratingu Valuo). */
export function toRawListing(
  o: RealingoOffer,
  stats?: RealingoPriceStats | null,
  earlyOffer = false
): RawListing {
  const pricePerSqm = o.price?.squareMeterCanonical ?? o.price?.squareMeter ?? null;
  const s = stats?.stats;
  return {
    portalName: REALINGO_PORTAL,
    url: o.url.startsWith("http") ? o.url : `https://www.realingo.cz${o.url}`,
    title: slugTitle(o),
    price: o.price?.canonical ?? o.price?.total ?? 0,
    pricePerSqm: pricePerSqm ?? null,
    area: o.area?.main ?? null,
    rooms: null,
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
