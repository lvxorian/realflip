import { describe, it, expect, vi, beforeEach } from "vitest";
import { estimateProperty, attachTrend, areaSizeFactor } from "../engine";
import type { MarketRangeResult, CompSample } from "@/lib/scraping/market-price-service";

const state = vi.hoisted(() => ({
  realized: vi.fn(),
  range: vi.fn(),
  comps: vi.fn(),
}));

vi.mock("@/db", () => ({ db: {}, schema: {} }));
vi.mock("@/lib/scraping/rate-limiter", () => ({
  RateLimiter: { getInstance: () => ({ wait: async () => {} }) },
}));
vi.mock("@/lib/valuation/price-map", () => ({
  getRealizedRegionForCity: state.realized,
}));
vi.mock("@/lib/scraping/market-price-service", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return {
    ...actual,
    getPropertyMarketRange: state.range,
    fetchComparableSamples: state.comps,
  };
});

const mockedRealized = vi.mocked(state.realized);
const mockedRange = vi.mocked(state.range);
const mockedComps = vi.mocked(state.comps);

function rangeResult(median: number, low = median * 0.85, high = median * 1.15): MarketRangeResult {
  return { low, high, median, source: "db", sampleSize: 24 };
}

function compSample(over: Partial<CompSample> = {}): CompSample {
  return {
    pricePerSqm: 60000,
    lat: 50.08,
    lng: 14.42,
    area: 60,
    segment: "brick_renovated",
    address: "Praha 1",
    price: 3_600_000,
    condition: "renovated",
    ...over,
  };
}

beforeEach(() => {
  mockedRealized.mockReset();
  mockedRange.mockReset();
  mockedComps.mockReset();
});

describe("areaSizeFactor", () => {
  it("menší byt má vyšší Kč/m²", () => {
    expect(areaSizeFactor(40)).toBeGreaterThan(1);
    expect(areaSizeFactor(100)).toBeLessThan(1);
    expect(areaSizeFactor(60)).toBeCloseTo(1, 5);
  });
  it("clamp 0.85–1.15", () => {
    expect(areaSizeFactor(5)).toBeLessThanOrEqual(1.15);
    expect(areaSizeFactor(1000)).toBeGreaterThanOrEqual(0.85);
    expect(areaSizeFactor(null)).toBe(1);
  });
});

describe("estimateProperty — blend", () => {
  it("kombinuje realizované + nabídky, odhad v rozmezí", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 90000,
      numTransactions: 12000,
      regionName: "Hlavní město Praha",
      period: "2025-08 – 2026-07",
      totalTransactions: 50000,
    });
    mockedRange.mockResolvedValue(rangeResult(85000));
    mockedComps.mockResolvedValue([compSample()]);

    const r = await estimateProperty(
      { cityKey: "praha", type: "flat", area: 60, condition: "renovated", buildingType: "brick", lat: 50.08, lng: 14.42 },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    expect(r.estimate).toBeGreaterThan(0);
    expect(r.low).toBeLessThan(r.estimate);
    expect(r.high).toBeGreaterThan(r.estimate);
    // blend (0.45*90000 + 0.35*85000)/0.8 ≈ 87 812 Kč/m² × areaFactor(60)=1 → ~5 268 750 Kč
    expect(r.estimate).toBeGreaterThan(4_500_000);
    expect(r.estimate).toBeLessThan(6_000_000);
    expect(r.pricePerSqm).toBeGreaterThan(80_000);
    expect(r.confidenceScore).toBeGreaterThanOrEqual(70);
    expect(r.confidenceLabel).toBe("Vysoká");
    expect(r.sources).toHaveLength(2);
  });

  it("bez realizovaných — fallback jen na nabídky, nižší confidence", async () => {
    mockedRealized.mockResolvedValue(null);
    mockedRange.mockResolvedValue(rangeResult(50000));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      { cityKey: "brno", type: "flat", area: 70 },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    expect(r.estimate).toBeGreaterThan(0);
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0].key).toBe("offers");
    expect(r.confidenceScore).toBeLessThan(70);
  });

  it("chybné vstupy → estimate 0 bez pádu", async () => {
    mockedRealized.mockResolvedValue(null);
    mockedRange.mockResolvedValue(null);
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      { cityKey: "praha", type: "flat", area: 60 },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );
    expect(r.estimate).toBe(0);
    expect(r.confidenceLabel).toBe("Nízká");
  });
});

describe("estimateProperty — srovnatelné", () => {
  it("řadí kompy podle vzdálenosti a deduplikuje", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 90000,
      numTransactions: 5000,
      regionName: "Jihomoravský kraj",
      period: "2025-08 – 2026-07",
      totalTransactions: 30000,
    });
    mockedRange.mockResolvedValue(rangeResult(85000));
    mockedComps.mockResolvedValue([
      compSample({ lat: 49.195, lng: 16.607, address: "Brno střed", pricePerSqm: 80000 }),
      compSample({ lat: 49.24, lng: 16.58, address: "Brno Bystrc", pricePerSqm: 70000 }),
      compSample({ lat: 49.195, lng: 16.607, address: "Brno střed", pricePerSqm: 81000 }), // duplicita adresy
      compSample({ lat: 50.4, lng: 14.0, address: "Daleko", pricePerSqm: 60000 }), // > 10 km od Brna
    ]);

    const r = await estimateProperty(
      { cityKey: "brno", type: "flat", area: 60, lat: 49.195, lng: 16.607 },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    const offers = r.comparables.filter((c) => c.source === "offer");
    expect(offers.length).toBe(2); // jedna duplicita + jeden > 10 km
    expect((offers[0].distanceKm ?? 999)).toBeLessThan(offers[1].distanceKm ?? 999);
    expect(r.comparables[0].source).toBe("realized"); // průměr kraje nahoře
  });
});

describe("estimateProperty — vs inzerát", () => {
  it("vsAskingPct počítá rozdíl od inzerované ceny", async () => {
    mockedRealized.mockResolvedValue(null);
    mockedRange.mockResolvedValue(rangeResult(50000));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      { cityKey: "brno", type: "flat", area: 60, askingPrice: 5_000_000 },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );
    // odhad ≈ 3 000 000 → pod inzerátem
    expect(r.vsAskingPct).not.toBeNull();
    expect(r.vsAskingPct!).toBeLessThan(0);
    expect(r.askingPrice).toBe(5_000_000);
  });
});

describe("attachTrend", () => {
  it("vloží trend do výsledku", async () => {
    mockedRealized.mockResolvedValue(null);
    mockedRange.mockResolvedValue(null);
    mockedComps.mockResolvedValue([]);

    const base = await estimateProperty(
      { cityKey: "praha", type: "flat", area: 60 },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );
    const withTrend = attachTrend(base, [{ monthYear: "01/2026", price: 85000 }]);
    expect(withTrend.trend).toHaveLength(1);
    expect(withTrend.trend[0].price).toBe(85000);
  });
});
