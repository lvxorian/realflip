import { db } from "@/db";
import { rents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ts } from "@/lib/utils";
import { cityNamesFor, addressMatchesCity } from "@/lib/analysis/location";
import { scoreTransportDistance as transportScore } from "./score";

const BASE_API = "https://www.sreality.cz/api/v1/estates/search";
const RESULTS_PER_PAGE = 100;
const MAX_PAGES = 2;

const HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.sreality.cz/",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
};

export interface TransportSample {
  pricePerSqm: number;
  metroDistance: number | null;
  trainDistance: number | null;
  busDistance: number | null;
}

export async function scrapeTransportSamples(cityKey: string, limit = 80): Promise<TransportSample[]> {
  const cityNames = cityNamesFor(cityKey);
  const samples: TransportSample[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * RESULTS_PER_PAGE;
    const url = `${BASE_API}?category_main_cb=1&category_type_cb=1&limit=${RESULTS_PER_PAGE}&offset=${offset}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      if (res.status === 429 || res.status === 403) {
        await new Promise((r) => setTimeout(r, 20000));
        return scrapeTransportSamples(cityKey, limit);
      }
      throw new Error(`HTTP ${res.status}: ${url}`);
    }
    const data = await res.json();
    const items: any[] = data?.results ?? [];
    for (const it of items) {
      if (samples.length >= limit) break;
      const city = it.locality?.city ?? null;
      if (!city || !addressMatchesCity(city, cityNames)) continue;
      const pricePerSqm = it.price_czk_m2 ?? null;
      if (!pricePerSqm || pricePerSqm < 5000 || pricePerSqm > 500000) continue;
      samples.push({
        pricePerSqm,
        metroDistance: it.poi_metro_distance ?? null,
        trainDistance: it.poi_train_distance ?? null,
        busDistance: it.poi_bus_public_transport_distance ?? null,
      });
    }
    if (items.length < RESULTS_PER_PAGE) break;
  }
  return samples;
}

const NONE = 100000;

/**
 * Modeluje vztah cena/m² vs. dopravní dostupnost z reálných dat.
 * Vrací korelační skóre: kolik % nad/pod městský průměr je cena/m² u dopravně výborné lokality.
 */
export function transportPricePremium(samples: TransportSample[]): { premiumPct: number | null; correlation: number | null; count: number } {
  if (samples.length < 5) return { premiumPct: null, correlation: null, count: samples.length };

  const withScore = samples
    .map((s) => ({ ...s, score: transportScore(s.metroDistance, s.trainDistance, s.busDistance) }))
    .filter((s) => s.score > 0);

  if (withScore.length < 5) return { premiumPct: null, correlation: null, count: withScore.length };

  const avgAll = withScore.reduce((sum, s) => sum + s.pricePerSqm, 0) / withScore.length;
  const excellent = withScore.filter((s) => s.score >= 70);
  const poor = withScore.filter((s) => s.score <= 25);

  const avgExcellent = excellent.length > 0 ? excellent.reduce((sum, s) => sum + s.pricePerSqm, 0) / excellent.length : null;
  const avgPoor = poor.length > 0 ? poor.reduce((sum, s) => sum + s.pricePerSqm, 0) / poor.length : null;

  let premiumPct: number | null = null;
  if (avgExcellent != null && avgAll > 0) {
    premiumPct = Math.round(((avgExcellent - avgAll) / avgAll) * 1000) / 10;
  }

  // Pearson correlation between score and pricePerSqm
  let correlation: number | null = null;
  if (withScore.length >= 5) {
    const n = withScore.length;
    const scores = withScore.map((s) => s.score);
    const prices = withScore.map((s) => s.pricePerSqm);
    const meanX = scores.reduce((a, b) => a + b, 0) / n;
    const meanY = prices.reduce((a, b) => a + b, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
      num += (scores[i] - meanX) * (prices[i] - meanY);
      dx += (scores[i] - meanX) ** 2;
      dy += (prices[i] - meanY) ** 2;
    }
    if (dx > 0 && dy > 0) correlation = Math.round((num / Math.sqrt(dx * dy)) * 100) / 100;
  }

  return { premiumPct, correlation, count: withScore.length };
}

/**
 * Uloží dopravní metriku jako rent "segment" = "transport" (cache per city).
 */
export async function saveTransportMetrics(cityKey: string, premiumPct: number | null, count: number): Promise<void> {
  const now = ts();
  await db
    .insert(rents)
    .values({ cityKey, segment: "transport", rentPerSqm: premiumPct ?? null, sampleSize: count, fetchedAt: now })
    .onConflictDoUpdate({
      target: [rents.cityKey, rents.segment],
      set: { rentPerSqm: premiumPct ?? null, sampleSize: count, fetchedAt: now },
    });
}

export async function getTransportMetrics(cityKey: string): Promise<{ premiumPct: number | null; sampleSize: number; fetchedAt: number } | null> {
  const row = await db
    .select()
    .from(rents)
    .where(and(eq(rents.cityKey, cityKey), eq(rents.segment, "transport")))
    .limit(1)
    .then((r) => r[0]);
  if (!row) return null;
  return { premiumPct: row.rentPerSqm ?? null, sampleSize: row.sampleSize, fetchedAt: Number(row.fetchedAt) };
}
