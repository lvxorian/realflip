import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  estimateProperty,
  attachTrend,
  areaSizeFactor,
  transportMultiplier,
  scaleToDate,
  parseAreaCategory,
  timeIndexFactor,
} from "../engine";
import {
  ownershipMultiplier,
  floorMultiplier,
  balconyMultiplier,
  gardenMultiplier,
  cellarMultiplier,
  buildingTypeMultiplier,
} from "@/lib/analysis/market-data";
import type { MarketRangeResult, CompSample } from "@/lib/scraping/market-price-service";

const state = vi.hoisted(() => ({
  realized: vi.fn(),
  range: vi.fn(),
  comps: vi.fn(),
  wardTx: vi.fn(),
}));

vi.mock("@/db", () => ({ db: {}, schema: {} }));
vi.mock("@/lib/scraping/rate-limiter", () => ({
  RateLimiter: { getInstance: () => ({ wait: async () => {} }) },
}));
vi.mock("@/lib/valuation/price-map", () => ({
  getRealizedRegionForCity: state.realized,
  getRealizedLocalityForCity: state.realized,
  fetchWardTransactions: state.wardTx,
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
const mockedWardTx = vi.mocked(state.wardTx);

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
  mockedWardTx.mockReset();
  // adresní transakce jsou doplněk — default prázdné (stávající testy beze změny)
  mockedWardTx.mockResolvedValue([]);
});

describe("areaSizeFactor", () => {
  it("menší byt má vyšší Kč/m²", () => {
    expect(areaSizeFactor(40)).toBeGreaterThan(1);
    expect(areaSizeFactor(100)).toBeLessThan(1);
    expect(areaSizeFactor(60)).toBeCloseTo(1, 5);
  });
  it("clamp 0.7–1.3", () => {
    expect(areaSizeFactor(5)).toBeLessThanOrEqual(1.3);
    expect(areaSizeFactor(1000)).toBeGreaterThanOrEqual(0.7);
    expect(areaSizeFactor(null)).toBe(1);
  });
  it("realistická křivka: 35 m² ≈ +15 %, 100 m² ≈ −12 %", () => {
    expect(areaSizeFactor(35)).toBeCloseTo(Math.pow(60 / 35, 0.25), 5);
    expect(areaSizeFactor(100)).toBeCloseTo(Math.pow(60 / 100, 0.25), 5);
    expect(areaSizeFactor(35)).toBeGreaterThan(1.1);
    expect(areaSizeFactor(100)).toBeLessThan(0.9);
  });
});

describe("estimateProperty — městská úroveň realizovaných", () => {
  it("obec > okres > kraj — použije nejpřesnější úroveň a přidá kontext do komparací", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 46768,
      numTransactions: 251,
      regionName: "Karlovarský kraj",
      regionAvgPricePerSqm: 42181,
      regionTransactions: 2420,
      districtName: "Cheb",
      districtAvgPricePerSqm: 43009,
      districtTransactions: 627,
      localityName: "Cheb",
      localityAvgPricePerSqm: 46768,
      localityTransactions: 251,
      entityType: "municipality",
      period: "2025-08 – 2026-07",
      totalTransactions: 50469,
    });
    mockedRange.mockResolvedValue(rangeResult(49574));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      { cityKey: "cheb", type: "flat", area: 70, condition: "good", buildingType: "brick" },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    const realizedSource = r.sources.find((s) => s.key === "realized");
    expect(realizedSource!.label).toContain("Cheb");
    expect(realizedSource!.label).not.toContain("kraj");
    // komparace: město + okres + kraj
    const realizedComps = r.comparables.filter((c) => c.source === "realized");
    expect(realizedComps).toHaveLength(3);
    expect(realizedComps[0].label).toContain("Město (Cheb)");
    expect(realizedComps[0].pricePerSqm).toBe(46768);
  });

  it("bez okresu/města — použije krajskou hladinu", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 42181,
      numTransactions: 2420,
      regionName: "Karlovarský kraj",
      regionAvgPricePerSqm: 42181,
      regionTransactions: 2420,
      entityType: "region",
      period: "2025-08 – 2026-07",
      totalTransactions: 50469,
    });
    mockedRange.mockResolvedValue(rangeResult(49574));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      { cityKey: "cheb", type: "flat", area: 70 },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );
    expect(r.sources.find((s) => s.key === "realized")!.label).toContain("Karlovarský kraj");
    expect(r.comparables.filter((c) => c.source === "realized")).toHaveLength(1);
  });
});

describe("estimateProperty — čtvrťová (ward) úroveň", () => {
  it("předá adresu/GPS/hinty do realized a použije ward průměr s kontextem kraje", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 160324,
      numTransactions: 743,
      regionName: "Hlavní město Praha",
      regionAvgPricePerSqm: 112430,
      regionTransactions: 12672,
      wardName: "Žižkov",
      wardAvgPricePerSqm: 160324,
      wardTransactions: 743,
      localityName: null,
      districtName: null,
      entityType: "ward",
      period: "2025-08 – 2026-07",
      totalTransactions: 50469,
    });
    mockedRange.mockResolvedValue(rangeResult(126746));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      {
        cityKey: "praha",
        address: "K Lučinám, Praha 3-Žižkov",
        type: "flat",
        area: 73,
        condition: "good",
        category: "stable",
        wardHints: ["Žižkov", "Praha 3"],
      },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    // engine předává ctx do realized
    expect(mockedRealized).toHaveBeenCalledWith("praha", {
      address: "K Lučinám, Praha 3-Žižkov",
      lat: undefined,
      lng: undefined,
      wardHints: ["Žižkov", "Praha 3"],
    });

    const src = r.sources.find((s) => s.key === "realized")!;
    expect(src.label).toContain("čtvrť Žižkov");
    // čtvrť (160 324) je nad krajem (112 430) o 43 % → korigováno 0.75/0.25 = 148 351,
    // a byt v běžném stavu (good) dostane mírnou srážku za skladbu fondu ×0,97 → 143 900
    // (0,94 by bylo přehnané — s panel ×0,75 by se odhad propadl hluboko pod Valuo)
    expect(src.pricePerSqm).toBe(143900);
    expect(src.note).toContain("korigováno");
    expect(src.note).toContain("Srážka za běžný stav");
    // komparace: Čtvrť + Kraj (bez obce/okresu) — kontext ukazuje surové hodnoty
    const realizedComps = r.comparables.filter((c) => c.source === "realized");
    expect(realizedComps).toHaveLength(2);
    expect(realizedComps[0].label).toContain("Čtvrť (Žižkov)");
    expect(realizedComps[0].pricePerSqm).toBe(160324);
    expect(realizedComps[1].label).toContain("Kraj");
    // spread na čtvrti je užší (≤ ±8 %)
    const spreadPct = (r.high - r.low) / (2 * r.estimate);
    expect(spreadPct).toBeLessThanOrEqual(0.08);
    expect(r.confidenceScore).toBeGreaterThanOrEqual(70);
  });

  it("čtvrť v normě vůči kraji se nekoriguje (regionRatio ≤ 1.35)", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 130000,
      numTransactions: 600,
      regionName: "Jihomoravský kraj",
      regionAvgPricePerSqm: 105000,
      regionTransactions: 8000,
      wardName: "Brno-střed",
      wardAvgPricePerSqm: 130000,
      wardTransactions: 600,
      entityType: "ward",
      period: "2025-08 – 2026-07",
      totalTransactions: 50469,
    });
    mockedRange.mockResolvedValue(rangeResult(120000));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      { cityKey: "brno", address: "Česká, Brno-střed", type: "flat", area: 60 },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );
    const src = r.sources.find((s) => s.key === "realized")!;
    expect(src.pricePerSqm).toBe(130000);
    expect(src.note).not.toContain("korigováno");
  });

  it("ward + obec + okres + kraj = 4 kontextové řádky", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 135000,
      numTransactions: 400,
      regionName: "Hlavní město Praha",
      regionAvgPricePerSqm: 112430,
      regionTransactions: 12672,
      wardName: "Libeň",
      wardAvgPricePerSqm: 135000,
      wardTransactions: 400,
      localityName: "Praha",
      localityAvgPricePerSqm: 118000,
      localityTransactions: 8000,
      districtName: "Praha 8",
      districtAvgPricePerSqm: 122000,
      districtTransactions: 1500,
      entityType: "ward",
      period: "2025-08 – 2026-07",
      totalTransactions: 50469,
    });
    mockedRange.mockResolvedValue(rangeResult(120000));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      { cityKey: "praha", address: "U Libeňského mostu, Praha 8", type: "flat", area: 60 },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );
    const realizedComps = r.comparables.filter((c) => c.source === "realized");
    expect(realizedComps.map((c) => c.label)).toEqual([
      "Čtvrť (Libeň)",
      "Město (Praha)",
      "Okres (Praha 8)",
      "Kraj (Hlavní město Praha)",
    ]);
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

describe("estimateProperty — lokalita komparací", () => {
  it("vzorek bez GPS z jiného města se nezobrazí, když má cíl GPS (regrese Cheb/Praha)", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 41000,
      numTransactions: 900,
      regionName: "Karlovarský kraj",
      period: "2025-08 – 2026-07",
      totalTransactions: 50000,
    });
    mockedRange.mockResolvedValue(rangeResult(42000));
    // Cheb má GPS; pražský vzorek NEMÁ GPS a adresa neobsahuje město → musí být vyřazen
    mockedComps.mockResolvedValue([
      compSample({ lat: 50.07, lng: 12.37, address: "Cheb, Lomená", pricePerSqm: 40000 }), // v okruhu 10 km
      compSample({ lat: null, lng: null, address: "Praha 5, Smíchov", pricePerSqm: 110000 }), // bez GPS, cizí město
      compSample({ lat: 50.05, lng: 12.36, address: null, pricePerSqm: 43000 }), // GPS, bez adresy
    ]);

    const r = await estimateProperty(
      { cityKey: "cheb", type: "flat", area: 70, lat: 50.08, lng: 12.38, condition: "good", buildingType: "brick" },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    const offers = r.comparables.filter((c) => c.source === "offer");
    expect(offers.some((c) => c.label.includes("Praha"))).toBe(false);
    expect(offers.some((c) => c.label.includes("Cheb"))).toBe(true);
    expect(offers.length).toBe(2); // Cheb + vzorek s GPS bez adresy
  });

  it("realizovaný prodej z vlastní historie má source realized + soldAt", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 90000,
      numTransactions: 5000,
      regionName: "Hlavní město Praha",
      regionAvgPricePerSqm: 90000,
      regionTransactions: 5000,
      entityType: "region",
      period: "2025-08 – 2026-07",
      totalTransactions: 30000,
    });
    mockedRange.mockResolvedValue(rangeResult(85000));
    mockedComps.mockResolvedValue([
      compSample({ lat: 50.08, lng: 14.44, address: "Prodaná 5, Praha", pricePerSqm: 82000, realized: true, soldAt: 1_750_000_000_000 }),
      compSample({ lat: 50.08, lng: 14.44, address: "Nabídková 3, Praha", pricePerSqm: 95000 }),
    ]);

    const r = await estimateProperty(
      { cityKey: "praha", type: "flat", area: 60, lat: 50.08, lng: 14.44 },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    const sold = r.comparables.find((c) => c.label.includes("Prodaná"));
    const offer = r.comparables.find((c) => c.label.includes("Nabídková"));
    expect(sold).toBeDefined();
    expect(sold!.source).toBe("realized");
    expect(sold!.soldAt).toBe(1_750_000_000_000);
    expect(offer).toBeDefined();
    expect(offer!.source).toBe("offer");
    expect(offer!.soldAt).toBeNull();
  });

  it("bez GPS cíle: vzorek z cizího města se vyřadí přes adresu", async () => {
    mockedRealized.mockResolvedValue(null);
    mockedRange.mockResolvedValue(rangeResult(42000));
    mockedComps.mockResolvedValue([
      compSample({ lat: null, lng: null, address: "Cheb, Lomená", pricePerSqm: 40000 }),
      compSample({ lat: null, lng: null, address: "Praha 5, Smíchov", pricePerSqm: 110000 }),
      compSample({ lat: null, lng: null, address: null, pricePerSqm: 45000 }), // bez adresy i GPS → vyřazeno
    ]);

    const r = await estimateProperty(
      { cityKey: "cheb", type: "flat", area: 70 },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    const offers = r.comparables.filter((c) => c.source === "offer");
    expect(offers.map((c) => c.label)).toEqual(["Cheb, Lomená"]);
  });
});

describe("parseAreaCategory", () => {
  it("rozsah (Byt, 66–70 m²) → { min: 66, max: 70 }", () => {
    expect(parseAreaCategory("Byt, 66–70 m²")).toEqual({ min: 66, max: 70 });
  });
  it("s dispozicí (Byt 2+kk, 46–50 m²) → { min: 46, max: 50 }", () => {
    expect(parseAreaCategory("Byt 2+kk, 46–50 m²")).toEqual({ min: 46, max: 50 });
  });
  it("jednotlivé číslo / null / nevalidní → null", () => {
    expect(parseAreaCategory("Byt, 66 m²")).toEqual({ min: 66, max: 66 });
    expect(parseAreaCategory(null)).toBeNull();
    expect(parseAreaCategory("Pozemek")).toBeNull();
    expect(parseAreaCategory("Byt, 0–5 m²")).toBeNull();
  });
});

describe("estimateProperty — adresní transakce (estate_list)", () => {
  const realizedWard = {
    avgPricePerSqm: 160324,
    numTransactions: 743,
    regionName: "Hlavní město Praha",
    regionAvgPricePerSqm: 112430,
    regionTransactions: 12672,
    wardName: "Žižkov",
    wardAvgPricePerSqm: 160324,
    wardTransactions: 743,
    localityName: null,
    districtName: null,
    entityType: "ward" as const,
    period: "2025-08 – 2026-07",
    totalTransactions: 50469,
  };

  it("přidá adresní transakce jako komparace (label čtvrť + č.p., pricePerSqm null)", async () => {
    mockedRealized.mockResolvedValue(realizedWard);
    mockedRange.mockResolvedValue(rangeResult(126746));
    mockedComps.mockResolvedValue([]);
    mockedWardTx.mockResolvedValue([
      {
        transactionId: 108431536010,
        addressId: 11017264,
        housenumber: "1291",
        lat: 50.09026,
        lng: 14.47424,
        municipality: "Praha",
        ward: "Žižkov",
        wardId: 14971,
        areaCategory: "Byt, 66–70 m²",
        validationDate: "2026-07-29",
      },
      {
        transactionId: 108417111010,
        addressId: 9000974,
        housenumber: "334",
        lat: 50.10236,
        lng: 14.55139,
        municipality: "Praha",
        ward: "Žižkov",
        wardId: 14971,
        areaCategory: "Byt, 76–80 m²",
        validationDate: "2026-07-28",
      },
    ]);

    const r = await estimateProperty(
      {
        cityKey: "praha",
        address: "K Lučinám, Praha 3-Žižkov",
        type: "flat",
        area: 73,
        condition: "good",
        wardHints: ["Žižkov"],
        lat: 50.087,
        lng: 14.449,
      },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, getWardTx: mockedWardTx, now: 1_000 }
    );

    const tx = r.comparables.filter((c) => c.addressTx);
    expect(tx).toHaveLength(2);
    expect(tx[0].label).toBe("Žižkov 1291");
    expect(tx[0].pricePerSqm).toBeNull();
    expect(tx[0].soldAt).toBe(Date.parse("2026-07-29"));
    expect(tx[0].area).toBe(68); // střed rozsahu 66–70
    expect(tx[0].distanceKm).toBeLessThan(2);
    // engine předává ctx (adresa/GPS/hinty) do fetchWardTransactions
    expect(mockedWardTx).toHaveBeenCalledWith("praha", expect.objectContaining({ address: "K Lučinám, Praha 3-Žižkov" }));
    // metodika zmiňuje adresní transakce
    expect(r.methodology.join(" ")).toContain("Adresní transakce");
  });

  it("transakce bez GPS nebo mimo okruh 10 km se vyřadí", async () => {
    mockedRealized.mockResolvedValue(realizedWard);
    mockedRange.mockResolvedValue(rangeResult(126746));
    mockedComps.mockResolvedValue([]);
    mockedWardTx.mockResolvedValue([
      {
        transactionId: 1,
        addressId: 1,
        housenumber: "10",
        lat: 50.087,
        lng: 14.449,
        municipality: "Praha",
        ward: "Žižkov",
        wardId: 14971,
        areaCategory: "Byt, 66–70 m²",
        validationDate: "2026-07-01",
      },
      // bez GPS
      {
        transactionId: 2,
        addressId: 2,
        housenumber: "20",
        lat: null,
        lng: null,
        municipality: "Praha",
        ward: "Žižkov",
        wardId: 14971,
        areaCategory: "Byt, 66–70 m²",
        validationDate: "2026-07-01",
      },
      // daleko (Brno)
      {
        transactionId: 3,
        addressId: 3,
        housenumber: "30",
        lat: 49.195,
        lng: 16.607,
        municipality: "Brno",
        ward: "Brno-střed",
        wardId: 1,
        areaCategory: "Byt, 66–70 m²",
        validationDate: "2026-07-01",
      },
    ]);

    const r = await estimateProperty(
      {
        cityKey: "praha",
        address: "K Lučinám, Praha 3-Žižkov",
        type: "flat",
        area: 73,
        lat: 50.087,
        lng: 14.449,
      },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, getWardTx: mockedWardTx, now: 1_000 }
    );

    const tx = r.comparables.filter((c) => c.addressTx);
    expect(tx).toHaveLength(1);
    expect(tx[0].label).toBe("Žižkov 10");
  });

  it("transakce s nesedící velikostí (mimo ±30 % plochy) se vyřadí", async () => {
    mockedRealized.mockResolvedValue(realizedWard);
    mockedRange.mockResolvedValue(rangeResult(126746));
    mockedComps.mockResolvedValue([]);
    mockedWardTx.mockResolvedValue([
      {
        transactionId: 1,
        addressId: 1,
        housenumber: "10",
        lat: 50.087,
        lng: 14.449,
        municipality: "Praha",
        ward: "Žižkov",
        wardId: 14971,
        areaCategory: "Byt, 66–70 m²",
        validationDate: "2026-07-01",
      },
      // garsonka 26–30 m² vs. oceňovaných 73 m² (±30 % = 51–95) → vyřazena
      {
        transactionId: 2,
        addressId: 2,
        housenumber: "20",
        lat: 50.087,
        lng: 14.449,
        municipality: "Praha",
        ward: "Žižkov",
        wardId: 14971,
        areaCategory: "Byt, 26–30 m²",
        validationDate: "2026-07-01",
      },
    ]);

    const r = await estimateProperty(
      {
        cityKey: "praha",
        address: "K Lučinám, Praha 3-Žižkov",
        type: "flat",
        area: 73,
        lat: 50.087,
        lng: 14.449,
      },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, getWardTx: mockedWardTx, now: 1_000 }
    );

    const tx = r.comparables.filter((c) => c.addressTx);
    expect(tx).toHaveLength(1);
    expect(tx[0].label).toBe("Žižkov 10");
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

describe("estimateProperty — váhy zdrojů", () => {
  it("fallback (celoČR) má nižší váhu než reálné kompy", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 40000,
      numTransactions: 800,
      regionName: "Karlovarský kraj",
      period: "2025-08 – 2026-07",
      totalTransactions: 50000,
    });
    mockedRange.mockResolvedValue({ low: 30000, high: 50000, median: 40000, source: "fallback", sampleSize: 0 });
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      { cityKey: "cheb", type: "flat", area: 70, condition: "good", buildingType: "brick" },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    const offers = r.sources.find((s) => s.key === "offers");
    expect(offers).toBeDefined();
    expect(offers!.label).toContain("ČR (fallback)");
    expect(offers!.weight).toBeLessThan(0.35);
  });
});

describe("estimateProperty — kotva na cenovku inzerátu", () => {
  const realizedRegion = {
    avgPricePerSqm: 90000,
    numTransactions: 12000,
    regionName: "Hlavní město Praha",
    regionAvgPricePerSqm: 90000,
    regionTransactions: 12672,
    entityType: "region",
    period: "2025-08 – 2026-07",
    totalTransactions: 50469,
  };
  const deps = { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 };

  it("přidá zdroj asking (váha 10 %) a posune odhad k cenovce", async () => {
    mockedRealized.mockResolvedValue(realizedRegion);
    mockedRange.mockResolvedValue(rangeResult(85000));
    mockedComps.mockResolvedValue([]);

    const without = await estimateProperty({ cityKey: "praha", type: "flat", area: 60 }, deps);
    const withAsking = await estimateProperty(
      { cityKey: "praha", type: "flat", area: 60, askingPrice: 5_500_000 },
      deps
    );

    const asking = withAsking.sources.find((s) => s.key === "asking");
    expect(asking).toBeDefined();
    expect(asking!.weight).toBe(0.1);
    expect(asking!.pricePerSqm).toBe(Math.round(5_500_000 / 60));
    expect(withAsking.estimate).toBeGreaterThan(without.estimate);
    expect(withAsking.methodology.join(" ")).toContain("Cenovka inzerátu (kotva");
  });

  it("cap: čtvrť nad cenovkou se stáhne na cenovku ×1,05 (Travná/Kyje)", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 145068,
      numTransactions: 29,
      regionName: "Hlavní město Praha",
      regionAvgPricePerSqm: 149906,
      regionTransactions: 12672,
      wardName: "Kyje",
      wardAvgPricePerSqm: 145068,
      wardTransactions: 29,
      localityName: null,
      districtName: null,
      entityType: "ward",
      period: "2026-02 – 2026-07",
      totalTransactions: 50469,
    });
    mockedRange.mockResolvedValue(rangeResult(126746));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      {
        cityKey: "praha",
        address: "Travná, Praha - Kyje",
        type: "flat",
        area: 77,
        condition: "renovated",
        buildingType: "panel",
        floor: 3,
        askingPrice: 8_920_000,
      },
      deps
    );

    const realized = r.sources.find((s) => s.key === "realized")!;
    // cenovka 115 844 ≥ 0,75×145 068 (věrohodná) → cap 115 844 × 1,05 = 121 636;
    // × 0,918 (1,08 renovated × 0,85 panel) = 111 662 (bez trendu = indexace 1)
    expect(realized.pricePerSqm).toBe(111662);
    expect(realized.note).toContain("omezena na 105 %");
    // label transparentně říká, že raw průměr (145 068) byl omezen cenovkou
    expect(realized.label).toContain("čtvrť Kyje");
    expect(realized.label).toContain("omezeno cenovkou");
    // odhad pod cenovkou 8,92M — kotva táhne dolů, ne nahoru
    expect(r.estimate).toBeLessThan(8_920_000);
  });

  it("nabídky nad 1,15× realizované reference se clampnou na 1,15×", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 100000,
      numTransactions: 12000,
      regionName: "Hlavní město Praha",
      regionAvgPricePerSqm: 100000,
      regionTransactions: 12672,
      entityType: "region",
      period: "2025-08 – 2026-07",
      totalTransactions: 50469,
    });
    // nabídky 140k jsou nad pásmem [80k, 115k] kolem realizovaných 100k
    mockedRange.mockResolvedValue(rangeResult(140000));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      { cityKey: "praha", type: "flat", area: 60 },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    const offers = r.sources.find((s) => s.key === "offers")!;
    expect(offers.pricePerSqm).toBe(115000); // 100 000 × 1,15
    expect(offers.note).toContain("omezeno na něj");
  });

  it("čtvrť s malým vzorkem (<100 tx) má širší rozmezí než velká čtvrť", async () => {
    const small = {
      avgPricePerSqm: 100000,
      numTransactions: 29,
      regionName: "Hlavní město Praha",
      regionAvgPricePerSqm: 100000,
      regionTransactions: 12672,
      wardName: "Kyje",
      wardAvgPricePerSqm: 100000,
      wardTransactions: 29,
      localityName: null,
      districtName: null,
      entityType: "ward" as const,
      period: "2026-02 – 2026-07",
      totalTransactions: 50469,
    };
    const big = { ...small, numTransactions: 5000, wardTransactions: 5000, wardName: "Žižkov" };
    mockedRange.mockResolvedValue(rangeResult(100000));
    mockedComps.mockResolvedValue([]);

    mockedRealized.mockResolvedValue(small);
    const rSmall = await estimateProperty(
      { cityKey: "praha", type: "flat", area: 60 },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );
    mockedRealized.mockResolvedValue(big);
    const rBig = await estimateProperty(
      { cityKey: "praha", type: "flat", area: 60 },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    const spreadSmall = (rSmall.high - rSmall.low) / (2 * rSmall.estimate);
    const spreadBig = (rBig.high - rBig.low) / (2 * rBig.estimate);
    expect(spreadSmall).toBeGreaterThan(spreadBig);
    expect(spreadSmall).toBeGreaterThanOrEqual(0.08);
  });

  it("cap se nespustí u nevěrohodné cenovky (< 0,75× průměru čtvrti)", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 145068,
      numTransactions: 29,
      regionName: "Hlavní město Praha",
      regionAvgPricePerSqm: 149906,
      regionTransactions: 12672,
      wardName: "Kyje",
      wardAvgPricePerSqm: 145068,
      wardTransactions: 29,
      localityName: null,
      districtName: null,
      entityType: "ward",
      period: "2026-02 – 2026-07",
      totalTransactions: 50469,
    });
    mockedRange.mockResolvedValue(rangeResult(126746));
    mockedComps.mockResolvedValue([]);

    // cenovka 40 000 Kč/m² (překlep/podíl) → 40 000 < 108 801 (0,75×145 068) → žádný cap
    const r = await estimateProperty(
      {
        cityKey: "praha",
        address: "Travná, Praha - Kyje",
        type: "flat",
        area: 77,
        condition: "renovated",
        buildingType: "panel",
        askingPrice: 77 * 40_000,
      },
      deps
    );

    const realized = r.sources.find((s) => s.key === "realized")!;
    expect(realized.pricePerSqm).toBe(133172); // 145 068 × 0,918 bez capu
    expect(realized.note).not.toContain("omezena na 105 %");
  });

  it("absurdní cenovka (> 300 000/m²) kotvu nepřidá", async () => {
    mockedRealized.mockResolvedValue(realizedRegion);
    mockedRange.mockResolvedValue(rangeResult(85000));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      { cityKey: "praha", type: "flat", area: 60, askingPrice: 60 * 400_000 },
      deps
    );
    expect(r.sources.find((s) => s.key === "asking")).toBeUndefined();
  });

  it("předražená cenovka (> 1,4× tržní blend) kotvu vynechá — netáhne odhad nahoru", async () => {
    mockedRealized.mockResolvedValue(realizedRegion);
    mockedRange.mockResolvedValue(rangeResult(85000));
    mockedComps.mockResolvedValue([]);

    // tržní blend (realizované 90k + nabídky 85k) ≈ 87 812 → cenovka 150k je nad 1,4×
    const r = await estimateProperty(
      { cityKey: "praha", type: "flat", area: 60, askingPrice: 60 * 150_000 },
      deps
    );
    expect(r.sources.find((s) => s.key === "asking")).toBeUndefined();
  });

  it("cap platí i při shrinkToRegion (interakce shrink × cenovka)", async () => {
    // Žižkov: čtvrť 160 324 > 1,35× kraj 112 430 (shrink by se aktivoval)
    // cenovka 7 500 000 / 60 m² = 125 000 ≥ 0,75×160 324 (věrohodná) → cap 131 250
    // → nižší než shrink 148 350, takže cap vyhrává i při aktivním shrinku
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 160324,
      numTransactions: 743,
      regionName: "Hlavní město Praha",
      regionAvgPricePerSqm: 112430,
      regionTransactions: 12672,
      wardName: "Žižkov",
      wardAvgPricePerSqm: 160324,
      wardTransactions: 743,
      localityName: null,
      districtName: null,
      entityType: "ward",
      period: "2025-08 – 2026-07",
      totalTransactions: 50469,
    });
    mockedRange.mockResolvedValue(rangeResult(120000));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      { cityKey: "praha", type: "flat", area: 60, condition: "good", askingPrice: 7_500_000 },
      deps
    );

    const realized = r.sources.find((s) => s.key === "realized")!;
    // cap: 125 000 × 1,05 = 131 250 × 0,97 (mixSkew) = 127 313 → vyhrává nad shrinkem 148 350
    expect(realized.pricePerSqm).toBe(127313);
    expect(realized.note).toContain("omezena na 105 %");
  });

  it("BUG 9: čtvrť nad 1,2× nabídkový medián se omezí na 1,2× nabídky (Žižkov/K Lučinám)", async () => {
    // Žižkov: ward průměr nafouknutý novostavbami (168 823 indexovaně) vs. cenovka
    // inzerátu 124 986 = 0,74×ward → strážní hranice asking ≥ 0,75×ward se nespustí,
    // ale nabídky segmentu (126 746) ukazují realitu (~129k, jak potvrzuje Valuo).
    // Druhá pojistka: ward > 1,2×nabídky → reference omezena na 1,2× nabídky.
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 168823, // živý run: 164 720 × indexace 1,0249
      numTransactions: 386,
      regionName: "Hlavní město Praha",
      regionAvgPricePerSqm: 149906,
      regionTransactions: 12672,
      wardName: "Žižkov",
      wardAvgPricePerSqm: 168823,
      wardTransactions: 386,
      localityName: null,
      districtName: null,
      entityType: "ward",
      period: "2026-02 – 2026-07",
      totalTransactions: 50469,
    });
    mockedRange.mockResolvedValue(rangeResult(126746));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      {
        cityKey: "praha",
        address: "K Lučinám 2469/21, Žižkov, Praha",
        type: "flat",
        area: 72,
        condition: "renovated",
        buildingType: "panel",
        floor: 1,
        askingPrice: 8_999_000, // 124 986 Kč/m² → 0,74×ward, cap na cenovku NELETÍ
      },
      deps
    );

    const realized = r.sources.find((s) => s.key === "realized")!;
    // offers cap: 126 746 × 1,2 = 152 095 × 0,89964 (1,08 renovated × 0,85 panel × 0,98 patro) = 136 831
    expect(realized.pricePerSqm).toBe(136831);
    expect(realized.label).toContain("omezeno nabídkami");
    expect(realized.note).toContain("1,2× nabídkový medián");
    // cap na cenovku se NEaplikoval (cenovka pod 0,75×ward) — label to neříká
    expect(realized.label).not.toContain("omezeno cenovkou");
    // blend: realized 136 830 × 0,45 + offers 126 746 × 0,35 + asking 124 986/0,9554 × 0,1
    // ≈ 126 343/m² × 72 m² = 9 096 696 → 9 097 000 (Valuo: 9 315 720 = 129 385/m²)
    expect(r.estimate).toBe(9097000);
    // bez offers capu by realizedAdj byl 168 823 × 0,89964 = 151 861 → odhad ~10,2M
    expect(r.estimate).toBeLessThan(9_400_000);
  });

  it("BUG 9: prémiová čtvrť bez novostavbové inflace zůstane nedotčená (ward ≤ 1,2×nabídky)", async () => {
    // Dejvice: ward 190 000 vs. nabídky 160 000 → 190 000 < 1,2×160 000 = 192 000 → žádný cap
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 190000,
      numTransactions: 900,
      regionName: "Hlavní město Praha",
      regionAvgPricePerSqm: 149906,
      regionTransactions: 12672,
      wardName: "Dejvice",
      wardAvgPricePerSqm: 190000,
      wardTransactions: 900,
      localityName: null,
      districtName: null,
      entityType: "ward",
      period: "2026-02 – 2026-07",
      totalTransactions: 50469,
    });
    mockedRange.mockResolvedValue(rangeResult(160000));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      { cityKey: "praha", type: "flat", area: 60, condition: "renovated" },
      deps
    );

    const realized = r.sources.find((s) => s.key === "realized")!;
    expect(realized.label).not.toContain("omezeno nabídkami");
    // 190 000 × 1,08 = 205 200 (bez capu)
    expect(realized.pricePerSqm).toBe(205200);
  });
});

describe("transportMultiplier (Vlak Index)", () => {
  it("skóre 50 = průměr (×1,00)", () => {
    expect(transportMultiplier(50)).toBeCloseTo(1, 5);
    expect(transportMultiplier(null)).toBe(1);
    expect(transportMultiplier(undefined)).toBe(1);
    expect(transportMultiplier(Number.NaN)).toBe(1);
  });
  it("výborná doprava = prémie, slabá = srážka", () => {
    expect(transportMultiplier(100)).toBeCloseTo(1.06, 5);
    expect(transportMultiplier(0)).toBeCloseTo(0.94, 5);
    expect(transportMultiplier(80)).toBeGreaterThan(1);
    expect(transportMultiplier(20)).toBeLessThan(1);
  });
  it("clamp mimo 0–100", () => {
    expect(transportMultiplier(500)).toBe(1.06);
    expect(transportMultiplier(-10)).toBe(0.94);
  });
});

describe("estimateProperty — dopravní vrstva (Vlak Index)", () => {
  it("aplikuje transportMultiplier na odhad a vrátí transport v resultu", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 90000,
      numTransactions: 12000,
      regionName: "Hlavní město Praha",
      regionAvgPricePerSqm: 90000,
      regionTransactions: 12672,
      entityType: "region",
      period: "2025-08 – 2026-07",
      totalTransactions: 50469,
    });
    mockedRange.mockResolvedValue(rangeResult(85000));
    mockedComps.mockResolvedValue([]);

    const transport = {
      metroDistance: 250,
      trainDistance: 400,
      busDistance: 120,
      score: 88,
      sampleSize: 24,
      source: "quarter" as const,
      quarterLabel: "Žižkov",
      premiumPct: 4.2,
    };
    const base = await estimateProperty(
      { cityKey: "praha", type: "flat", area: 60, condition: "renovated", buildingType: "brick" },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );
    const withTransport = await estimateProperty(
      { cityKey: "praha", type: "flat", area: 60, condition: "renovated", buildingType: "brick", transport },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    expect(withTransport.estimate).toBeGreaterThan(base.estimate);
    expect(withTransport.transport).toEqual(transport);
    expect(withTransport.methodology.join(" ")).toContain("Doprava (Vlak Index)");
  });

  it("slabá doprava stáhne odhad dolů", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 90000,
      numTransactions: 12000,
      regionName: "Hlavní město Praha",
      regionAvgPricePerSqm: 90000,
      regionTransactions: 12672,
      entityType: "region",
      period: "2025-08 – 2026-07",
      totalTransactions: 50469,
    });
    mockedRange.mockResolvedValue(rangeResult(85000));
    mockedComps.mockResolvedValue([]);

    const base = await estimateProperty(
      { cityKey: "praha", type: "flat", area: 60 },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );
    const withTransport = await estimateProperty(
      {
        cityKey: "praha",
        type: "flat",
        area: 60,
        transport: {
          metroDistance: 5000,
          trainDistance: 8000,
          busDistance: 2000,
          score: 5,
          sampleSize: 12,
          source: "city" as const,
          quarterLabel: null,
          premiumPct: null,
        },
      },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );
    expect(withTransport.estimate).toBeLessThan(base.estimate);
    expect(withTransport.confidenceScore).toBeGreaterThanOrEqual(base.confidenceScore);
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

describe("Valuo-style vstupy — multiplikátory", () => {
  it("panel je ~15 % pod smíšeným průměrem (ne 25 % — průměr už mix obsahuje)", () => {
    expect(buildingTypeMultiplier("panel")).toBe(0.85);
    expect(buildingTypeMultiplier("brick")).toBe(1);
    expect(buildingTypeMultiplier(null)).toBe(1);
  });

  it("družstevní vlastnictví = sleva ~14 %", () => {
    expect(ownershipMultiplier("cooperative")).toBe(0.86);
    expect(ownershipMultiplier("personal")).toBe(1);
    expect(ownershipMultiplier("other")).toBe(0.95);
    expect(ownershipMultiplier(null)).toBe(1);
  });

  it("přízemí −7 %, bez výtahu od 3. patra −10 %, podkroví −7 %", () => {
    expect(floorMultiplier(0)).toBe(0.93);
    expect(floorMultiplier(1)).toBe(0.98);
    expect(floorMultiplier(3, null, false)).toBe(0.9);
    expect(floorMultiplier(4, 5, false)).toBe(0.9); // 4. patro bez výtahu
    expect(floorMultiplier(5, 5, null)).toBe(0.93); // nejvyšší patro, výtah neznámý
    expect(floorMultiplier(5, 5, true)).toBe(0.96); // nejvyšší patro s výtahem
    expect(floorMultiplier(2, 5, true)).toBe(1);
    expect(floorMultiplier(null)).toBe(1);
  });

  it("balkón +4–10 %, zahrada +8–20 %, sklep mírně", () => {
    expect(balconyMultiplier(null)).toBe(1);
    expect(balconyMultiplier(6)).toBeCloseTo(1.064, 3);
    expect(balconyMultiplier(30)).toBe(1.1); // cap +10 %
    expect(gardenMultiplier(0)).toBe(1);
    expect(gardenMultiplier(10)).toBeCloseTo(1.12, 3);
    expect(gardenMultiplier(40)).toBe(1.2); // cap +20 %
    expect(cellarMultiplier(5)).toBeCloseTo(1.01, 3);
    expect(cellarMultiplier(null)).toBe(1);
  });

  it("engine aplikuje družstevní vlastnictví, podkroví i balkón do odhadu", async () => {
    const realized = {
      avgPricePerSqm: 90000,
      numTransactions: 12000,
      regionName: "Hlavní město Praha",
      regionAvgPricePerSqm: 90000,
      regionTransactions: 12672,
      entityType: "region",
      period: "2025-08 – 2026-07",
      totalTransactions: 50469,
    };
    mockedRealized.mockResolvedValue(realized);
    mockedRange.mockResolvedValue(rangeResult(85000));
    mockedComps.mockResolvedValue([]);

    const base = await estimateProperty(
      { cityKey: "praha", type: "flat", area: 60, condition: "good", buildingType: "panel", floor: 0 },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );
    const cooperative = await estimateProperty(
      {
        cityKey: "praha",
        type: "flat",
        area: 60,
        condition: "good",
        buildingType: "panel",
        floor: 0,
        ownership: "cooperative",
        balconyArea: 8,
        gardenArea: 0,
        cellarArea: 0,
      },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    // družstevní (0,86) + balkón (~1,07) vs. jen přízemí — očekáváme nižší odhad
    expect(cooperative.estimate).toBeLessThan(base.estimate);
    expect(cooperative.methodology.join(" ")).toContain("vlastnictví");
    expect(cooperative.methodology.join(" ")).toContain("balkón");
  });
});

describe("scaleToDate — odhad k datu", () => {
  const trend = [
    { monthYear: "08/2025", price: 100000 },
    { monthYear: "01/2026", price: 105000 },
    { monthYear: "07/2026", price: 110000 },
  ];
  const base = {
    estimate: 5_000_000,
    low: 4_600_000,
    high: 5_400_000,
    pricePerSqm: 100_000,
    lowPerSqm: 92_000,
    highPerSqm: 108_000,
    confidenceScore: 80,
    confidenceLabel: "Vysoká" as const,
    sources: [],
    comparables: [],
    trend: [],
    methodology: ["Metodika"],
    generatedAt: 1_000,
  };

  it("zpětný odhad indexuje ceny dolů dle trendu", () => {
    // 08/2025 = 100 000 vs. nejnovější 07/2026 = 110 000 → faktor 0,909
    const r = scaleToDate(base, "2025-08", trend);
    expect(r.estimate).toBe(Math.round(5_000_000 * (100000 / 110000)));
    expect(r.pricePerSqm).toBe(Math.round(100_000 * (100000 / 110000)));
    expect(r.methodology.join(" ")).toContain("indexovány");
  });

  it("bez validního data / trendu vrací výsledek beze změny", () => {
    expect(scaleToDate(base, null, trend)).toEqual(base);
    expect(scaleToDate(base, "2025-13", trend)).toEqual(base);
    expect(scaleToDate(base, "2025-08", [])).toEqual(base);
  });
});

describe("estimateProperty — dvojí započtení lokality (Fáze A)", () => {
  it("prémiová čtvrť (ward): category ×1,2 se NEzapočítá — průměr čtvrti lokalitu už obsahuje", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 170000,
      numTransactions: 800,
      regionName: "Hlavní město Praha",
      regionAvgPricePerSqm: 140000,
      regionTransactions: 12672,
      wardName: "Vinohrady",
      wardAvgPricePerSqm: 170000,
      wardTransactions: 800,
      localityName: null,
      districtName: null,
      entityType: "ward",
      period: "2025-08 – 2026-07",
      totalTransactions: 50469,
    });
    mockedRange.mockResolvedValue(rangeResult(165000));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      {
        cityKey: "praha",
        address: "Vinohradská, Praha 2 - Vinohrady",
        type: "flat",
        area: 60,
        condition: "good",
        category: "premium",
        wardHints: ["Vinohrady"],
      },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    const realized = r.sources.find((s) => s.key === "realized")!;
    // 170 000 × 0,97 (mixSkew good+ward) = 164 900 — bez ×1,2 (stará logika: 197 880)
    expect(realized.pricePerSqm).toBe(164900);
    // metodika neukazuje „lokalita 1.20×" — korekce se na čtvrti neaplikuje
    expect(r.methodology.join(" ")).not.toContain("lokalita");
  });

  it("riziková čtvrť (ward): category ×0,7 se NEzapočítá — průměr čtvrti je už nízký", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 90000,
      numTransactions: 500,
      regionName: "Hlavní město Praha",
      regionAvgPricePerSqm: 140000,
      regionTransactions: 12672,
      wardName: "Černý Most",
      wardAvgPricePerSqm: 90000,
      wardTransactions: 500,
      localityName: null,
      districtName: null,
      entityType: "ward",
      period: "2025-08 – 2026-07",
      totalTransactions: 50469,
    });
    mockedRange.mockResolvedValue(rangeResult(95000));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      {
        cityKey: "praha",
        address: "Bryksova, Praha 14 - Černý Most",
        type: "flat",
        area: 65,
        condition: "good",
        category: "risky",
        wardHints: ["Černý Most"],
      },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    const realized = r.sources.find((s) => s.key === "realized")!;
    // 90 000 × 0,97 = 87 300 — bez ×0,7 (stará logika: 61 110)
    expect(realized.pricePerSqm).toBe(87300);
  });

  it("prémiová čtvrť s neznámým stavem: category se odečte i z NABÍDEK (segment any)", async () => {
    // market-price-service při segmentu „any" (chybí condition/buildingType) vynásobí
    // medián nabídek ×1,2 — mock to napodobuje (180 000 = 150 000 × 1,2 premium).
    // Na úrovni čtvrti engine kategorii z nabídek odečte → zpátky na 150 000.
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 170000,
      numTransactions: 800,
      regionName: "Hlavní město Praha",
      regionAvgPricePerSqm: 140000,
      regionTransactions: 12672,
      wardName: "Vinohrady",
      wardAvgPricePerSqm: 170000,
      wardTransactions: 800,
      localityName: null,
      districtName: null,
      entityType: "ward",
      period: "2025-08 – 2026-07",
      totalTransactions: 50469,
    });
    mockedRange.mockResolvedValue(rangeResult(180000)); // už ×1,2 premium (simulace služby)
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      {
        cityKey: "praha",
        address: "Vinohradská, Praha 2 - Vinohrady",
        type: "flat",
        area: 60,
        category: "premium",
        wardHints: ["Vinohrady"],
        // condition/buildingType NEZNÁMÉ → segment „any" → služba aplikovala ×1,2
      },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    const offers = r.sources.find((s) => s.key === "offers")!;
    // 180 000 / 1,2 = 150 000 — bez de-aplikace by zůstalo 180 000
    expect(offers.pricePerSqm).toBe(150000);
  });

  it("obecní úroveň (municipality): category se STÁLE započítává (jediná distriktní korekce)", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 90000,
      numTransactions: 3000,
      regionName: "Jihomoravský kraj",
      regionAvgPricePerSqm: 85000,
      regionTransactions: 12000,
      districtName: "Brno-město",
      districtAvgPricePerSqm: 88000,
      districtTransactions: 4000,
      localityName: "Brno",
      localityAvgPricePerSqm: 90000,
      localityTransactions: 3000,
      entityType: "municipality",
      period: "2025-08 – 2026-07",
      totalTransactions: 50469,
    });
    mockedRange.mockResolvedValue(rangeResult(95000));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      { cityKey: "brno", address: "Veveří, Brno", type: "flat", area: 60, condition: "renovated", category: "premium" },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    const realized = r.sources.find((s) => s.key === "realized")!;
    // 90 000 × 1,2 (premium) × 1,08 (renovated) = 116 640
    expect(realized.pricePerSqm).toBe(116640);
    expect(r.methodology.join(" ")).toContain("lokalita");
  });
});

describe("estimateProperty — nebytové typy (Fáze A)", () => {
  it("dům: realized i wardTx se nevolají, odhad stojí na nabídkách + širší rozmezí", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 149906,
      numTransactions: 12672,
      regionName: "Hlavní město Praha",
      regionAvgPricePerSqm: 149906,
      regionTransactions: 12672,
      entityType: "region",
      period: "2025-08 – 2026-07",
      totalTransactions: 50469,
    });
    mockedRange.mockResolvedValue(rangeResult(65000));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      { cityKey: "praha", address: "Nad Krocínkou, Praha 8", type: "house", area: 120 },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, getWardTx: mockedWardTx, now: 1_000 }
    );

    // realized zdroj se u domu NEVOLÁ ani nezapočítává (cenová mapa = byty)
    expect(mockedRealized).not.toHaveBeenCalled();
    expect(mockedWardTx).not.toHaveBeenCalled();
    expect(r.sources.find((s) => s.key === "realized")).toBeUndefined();
    expect(r.sources.find((s) => s.key === "offers")).toBeDefined();
    expect(r.estimate).toBeGreaterThan(0);
    // bez realizovaných → širší rozmezí (byty ≠ domy na m²)
    const spreadPct = (r.high - r.low) / (2 * r.estimate);
    expect(spreadPct).toBeGreaterThanOrEqual(0.1);
    expect(r.methodology.join(" ")).toContain("Realizované prodeje z cenové mapy se týkají bytů");
  });

  it("byt (default) se chová jako dřív — realized se volá a používá", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 149906,
      numTransactions: 12672,
      regionName: "Hlavní město Praha",
      regionAvgPricePerSqm: 149906,
      regionTransactions: 12672,
      entityType: "region",
      period: "2025-08 – 2026-07",
      totalTransactions: 50469,
    });
    mockedRange.mockResolvedValue(rangeResult(120000));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      { cityKey: "praha", address: "K Lučinám, Praha 3", type: "flat", area: 60 },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    expect(mockedRealized).toHaveBeenCalled();
    expect(r.sources.find((s) => s.key === "realized")).toBeDefined();
  });
});

describe("timeIndexFactor (BUG 5)", () => {
  const trend = [
    { monthYear: "2026/02", price: 100000 },
    { monthYear: "2026/03", price: 101000 },
    { monthYear: "2026/05", price: 103000 },
    { monthYear: "2026/07", price: 105000 },
  ];

  it("faktor = nejnovější bod / bod ve středu okna (interpolace dle skutečných dnů)", () => {
    // okno 2026-02 – 2026-07 → střed 2026-04 → interpolace 101k↔103k mezi 1.3. a 1.5.
    // (poměr 31/61 dne) = 102 016.39; nejnovější = 2026/07 = 105 000 → 1.0292463
    expect(timeIndexFactor("2026-02 – 2026-07", trend)).toBeCloseTo(105000 / 102016.39344262295, 4);
  });

  it("bez trendu / nevalidní okno / kratší trend → 1", () => {
    expect(timeIndexFactor(null, trend)).toBe(1);
    expect(timeIndexFactor(undefined, trend)).toBe(1);
    expect(timeIndexFactor("2026-02 – 2026-07", [])).toBe(1);
    expect(timeIndexFactor("2026-02 – 2026-07", trend.slice(0, 1))).toBe(1);
    expect(timeIndexFactor("špatně zapsané okno", trend)).toBe(1);
    expect(timeIndexFactor("2026-13 – 2026-07", trend)).toBe(1);
  });

  it("faktor mimo ±10 % → 1 (národní trend nesmí otočit cenu čtvrti o víc)", () => {
    const jump = [
      { monthYear: "2026/02", price: 100000 },
      { monthYear: "2026/07", price: 130000 },
    ];
    // střed 2026-04 → interpolace 100k↔130k = 112 000; 130000/112000 = 1.16 > 1.1 → 1
    expect(timeIndexFactor("2026-02 – 2026-07", jump)).toBe(1);
  });
});

describe("estimateProperty — BUG 5: indexace realizovaných na dnešek", () => {
  const realizedMunicipality = {
    avgPricePerSqm: 100000,
    numTransactions: 3000,
    regionName: "Jihomoravský kraj",
    regionAvgPricePerSqm: 95000,
    regionTransactions: 12000,
    districtName: "Brno-město",
    districtAvgPricePerSqm: 98000,
    districtTransactions: 5000,
    localityName: "Brno",
    localityAvgPricePerSqm: 100000,
    localityTransactions: 3000,
    entityType: "municipality",
    period: "2026-02 – 2026-07",
    totalTransactions: 50469,
    trend: [
      { monthYear: "2026/02", price: 100000 },
      { monthYear: "2026/03", price: 101000 },
      { monthYear: "2026/05", price: 103000 },
      { monthYear: "2026/07", price: 105000 },
    ],
  };

  it("realizované se vynásobí faktorem trendu a label řekne 'indexováno'", async () => {
    mockedRealized.mockResolvedValue(realizedMunicipality);
    mockedRange.mockResolvedValue(rangeResult(105000));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      { cityKey: "brno", address: "Běhounská, Brno", type: "flat", area: 60 },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    const realized = r.sources.find((s) => s.key === "realized")!;
    // 100 000 × 1.0292463 = 102 925 (bez indexace by bylo 100 000)
    expect(realized.pricePerSqm).toBe(102925);
    expect(realized.label).toContain("indexováno na dnešek");
    expect(realized.note).toContain("Indexováno na dnešek");
  });

  it("bez trendu v realized → beze změny (faktor 1)", async () => {
    const { trend: _drop, ...noTrend } = realizedMunicipality;
    mockedRealized.mockResolvedValue(noTrend);
    mockedRange.mockResolvedValue(rangeResult(105000));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      { cityKey: "brno", address: "Běhounská, Brno", type: "flat", area: 60 },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    const realized = r.sources.find((s) => s.key === "realized")!;
    expect(realized.pricePerSqm).toBe(100000);
    expect(realized.label).not.toContain("indexováno");
  });

  it("indexace NEzdvojuje capnutou hodnotu (index-first pořadí)", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 145068,
      numTransactions: 29,
      regionName: "Hlavní město Praha",
      regionAvgPricePerSqm: 149906,
      regionTransactions: 12672,
      wardName: "Kyje",
      wardAvgPricePerSqm: 145068,
      wardTransactions: 29,
      localityName: null,
      districtName: null,
      entityType: "ward",
      period: "2026-02 – 2026-07",
      totalTransactions: 50469,
      trend: [
        { monthYear: "2026/02", price: 100000 },
        { monthYear: "2026/03", price: 101000 },
        { monthYear: "2026/05", price: 103000 },
        { monthYear: "2026/07", price: 105000 },
      ],
    });
    mockedRange.mockResolvedValue(rangeResult(126746));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      {
        cityKey: "praha",
        address: "Travná, Praha - Kyje",
        type: "flat",
        area: 77,
        condition: "renovated",
        buildingType: "panel",
        askingPrice: 8_920_000,
      },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    const realized = r.sources.find((s) => s.key === "realized")!;
    // mocked trend (02:100k, 03:101k, 05:103k, 07:105k) → timeIndexFactor = 1.02925;
    // indexovaná čtvrť 145 068 × 1,02925 = 149 311 → cap 115 844 × 1,05 = 121 636;
    // × 0,918 = 111 662. Kdyby indexace jela ZA capem (bug), bylo by
    // 121 636 × 0,918 × 1,02925 = 114 928 — čtvrť by se nafoukla podruhé.
    expect(realized.pricePerSqm).toBe(111662);
    expect(realized.label).toContain("omezeno cenovkou");
    // capnutá hodnota je ukotvená k dnešní cenovce → žádné „indexováno"
    expect(realized.label).not.toContain("indexováno");
  });

  it("zpětný odhad (asOfDate): indexace se vynechá — o čas se stará scaleToDate", async () => {
    mockedRealized.mockResolvedValue(realizedMunicipality);
    mockedRange.mockResolvedValue(rangeResult(105000));
    mockedComps.mockResolvedValue([]);

    const r = await estimateProperty(
      { cityKey: "brno", address: "Běhounská, Brno", type: "flat", area: 60, asOfDate: "2026-05" },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    const realized = r.sources.find((s) => s.key === "realized")!;
    expect(realized.pricePerSqm).toBe(100000);
    expect(realized.label).not.toContain("indexováno");
  });
});

describe("estimateProperty — BUG 7: clamp multiplikátorů", () => {
  it("luxury × novostavba × balkón × zahrada × sklep × premium se clampne na 1.6×", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 100000,
      numTransactions: 3000,
      regionName: "Jihomoravský kraj",
      regionAvgPricePerSqm: 95000,
      regionTransactions: 12000,
      districtName: "Brno-město",
      districtAvgPricePerSqm: 98000,
      districtTransactions: 5000,
      localityName: "Brno",
      localityAvgPricePerSqm: 100000,
      localityTransactions: 3000,
      entityType: "municipality",
      period: "2025-08 – 2026-07",
      totalTransactions: 50469,
    });
    mockedRange.mockResolvedValue(rangeResult(105000));
    mockedComps.mockResolvedValue([]);

    // baseMult: luxury 1.25 × rok 2020 (1.08) × balkón 30 m² (1.1) × zahrada 40 m² (1.2)
    // × sklep (1.01) ≈ 1.80; s premium (1.2) = ~2.16 → clamp na 1.6
    const r = await estimateProperty(
      {
        cityKey: "brno",
        address: "Veveří, Brno",
        type: "flat",
        area: 60,
        condition: "luxury",
        buildingType: "brick",
        yearBuilt: 2020,
        balconyArea: 30,
        gardenArea: 40,
        cellarArea: 5,
        category: "premium",
      },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    const realized = r.sources.find((s) => s.key === "realized")!;
    expect(realized.pricePerSqm).toBe(160000); // 100 000 × 1.6
    expect(r.methodology.join(" ")).toContain("celkem 1.60×");
  });

  it("kombinace pod 0.5× (panel × neobyvatelný × družstevní × přízemí × starý rok) se clampne na 0.5×", async () => {
    mockedRealized.mockResolvedValue({
      avgPricePerSqm: 100000,
      numTransactions: 3000,
      regionName: "Jihomoravský kraj",
      regionAvgPricePerSqm: 95000,
      regionTransactions: 12000,
      entityType: "region",
      period: "2025-08 – 2026-07",
      totalTransactions: 50469,
    });
    mockedRange.mockResolvedValue(rangeResult(105000));
    mockedComps.mockResolvedValue([]);

    // panel 0.85 × neobyvatelný 0.7 × družstevní 0.86 × přízemí 0.93 × rok 1930 (0.96)
    // = 0.4569 → clamp na 0.5
    const r = await estimateProperty(
      {
        cityKey: "brno",
        type: "flat",
        area: 60,
        condition: "dilapidated",
        buildingType: "panel",
        ownership: "cooperative",
        floor: 0,
        yearBuilt: 1930,
      },
      { getRealized: mockedRealized, getRange: mockedRange, getComps: mockedComps, now: 1_000 }
    );

    const realized = r.sources.find((s) => s.key === "realized")!;
    expect(realized.pricePerSqm).toBe(50000); // 100 000 × 0.5 (clamp)
    expect(r.methodology.join(" ")).toContain("celkem 0.50×");
  });
});
