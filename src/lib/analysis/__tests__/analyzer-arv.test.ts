import { describe, it, expect } from "vitest";
import { analyzeListing } from "../analyzer";
import type { RawListing } from "@/lib/scraping/types";

const baseListing: RawListing = {
  portalName: "sreality",
  url: "https://www.sreality.cz/detail/prodej/byt/3+1/praha-vinohrady/1234",
  title: "Prodej bytu 3+1, Praha Vinohrady",
  price: 4_500_000,
  pricePerSqm: 64_000,
  area: 70,
  rooms: "3+1",
  floor: 3,
  condition: "original",
  buildingType: "brick",
  yearBuilt: 1950,
  address: "Vinohradská 42, Praha 2 - Vinohrady",
  lat: null,
  lng: null,
  contactPhone: null,
  contactName: null,
  contactEmail: null,
  description: null,
  imageUrls: [],
  publishedAt: Date.now(),
  updatedAt: Date.now(),
};

describe("analyzeListing — market range passthrough", () => {
  it("uses dynamicRange values as-is (no re-multipliers)", () => {
    const analysis = analyzeListing(
      baseListing,
      { low: 40_000, high: 80_000, median: 60_000 },
      undefined,
      { city: "praha", district: null, category: "premium", segments: null }
    );
    expect(analysis.marketPricePerSqmLow).toBe(40_000);
    expect(analysis.marketPricePerSqmHigh).toBe(80_000);
  });

  it("computes ARV from high boundary with 5% reduction (x1.05 scenario)", () => {
    const analysis = analyzeListing(
      { ...baseListing, condition: "original" },
      { low: 40_000, high: 80_000, median: 60_000 },
      undefined,
      { city: "praha", district: null, category: "stable", segments: null }
    );
    const expected = Math.round(Math.round(80_000 * 0.95) * 70 * 1.05);
    expect(analysis.arv).toBe(expected);
  });

  it("uses arvRange (renovated segment) for ARV instead of current-condition market range", () => {
    const analysis = analyzeListing(
      { ...baseListing, condition: "original" },
      { low: 40_000, high: 80_000, median: 60_000 },
      undefined,
      { city: "praha", district: null, category: "stable", segments: null },
      { low: 120_000, high: 150_000, median: 135_000 }
    );
    const expected = Math.round(Math.round(150_000 * 0.95) * 70 * 1.05);
    expect(analysis.arv).toBe(expected);
    expect(analysis.arvPricePerSqmHigh).toBe(150_000);
  });

  it("keeps current-condition market range for undervaluation even with arvRange present", () => {
    const analysis = analyzeListing(
      { ...baseListing, condition: "original" },
      { low: 40_000, high: 80_000, median: 60_000 },
      undefined,
      { city: "praha", district: null, category: "stable", segments: null },
      { low: 120_000, high: 150_000, median: 135_000 }
    );
    expect(analysis.marketPricePerSqmLow).toBe(40_000);
    expect(analysis.marketPricePerSqmHigh).toBe(80_000);
  });
});
