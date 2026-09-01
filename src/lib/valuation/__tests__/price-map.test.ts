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

import {
  getRealizedLocalityForCity,
  priceMapWindow,
  regionKeyForCity,
  clearPriceMapCache,
  fetchWardTransactions,
  clearWardTxCache,
  parseEstateList,
} from "../price-map";

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

  it("6měsíční okno (big-city likvidita jako Valuo)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));
    const w = priceMapWindow(6);
    expect(w.dateTo).toBe("2026-07");
    expect(w.dateFrom).toBe("2026-02");
    vi.useRealTimers();
  });

  it("24měsíční okno (malá města / stabilita)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));
    const w = priceMapWindow(24);
    expect(w.dateTo).toBe("2026-07");
    expect(w.dateFrom).toBe("2024-08");
    vi.useRealTimers();
  });

  it("odhad k datu posune konec okna do minulosti", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));
    const w = priceMapWindow(12, "2025-06");
    expect(w.dateTo).toBe("2025-05");
    expect(w.dateFrom).toBe("2024-06");
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

describe("getRealizedLocalityForCity — ward úroveň (Praha)", () => {
  const PRAGUE_SSR_HTML = `
    <script id="__NEXT_DATA__" type="application/json">
      {"props":{"pageProps":{"dehydratedState":{"queries":[
        {"state":{"data":{"aggregatedList":[
          {"avgPricePerSqm":112430,"locality":{"entityId":10,"entityType":"region","name":"Hlavní město Praha","seoName":"hlavni-mesto-praha"},"numTransactions":12672}
        ]}},"queryKey":["PriceMapList",{"category":1,"dateFrom":"2025-08","dateTo":"2026-07"}]}
      ]}}}
    </script>
  `;

  const WARDS = (rows: { name: string; seo: string; avg: number; tx: number }[]) => ({
    result: {
      aggregated_list: rows.map((r) => ({
        locality: { entity_id: Math.abs(r.name.length * 97), entity_type: "ward", name: r.name, seo_name: r.seo },
        avg_price_per_sqm: r.avg,
        num_transactions: r.tx,
      })),
    },
  });

  beforeEach(() => {
    clearPriceMapCache();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        const u = String(url);
        if (u === "https://www.sreality.cz/cenova-mapa")
          return Promise.resolve({ ok: true, status: 200, text: async () => PRAGUE_SSR_HTML } as Response);
        if (u.includes("locality=region,10"))
          return Promise.resolve(
            ok(
              WARDS([
                { name: "Vinohrady", seo: "vinohrady", avg: 168000, tx: 900 },
                { name: "Žižkov", seo: "zizkov", avg: 160324, tx: 743 },
                { name: "Libeň", seo: "liben", avg: 135000, tx: 600 },
              ])
            )
          );
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}), text: async () => "" } as Response);
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("s adresou/hintem najde čtvrť (Žižkov) místo krajského průměru", async () => {
    const r = await getRealizedLocalityForCity("praha", {
      address: "K Lučinám, Praha - Žižkov, Praha",
      wardHints: ["Žižkov", "Praha 3"],
    });
    expect(r).not.toBeNull();
    expect(r!.entityType).toBe("ward");
    expect(r!.wardName).toBe("Žižkov");
    expect(r!.avgPricePerSqm).toBe(160324);
    expect(r!.numTransactions).toBe(743);
    // region zůstává jako kontext
    expect(r!.regionAvgPricePerSqm).toBe(112430);
  });

  it("čtvrť najde i z adresy bez explicitních hintů (substring Žižkov)", async () => {
    const r = await getRealizedLocalityForCity("praha", { address: "K Lučinám, Praha - Žižkov, Praha" });
    expect(r!.entityType).toBe("ward");
    expect(r!.wardName).toBe("Žižkov");
  });

  it("bez adresy zůstává krajská hladina (čtvrť by byla náhodná)", async () => {
    const r = await getRealizedLocalityForCity("praha");
    expect(r!.entityType).toBe("region");
    expect(r!.avgPricePerSqm).toBe(112430);
    expect(r!.wardName).toBeNull();
  });
});

describe("fetchWardTransactions — adresní transakce (estate_list)", () => {
  const PRAGUE_SSR_HTML = `
    <script id="__NEXT_DATA__" type="application/json">
      {"props":{"pageProps":{"dehydratedState":{"queries":[
        {"state":{"data":{"aggregatedList":[
          {"avgPricePerSqm":112430,"locality":{"entityId":10,"entityType":"region","name":"Hlavní město Praha","seoName":"hlavni-mesto-praha"},"numTransactions":12672}
        ]}},"queryKey":["PriceMapList",{"category":1,"dateFrom":"2025-08","dateTo":"2026-07"}]}
      ]}}}
    </script>
  `;

  // ward Žižkov entity_id 14971
  const ESTATES = [
    {
      transaction_id: 108431536010,
      currency: "CZK",
      title: "Byt, 66–70 m²",
      validation_date: "2026-07-29",
      locality: {
        address_id: 11017264,
        gps_lat: 50.08348611218893,
        gps_lon: 14.555073443874065,
        housenumber: "1291",
        municipality: "Praha",
        ward: "Žižkov",
        ward_id: 14971,
      },
    },
    {
      transaction_id: 108417111010,
      currency: "CZK",
      title: "Byt, 26–30 m²",
      validation_date: "2026-07-28",
      locality: {
        address_id: 9000974,
        gps_lat: 50.10235711277325,
        gps_lon: 14.551393549616362,
        housenumber: "334",
        municipality: "Praha",
        ward: "Žižkov",
        ward_id: 14971,
      },
    },
    {
      transaction_id: 108417999010,
      currency: "CZK",
      title: "Byt, 66–70 m²",
      validation_date: "2026-07-10",
      locality: {
        address_id: 111111,
        gps_lat: 99.9, // nesmyslná GPS — má být odfiltrována
        gps_lon: 99.9,
        housenumber: "999",
        municipality: "Praha",
        ward: "Žižkov",
        ward_id: 14971,
      },
    },
  ];

  beforeEach(() => {
    clearPriceMapCache();
    clearWardTxCache();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        const u = String(url);
        if (u === "https://www.sreality.cz/cenova-mapa")
          return Promise.resolve({ ok: true, status: 200, text: async () => PRAGUE_SSR_HTML } as Response);
        if (u.includes("locality=region,10"))
          return Promise.resolve(
            ok({
              result: {
                aggregated_list: [
                  { locality: { entity_id: 14971, entity_type: "ward", name: "Žižkov", seo_name: "zizkov" }, avg_price_per_sqm: 160324, num_transactions: 743 },
                ],
              },
            })
          );
        if (u.includes("locality=ward,14971"))
          return Promise.resolve(ok({ result: { estate_list: ESTATES } }));
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}), text: async () => "" } as Response);
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("vrací adresní transakce s GPS, č.p., velikostí a datem", async () => {
    const tx = await fetchWardTransactions("praha", {
      address: "K Lučinám, Praha - Žižkov, Praha",
      wardHints: ["Žižkov"],
    });
    expect(tx.length).toBe(2); // 3. položka s nesmyslnou GPS odfiltrována
    expect(tx[0].housenumber).toBe("1291");
    expect(tx[0].lat).toBeCloseTo(50.0834861);
    expect(tx[0].lng).toBeCloseTo(14.5550734);
    expect(tx[0].areaCategory).toBe("Byt, 66–70 m²");
    expect(tx[0].validationDate).toBe("2026-07-29");
    expect(tx[0].wardId).toBe(14971);
    expect(tx[0].transactionId).toBe(108431536010);
  });

  it("bez adresy (region úroveň) → prázdné pole", async () => {
    const tx = await fetchWardTransactions("praha");
    expect(tx).toEqual([]);
  });

  it("neznámé město → prázdné pole", async () => {
    const tx = await fetchWardTransactions("neexistujici_mesto");
    expect(tx).toEqual([]);
  });
});

describe("parseEstateList — pure funkce", () => {
  it("odfiltruje transakci bez transaction_id (0/null)", () => {
    const items = parseEstateList([
      {
        transaction_id: null,
        title: "Byt, 66–70 m²",
        validation_date: "2026-07-01",
        locality: { gps_lat: 50.08, gps_lon: 14.55, housenumber: "1" },
      },
      {
        transaction_id: 123,
        title: "Byt, 46–50 m²",
        validation_date: "2026-07-02",
        locality: { gps_lat: 50.09, gps_lon: 14.56, housenumber: "2" },
      },
    ]);
    expect(items.length).toBe(1);
    expect(items[0].transactionId).toBe(123);
  });

  it("odfiltruje GPS mimo ČR (korupce dat)", () => {
    const items = parseEstateList([
      {
        transaction_id: 1,
        title: "Byt",
        locality: { gps_lat: 99.9, gps_lon: 99.9, housenumber: "1" },
      },
      {
        transaction_id: 2,
        title: "Byt",
        locality: { gps_lat: 50.08, gps_lon: 14.55, housenumber: "2" },
      },
    ]);
    expect(items.length).toBe(1);
    expect(items[0].housenumber).toBe("2");
  });

  it("dedupuje duplicity transaction_id (stránkování API) — regrese F-7", () => {
    const items = parseEstateList([
      { transaction_id: 7, title: "Byt", locality: { gps_lat: 50.08, gps_lon: 14.55, housenumber: "A" } },
      { transaction_id: 7, title: "Byt", locality: { gps_lat: 50.08, gps_lon: 14.55, housenumber: "A" } },
      { transaction_id: 8, title: "Byt", locality: { gps_lat: 50.09, gps_lon: 14.56, housenumber: "B" } },
    ]);
    expect(items.map((i) => i.transactionId)).toEqual([7, 8]);
  });
});
