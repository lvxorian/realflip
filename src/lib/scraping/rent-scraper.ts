import { db } from "@/db";
import { rents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ts } from "@/lib/utils";
import { cityNamesFor, addressMatchesCity } from "@/lib/analysis/location";
import { segmentOf } from "./market-price-service";

const BASE_API = "https://www.sreality.cz/api/v1/estates/search";
const RESULTS_PER_PAGE = 100;
const MAX_PAGES = 2;

const SREALITY_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "cs,en;q=0.9",
  Referer: "https://www.sreality.cz/",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
};

export interface RentSample {
  rentPerSqm: number;
  area: number;
  rooms: string | null;
  condition: string | null;
  buildingType: string | null;
  city: string | null;
}

async function fetchRentPage(cityKey: string, offset: number): Promise<any[]> {
  const cityNames = cityNamesFor(cityKey);
  const url = `${BASE_API}?category_main_cb=1&category_type_cb=2&limit=${RESULTS_PER_PAGE}&offset=${offset}`;
  const res = await fetch(url, { headers: SREALITY_HEADERS });
  if (!res.ok) {
    if (res.status === 429 || res.status === 403) {
      await new Promise((r) => setTimeout(r, 20000));
      return fetchRentPage(cityKey, offset);
    }
    throw new Error(`HTTP ${res.status}: ${url}`);
  }
  const data = await res.json();
  const items: any[] = data?.results ?? [];
  return items.filter((it) => {
    const city = it.locality?.city ?? null;
    return city && addressMatchesCity(city, cityNames);
  });
}

export async function scrapeRentsForCity(cityKey: string, limit = 60): Promise<RentSample[]> {
  const samples: RentSample[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * RESULTS_PER_PAGE;
    const items = await fetchRentPage(cityKey, offset);
    for (const it of items) {
      if (samples.length >= limit) break;
      const price = it.price_czk ?? it.price ?? 0;
      const rentPerSqmRaw = it.price_czk_m2 ?? null;
      const name = it.advert_name ?? it.name ?? "";
      const areaMatch = name.match(/(\d+)\s*m²/i);
      const area = areaMatch ? parseInt(areaMatch[1], 10) : null;

      let rentPerSqm: number | null = null;
      if (rentPerSqmRaw && rentPerSqmRaw > 0) {
        rentPerSqm = Math.round(rentPerSqmRaw);
      } else if (price > 0 && area && area > 0) {
        rentPerSqm = Math.round(price / area);
      }
      if (rentPerSqm == null || rentPerSqm < 30 || rentPerSqm > 1500) continue;

      const roomsMatch = name.match(/(\d+\+\w{2})/i);
      samples.push({
        rentPerSqm,
        area: area ?? 0,
        rooms: roomsMatch ? roomsMatch[1].toLowerCase() : null,
        condition: null,
        buildingType: null,
        city: it.locality?.city ?? null,
      });
    }
    if (items.length < RESULTS_PER_PAGE) break;
  }
  return samples;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export async function saveRentMetrics(cityKey: string, samples: RentSample[]): Promise<{ rentPerSqm: number | null; medianRent: number | null; count: number }> {
  const now = ts();
  const rentPerSqmList = samples.map((s) => s.rentPerSqm);
  const rentPerSqm = rentPerSqmList.length > 0 ? median(rentPerSqmList) : null;
  const medianRent = samples.length > 0
    ? median(samples.filter((s) => s.area >= 20 && s.area <= 120).map((s) => s.rentPerSqm * s.area))
    : null;

  await db
    .insert(rents)
    .values({ cityKey, segment: "any", rentPerSqm, medianRent, sampleSize: samples.length, fetchedAt: now })
    .onConflictDoUpdate({
      target: [rents.cityKey, rents.segment],
      set: { rentPerSqm, medianRent, sampleSize: samples.length, fetchedAt: now },
    });

  return { rentPerSqm, medianRent, count: samples.length };
}

export async function getRentMetrics(cityKey: string, segment = "any"): Promise<{ rentPerSqm: number | null; medianRent: number | null; sampleSize: number; fetchedAt: number } | null> {
  const row = await db
    .select()
    .from(rents)
    .where(and(eq(rents.cityKey, cityKey), eq(rents.segment, segment)))
    .limit(1)
    .then((r) => r[0]);
  if (!row) return null;
  return {
    rentPerSqm: row.rentPerSqm ?? null,
    medianRent: row.medianRent ?? null,
    sampleSize: row.sampleSize,
    fetchedAt: Number(row.fetchedAt),
  };
}

export { segmentOf };
