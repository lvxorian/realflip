import { getRentMetrics } from "@/lib/scraping/rent-scraper";
import { db } from "@/db";
import { rents } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

const RENT_TTL_MS = 24 * 60 * 60 * 1000;

export interface RentEstimate {
  rentPerSqm: number | null;
  estimatedMonthlyRent: number | null;
  estimatedAnnualRent: number | null;
  grossYieldPct: number | null;
  requiredPriceForYield: number | null;
  sampleSize: number;
  fetchedAt?: number;
}

/**
 * Odhad nájmu a hrubého výnosu pro nemovitost.
 * Nájem se bere z uložených rent metrik (scrapované nájmy sreality), pokud nejsou
 * dostupné, používá se odhad z tržní ceny (0.5 % z ceny/m²).
 */
export async function estimateRent(input: {
  cityKey: string | null;
  price: number;
  area: number | null;
  condition?: string | null;
  buildingType?: string | null;
  targetYield?: number;
}): Promise<RentEstimate> {
  const { cityKey, price, area, targetYield } = input;
  const now = Date.now();

  let rentPerSqm: number | null = null;
  let sampleSize = 0;
  let fetchedAt: number | undefined;

  if (cityKey && cityKey !== "Neznámá" && cityKey !== "unknown") {
    const cached = await getRentMetrics(cityKey);
    if (cached && now - cached.fetchedAt < RENT_TTL_MS && cached.rentPerSqm != null) {
      rentPerSqm = cached.rentPerSqm;
      sampleSize = cached.sampleSize;
      fetchedAt = cached.fetchedAt;
    }
  }

  // Fallback: odhad nájmu = 0.5 % z tržní ceny za m² (hrubý odhad pro lokality bez dat)
  if (rentPerSqm == null && area != null && area > 0 && price > 0) {
    const pricePerSqm = price / area;
    rentPerSqm = Math.round(pricePerSqm * 0.005);
    sampleSize = 0;
  }

  const usableArea = area ?? 70;
  const estimatedMonthlyRent = rentPerSqm != null ? Math.round(rentPerSqm * usableArea) : null;
  const estimatedAnnualRent = estimatedMonthlyRent != null ? estimatedMonthlyRent * 12 : null;
  const grossYieldPct =
    estimatedAnnualRent != null && price > 0 ? Math.round((estimatedAnnualRent / price) * 1000) / 10 : null;

  const requiredPriceForYield =
    estimatedAnnualRent != null && targetYield && targetYield > 0
      ? Math.round((estimatedAnnualRent / targetYield) * 100)
      : null;

  return {
    rentPerSqm,
    estimatedMonthlyRent,
    estimatedAnnualRent,
    grossYieldPct,
    requiredPriceForYield,
    sampleSize,
    fetchedAt,
  };
}

export async function refreshRentMetrics(cityKey: string): Promise<{ rentPerSqm: number | null; sampleSize: number } | null> {
  const { scrapeRentsForCity, saveRentMetrics } = await import("@/lib/scraping/rent-scraper");
  const samples = await scrapeRentsForCity(cityKey, 60);
  if (samples.length === 0) return null;
  const result = await saveRentMetrics(cityKey, samples);
  return { rentPerSqm: result.rentPerSqm, sampleSize: result.count };
}

export async function getAllRentMetrics(): Promise<
  { cityKey: string; rentPerSqm: number | null; sampleSize: number; fetchedAt: number }[]
> {
  const rows = await db
    .select()
    .from(rents)
    .orderBy(desc(rents.fetchedAt));
  return rows.map((r) => ({
    cityKey: r.cityKey,
    rentPerSqm: r.rentPerSqm ?? null,
    sampleSize: r.sampleSize,
    fetchedAt: Number(r.fetchedAt),
  }));
}
