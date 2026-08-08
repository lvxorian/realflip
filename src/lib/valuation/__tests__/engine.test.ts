import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  estimateProperty,
  attachTrend,
  areaSizeFactor,
  transportMultiplier,
  scaleToDate,
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
}));

vi.mock("@/db", () => ({ db: {}, schema: {} }));
vi.mock("@/lib/scraping/rate-limiter", () => ({
  RateLimiter: { getInstance: () => ({ wait: async () => {} }) },
}));
vi.mock("@/lib/valuation/price-map", () => ({
  getRealizedRegionForCity: state.realized,
  getRealizedLocalityForCity: state.realized,
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

  it("cap: čtvrť nad cenovkou ×1,05 se stáhne na cenovku ×1,05 (Travná/Kyje)", async () => {
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
    // cenovka 115 844 × 1,05 = 121 636; × 0,918 (1,08 renovated × 0,85 panel) = 111 662
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

  it("cap se nespustí u nevěrohodné cenovky (< 0,5× průměru čtvrti)", async () => {
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

    // cenovka 40 000 Kč/m² (překlep/podíl) → 40 000 < 72 534 (0,5×145 068) → žádný cap
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
    // cenovka 5 000 000 / 60 m² = 83 333/m² → cap 87 500 → nižší než shrink 148 350
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
      { cityKey: "praha", type: "flat", area: 60, condition: "good", askingPrice: 5_000_000 },
      deps
    );

    const realized = r.sources.find((s) => s.key === "realized")!;
    // cap: 83 333 × 1,05 = 87 500 × 0,97 (mixSkew) = 84 875 → vyhrává nad shrinkem 148 350
    expect(realized.pricePerSqm).toBe(84875);
    expect(realized.note).toContain("omezena na 105 %");
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
