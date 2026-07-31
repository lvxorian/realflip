import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computeStats,
  segmentOf,
  haversineKm,
  getPropertyMarketRange,
  clearCache,
} from "../market-price-service";

const dbState = vi.hoisted(() => ({
  propertiesRows: [] as Array<Record<string, unknown>>,
  cacheRows: [] as Array<Record<string, unknown>>,
  insertPayloads: [] as Array<Record<string, unknown>>,
}));

const sitemapState = vi.hoisted(() => ({ ids: [] as number[] }));

vi.mock("@/db", () => {
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => dbState.propertiesRows.map((r) => ({ ...r })),
        }),
      }),
    }),
    insert: () => ({
      values: (vals: Record<string, unknown>) => {
        dbState.insertPayloads.push(vals);
        return {
          onConflictDoUpdate: () => ({ set: () => ({}) }),
          returning: () => Promise.resolve([]),
        };
      },
    }),
  };
  return { db, schema: {} };
});

vi.mock("../rate-limiter", () => {
  return {
    RateLimiter: {
      getInstance: () => ({ wait: async () => {} }),
    },
  };
});

vi.mock("../sreality-sitemap", () => {
  return {
    getSrealitySitemapIds: async () => sitemapState.ids,
    pickSrealitySampleIds: (seed: string, count: number) => sitemapState.ids.slice(0, count),
  };
});

interface MockFetchResponse {
  ok: boolean;
  json: () => Promise<unknown>;
}

let fetchMocks: Array<(url: string) => Promise<MockFetchResponse>> = [];

beforeEach(() => {
  clearCache();
  fetchMocks = [];
  dbState.propertiesRows = [];
  dbState.cacheRows = [];
  dbState.insertPayloads = [];
  sitemapState.ids = [];
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    const fn = fetchMocks.shift();
    if (fn) return fn(url);
    return Promise.resolve({ ok: false });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function compRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    price: 3_000_000,
    area: 60,
    address: "Ulice 1, Brno",
    lat: 49.2,
    lng: 16.6,
    condition: "good",
    buildingType: "brick",
    ...overrides,
  };
}

describe("computeStats", () => {
  it("returns null for fewer than 3 samples", () => {
    expect(computeStats([1000, 2000])).toBeNull();
  });

  it("computes median, p25, p75", () => {
    const stats = computeStats([1000, 2000, 3000, 4000, 5000]);
    expect(stats).toEqual({ median: 3000, p25: 2000, p75: 4000 });
  });
});

describe("segmentOf", () => {
  it("maps condition + buildingType to segment buckets", () => {
    expect(segmentOf("original", "panel")).toBe("panel_needs_renov");
    expect(segmentOf("dilapidated", "panel")).toBe("panel_needs_renov");
    expect(segmentOf("renovated", "panel")).toBe("panel_renovated");
    expect(segmentOf("original", "brick")).toBe("brick_needs_renov");
    expect(segmentOf("new", "brick")).toBe("brick_renovated");
  });

  it("returns any when condition or building type is missing", () => {
    expect(segmentOf(null, "panel")).toBe("any");
    expect(segmentOf("original", null)).toBe("any");
  });
});

describe("haversineKm", () => {
  it("returns 0 for identical coordinates", () => {
    expect(haversineKm(50.08, 14.4, 50.08, 14.4)).toBe(0);
  });

  it("approximates ~111 km per degree of latitude", () => {
    expect(haversineKm(50.08, 14.4, 51.08, 14.4)).toBeGreaterThan(110);
    expect(haversineKm(50.08, 14.4, 51.08, 14.4)).toBeLessThan(112);
  });
});

describe("getPropertyMarketRange — Tier 1 (DB kompy)", () => {
  it("uses city comps when >= 3 samples exist", async () => {
    dbState.propertiesRows = [
      compRow({ price: 3_000_000, area: 60 }),
      compRow({ price: 3_600_000, area: 60 }),
      compRow({ price: 4_200_000, area: 60 }),
      compRow({ price: 5_000_000, area: 60 }),
      compRow({ price: 5_600_000, area: 60 }),
    ];

    const result = await getPropertyMarketRange({ cityKey: "brno" });
    expect(result).not.toBeNull();
    expect(result!.source).toBe("db");
    expect(result!.sampleSize).toBe(5);
    expect(result!.median).toBe(4_200_000 / 60);
  });

  it("prefers GPS radius <= 5km with segment match", async () => {
    dbState.propertiesRows = [
      compRow({ price: 3_000_000, area: 60, lat: 49.2, lng: 16.6, condition: "good", buildingType: "brick" }),
      compRow({ price: 3_600_000, area: 60, lat: 49.201, lng: 16.601, condition: "good", buildingType: "brick" }),
      compRow({ price: 4_200_000, area: 60, lat: 49.202, lng: 16.602, condition: "good", buildingType: "brick" }),
      compRow({ price: 5_000_000, area: 60, lat: 49.3, lng: 16.7, condition: "good", buildingType: "brick" }),
      compRow({ price: 5_600_000, area: 60, lat: 49.4, lng: 16.8, condition: "original", buildingType: "panel" }),
    ];

    const result = await getPropertyMarketRange({
      cityKey: "brno",
      lat: 49.2,
      lng: 16.6,
      condition: "good",
      buildingType: "brick",
    });
    expect(result!.source).toBe("db");
    expect(result!.sampleSize).toBe(3);
  });

  it("falls through to market_data when DB has no comps", async () => {
    dbState.propertiesRows = [];
    const result = await getPropertyMarketRange({
      cityKey: "brno",
      condition: "original",
      buildingType: "panel",
    });
    expect(result).not.toBeNull();
    expect(result!.source).toBe("market_data");
    expect(result!.sampleSize).toBe(0);
  });

  it("falls back to hardcoded range for unknown city", async () => {
    dbState.propertiesRows = [];
    const result = await getPropertyMarketRange({ cityKey: "neexistujici_mesto" });
    expect(result).not.toBeNull();
    expect(result!.source).toBe("fallback");
  });
});

describe("getPropertyMarketRange — Tier 3 (sitemap + detaily)", () => {
  it("uses sitemap samples filtered by city when DB empty", async () => {
    dbState.propertiesRows = [];
    sitemapState.ids = [1000001, 1000002, 1000003, 1000004];

    fetchMocks = [
      () =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            result: {
              price_czk: 3_000_000,
              price_czk_m2: 50_000,
              usable_area: 60,
              locality: { city: "Brno" },
              building_condition: { name: "Dobrý" },
              building_type: { name: "Cihlová" },
            },
          }),
        }),
      () =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            result: {
              price_czk: 3_600_000,
              price_czk_m2: 60_000,
              usable_area: 60,
              locality: { city: "Brno" },
              building_condition: { name: "Dobrý" },
              building_type: { name: "Cihlová" },
            },
          }),
        }),
      () =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            result: {
              price_czk: 4_200_000,
              price_czk_m2: 70_000,
              usable_area: 60,
              locality: { city: "Praha" },
              building_condition: { name: "Dobrý" },
              building_type: { name: "Cihlová" },
            },
          }),
        }),
      () =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            result: {
              price_czk: 4_800_000,
              price_czk_m2: 80_000,
              usable_area: 60,
              locality: { city: "Brno" },
              building_condition: { name: "Dobrý" },
              building_type: { name: "Cihlová" },
            },
          }),
        }),
    ];

    const result = await getPropertyMarketRange({ cityKey: "brno" });
    expect(result).not.toBeNull();
    expect(result!.source).toBe("sreality");
    expect(result!.sampleSize).toBe(3);
    expect(result!.median).toBe(60_000);
  });

  it("uses search API for praha when DB empty", async () => {
    dbState.propertiesRows = [];
    fetchMocks = [
      () =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            results: [
              { price_czk_m2: 100_000 },
              { price_czk_m2: 110_000 },
              { price_czk_m2: 120_000 },
            ],
          }),
        }),
    ];

    const result = await getPropertyMarketRange({ cityKey: "praha" });
    expect(result).not.toBeNull();
    expect(result!.source).toBe("sreality");
    expect(result!.sampleSize).toBe(3);
  });
});

describe("getPropertyMarketRange — cache", () => {
  it("returns cached result on second call", async () => {
    dbState.propertiesRows = [
      compRow({ price: 3_000_000, area: 60 }),
      compRow({ price: 3_600_000, area: 60 }),
      compRow({ price: 4_200_000, area: 60 }),
    ];

    const first = await getPropertyMarketRange({ cityKey: "brno" });
    dbState.propertiesRows = [];
    const second = await getPropertyMarketRange({ cityKey: "brno" });
    expect(first!.source).toBe("db");
    expect(second!.source).toBe("db");
    expect(second!.sampleSize).toBe(3);
  });
});
