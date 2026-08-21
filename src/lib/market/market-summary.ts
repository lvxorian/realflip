import { db } from "@/db";
import { properties, propertyAnalysis } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface CityRow {
  name: string;
  price: number;
  listings: number;
  days: number;
}

export interface TopListing {
  id: string;
  title: string;
  city: string;
  score: number;
}

export interface MarketSummary {
  totalListings: number;
  activeListings: number;
  avgPricePerSqm: number;
  avgDays: number;
  trendPct: number;
  priceDrops: number;
  cityRows: CityRow[];
  /** Surové city keyy (slugs, např. "praha_5") pro batch /api/locality. */
  cityKeys: string[];
  topByScore: TopListing[];
}

const MEM_TTL_MS = 15 * 60 * 1000;

let memCache: { data: MarketSummary; fetchedAt: number } | null = null;

const tsNum = (v: number | string | null | undefined) => Number(v ?? 0);

/**
 * Tržní souhrn pro /market — jeden scan properties JOIN propertyAnalysis,
 * cachovaný 15 min v paměti. Výsledek se mění jen s přílivem inzerátů, proto
 * je TTL bez dopadu na UX a ušetří full scan při každém načtení stránky.
 */
export async function getMarketSummary(): Promise<MarketSummary> {
  if (memCache && Date.now() - memCache.fetchedAt < MEM_TTL_MS) {
    return memCache.data;
  }

  const props = await db
    .select({
      id: properties.id,
      title: properties.title,
      price: properties.price,
      area: properties.area,
      firstSeen: properties.firstSeen,
      lastSeen: properties.lastSeen,
      isActive: properties.isActive,
      city: propertyAnalysis.locationCity,
      score: propertyAnalysis.investmentScore,
    })
    .from(properties)
    .leftJoin(propertyAnalysis, eq(properties.id, propertyAnalysis.propertyId));

  const totalListings = props.length;
  const activeListings = props.filter((p) => p.isActive);
  const active = activeListings.length;

  const avgPricePerSqm = active > 0
    ? Math.round(activeListings.reduce((s, p) => s + ((p.price / (p.area ?? 70)) || 0), 0) / active)
    : 0;

  const avgDays = active > 0
    ? Math.round(activeListings.reduce((s, p) => s + Math.floor((Date.now() - tsNum(p.firstSeen)) / 86400000), 0) / active)
    : 0;

  const byCity: Record<string, { priceSqm: number[]; days: number[]; count: number }> = {};
  for (const p of activeListings) {
    const city = p.city ?? "Neznámá";
    if (!byCity[city]) byCity[city] = { priceSqm: [], days: [], count: 0 };
    if (p.area && p.area > 0) byCity[city].priceSqm.push(Math.round(p.price / p.area));
    byCity[city].days.push(Math.floor((Date.now() - tsNum(p.firstSeen)) / 86400000));
    byCity[city].count++;
  }

  const cityRows: CityRow[] = Object.entries(byCity)
    .map(([name, data]) => ({
      name: name === "Neznámá" ? "Neznámá" : name.replace(/_/g, " "),
      price: data.priceSqm.length > 0 ? Math.round(data.priceSqm.reduce((a, b) => a + b, 0) / data.priceSqm.length) : 0,
      listings: data.count,
      days: Math.round(data.days.reduce((a, b) => a + b, 0) / data.days.length),
    }))
    .sort((a, b) => b.price - a.price);

  // Price trend (last 7 vs prior 7 days)
  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  const twoWeeksAgo = now - 14 * 86400000;
  const recentProps = activeListings.filter((p) => tsNum(p.lastSeen) >= weekAgo);
  const olderProps = activeListings.filter((p) => {
    const t = tsNum(p.lastSeen);
    return t >= twoWeeksAgo && t < weekAgo;
  });
  const recentAvg = recentProps.length > 0 ? recentProps.reduce((s, p) => s + (p.price / (p.area ?? 70)), 0) / recentProps.length : 0;
  const olderAvg = olderProps.length > 0 ? olderProps.reduce((s, p) => s + (p.price / (p.area ?? 70)), 0) / olderProps.length : 0;
  const trendPct = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

  const priceDrops = activeListings.filter((p) => tsNum(p.lastSeen) - tsNum(p.firstSeen) > 86400000 * 14).length;

  const topByScore: TopListing[] = activeListings
    .filter((p) => p.score != null && p.score > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 4)
    .map((p) => ({
      id: p.id,
      title: p.title,
      city: (p.city ?? "Neznámá").replace(/_/g, " "),
      score: p.score ?? 0,
    }));

  const data: MarketSummary = {
    totalListings,
    activeListings: active,
    avgPricePerSqm,
    avgDays,
    trendPct,
    priceDrops,
    cityRows,
    cityKeys: Object.keys(byCity),
    topByScore,
  };
  memCache = { data, fetchedAt: Date.now() };
  return data;
}
