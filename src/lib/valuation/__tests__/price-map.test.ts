import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => ({ then: vi.fn() })) })) })) })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoUpdate: vi.fn(() => ({ set: vi.fn() })) })) })),
  },
}));

vi.mock("@/lib/scraping/rate-limiter", () => ({
  RateLimiter: { getInstance: () => ({ wait: async () => {} }) },
}));

import { getRealizedLocalityForCity, priceMapWindow, regionKeyForCity, clearPriceMapCache } from "../price-map";

const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data, text: async () => "" } as Response);

describe("priceMapWindow", () => {
  it("vrací 12měsíční okno končící minulým měsícem", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));
    const w = priceMapWindow();
    expect(w.dateTo).toBe("2026-07");
    expect(w.dateFrom).toBe("2025-08");
    vi.useRealTimers();
  });
});

describe("regionKeyForCity", () => {
  it("mapuje Cheb na Karlovarský kraj", () => {
    expect(regionKeyForCity("cheb")).toBe("karlovarsky");
  });
});

describe("getRealizedLocalityForCity", () => {
  const SSR_HTML = `
    <script id="__NEXT_DATA__" type="application/json">
      {"props":{"pageProps":{"dehydratedState":{"queries":[
        {"state":{"data":{"aggregatedList":[
          {"avgPricePerSqm":42181,"locality":{"entityId":3,"entityType":"region","name":"Karlovarský kraj","seoName":"karlovarsky-kraj"},"numTransactions":2420},
          {"avgPricePerSqm":149906,"locality":{"entityId":10,"entityType":"region","name":"Hlavní město Praha","seoName":"hlavni-mesto-praha"},"numTransactions":12672}
        ]}},"queryKey":["PriceMapList",{"category":1,"dateFrom":"2025-08","dateTo":"2026-07"}]}
      ]}}}
    </script>
  `;

  beforeEach(() => {
    clearPriceMapCache();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        const u = String(url);
        if (u === "https://www.sreality.cz/cenova-mapa") {
          return Promise.resolve({ ok: true, status: 200, text: async () => SSR_HTML } as Response);
        }
        if (u.includes("locality=region,3")) {
          return Promise.resolve(
            ok({
              result: {
                aggregated_list: [
                  { locality: { entity_id: 9, entity_type: "district", name: "Cheb", seo_name: "cheb" }, avg_price_per_sqm: 43009, num_transactions: 627 },
                  { locality: { entity_id: 10, entity_type: "district", name: "Karlovy Vary", seo_name: "karlovy-vary" }, avg_price_per_sqm: 51438, num_transactions: 969 },
                ],
              },
            })
          );
        }
        if (u.includes("locality=district,9")) {
          return Promise.resolve(
            ok({
              result: {
                aggregated_list: [
                  { locality: { entity_id: 1225, entity_type: "municipality", name: "Cheb", seo_name: "cheb" }, avg_price_per_sqm: 46768, num_transactions: 251 },
                  { locality: { entity_id: 1226, entity_type: "municipality", name: "Aš", seo_name: "as" }, avg_price_per_sqm: 28153, num_transactions: 98 },
                ],
              },
            })
          );
        }
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}), text: async () => "" } as Response);
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("drill-down: kraj → okres Cheb → město Cheb", async () => {
    const r = await getRealizedLocalityForCity("cheb");
    expect(r).not.toBeNull();
    expect(r!.entityType).toBe("municipality");
    expect(r!.localityName).toBe("Cheb");
    expect(r!.avgPricePerSqm).toBe(46768);
    expect(r!.numTransactions).toBe(251);
    expect(r!.districtName).toBe("Cheb");
    expect(r!.districtAvgPricePerSqm).toBe(43009);
    expect(r!.regionName).toBe("Karlovarský kraj");
    expect(r!.regionAvgPricePerSqm).toBe(42181);
  });

  it("město bez dat → okresní úroveň", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        const u = String(url);
        if (u === "https://www.sreality.cz/cenova-mapa") return Promise.resolve({ ok: true, status: 200, text: async () => SSR_HTML } as Response);
        if (u.includes("locality=region,3"))
          return Promise.resolve(
            ok({ result: { aggregated_list: [{ locality: { entity_id: 9, entity_type: "district", name: "Cheb", seo_name: "cheb" }, avg_price_per_sqm: 43009, num_transactions: 627 }] } })
          );
        // okres má okresní průměr, ale obce nemají data
        if (u.includes("locality=district,9"))
          return Promise.resolve(ok({ result: { aggregated_list: [{ locality: { entity_id: 1225, entity_type: "municipality", name: "Cheb", seo_name: "cheb" }, avg_price_per_sqm: null, num_transactions: 0 }] } }));
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}), text: async () => "" } as Response);
      })
    );
    const r = await getRealizedLocalityForCity("cheb");
    expect(r!.entityType).toBe("district");
    expect(r!.avgPricePerSqm).toBe(43009);
  });

  it("neznámé město → null", async () => {
    const r = await getRealizedLocalityForCity("neexistujici_mesto");
    expect(r).toBeNull();
  });
});
