import { describe, it, expect, vi, beforeEach } from "vitest";
import { toRawListing, roomsFromRealingoUrl, fetchAllRealingoOffers, REALINGO_PAGE_SIZE, type RealingoSearchConfig } from "../offers";
import type { RealingoOffer, RealingoPriceStats } from "../types";

const { gqlMock } = vi.hoisted(() => ({ gqlMock: vi.fn() }));
vi.mock("../graphql-client", () => ({
  getRealingoClient: () => ({ gql: gqlMock }),
}));

function offer(over: Partial<RealingoOffer> = {}): RealingoOffer {
  return {
    id: "o1",
    url: "https://www.realingo.cz/prodej/byt-3+1-bukovecka-praha/24639942",
    purpose: "SELL",
    property: "FLAT",
    isLocked: false,
    createdAt: "2026-08-25T10:00:00Z",
    category: null,
    price: { type: "TOTAL", total: 5_500_000, canonical: 5_500_000, squareMeter: 77465, squareMeterCanonical: 77465, currency: "CZK" },
    area: { main: 71, plot: null },
    photos: { main: "https://cdn.realingo.cz/a.jpg", list: ["https://cdn.realingo.cz/b.jpg"] },
    location: { address: "Bukovecká, Praha", latitude: 50.0, longitude: 14.5 },
    ...over,
  };
}

const statsOk: RealingoPriceStats = {
  offerId: "o1",
  status: "OK",
  error: null,
  stats: { tier: "1", label: "Velmi dobrá cena", iqrDeviation: -0.4, n: 42, lowConfidence: false, effectivePriceCzk: 5_000_000, bands: [] },
};

describe("roomsFromRealingoUrl", () => {
  it("vytáhne dispozici ze slugu", () => {
    expect(roomsFromRealingoUrl("https://www.realingo.cz/prodej/byt-3+1-bukovecka-praha/24639942")).toBe("3+1");
    expect(roomsFromRealingoUrl("https://www.realingo.cz/prodej/byt-2+kk-zerotinova-praha/24639983")).toBe("2+kk");
    expect(roomsFromRealingoUrl("/pronajem/byt-4+kk-brno/123")).toBe("4+kk");
  });

  it("null když dispozice není v URL", () => {
    expect(roomsFromRealingoUrl("https://www.realingo.cz/prodej/byt-ostatni-byty-praha-142-00/24640375")).toBeNull();
    expect(roomsFromRealingoUrl(null)).toBeNull();
  });
});

describe("toRawListing — titulek a fotky", () => {
  it("formátuje český titulek s dispozicí a plochou (žádné SELL/— )", () => {
    const l = toRawListing(offer(), null, false);
    expect(l.title).toBe("Prodej bytu 3+1 · 71 m²");
    expect(l.rooms).toBe("3+1");
  });

  it("bez dispozice → jen typ a plocha", () => {
    const l = toRawListing(offer({ url: "https://www.realingo.cz/prodej/byt-ostatni-byty-praha-142-00/24640375" }), null, false);
    expect(l.title).toBe("Prodej bytu · 71 m²");
  });

  it("RENT + HOUSE → český prefix", () => {
    const l = toRawListing(offer({ purpose: "RENT", property: "HOUSE", url: "https://www.realingo.cz/najem/dum-4+1-beroun/1" }), null, false);
    expect(l.title).toBe("Pronájem domu 4+1 · 71 m²");
  });

  it("photo list i {url} objekty i stringy — obojí projde", () => {
    const l = toRawListing(
      offer({ photos: { main: { url: "https://cdn.realingo.cz/m.jpg" }, list: ["https://cdn.realingo.cz/1.jpg", { url: "https://cdn.realingo.cz/2.jpg" }] } as unknown as RealingoOffer["photos"] }),
      null,
      false
    );
    expect(l.imageUrls).toEqual([
      "https://cdn.realingo.cz/m.jpg",
      "https://cdn.realingo.cz/1.jpg",
      "https://cdn.realingo.cz/2.jpg",
    ]);
  });

  it("locked offer bez fotek → prázdné pole (ne crash)", () => {
    const l = toRawListing(offer({ photos: null }), null, true);
    expect(l.imageUrls).toEqual([]);
    expect(l.priceRating).toBeNull();
  });

  it("rating label putuje verbatim (shoda s Realingem)", () => {
    const l = toRawListing(offer(), statsOk, false);
    expect(l.priceRating).toBe("Velmi dobrá cena");
    expect(l.priceTier).toBe("1");
    expect(l.isEarlyOffer).toBe(false);
  });
});

describe("fetchAllRealingoOffers — paginace", () => {
  const cfg: RealingoSearchConfig = {
    address: "Praha",
    purpose: "SELL",
    property: "FLAT",
    buildingStatuses: [],
    sort: "NEWEST",
    first: 300,
  };

  beforeEach(() => {
    gqlMock.mockReset();
  });

  function searchResponse(items: RealingoOffer[]) {
    return { data: { searchOffer: { total: 250, lockedOffersCount: 0, items } } };
  }
  function statsResponse(ids: string[]) {
    return { data: { loadPriceStats: ids.map((id) => ({ offerId: id, status: "OK", error: null, stats: { tier: "1", label: "Velmi dobrá cena", iqrDeviation: 0, n: 10, lowConfidence: false, effectivePriceCzk: null, bands: [] } })) } };
  }
  const mk = (n: number, offset: number): RealingoOffer[] =>
    Array.from({ length: n }, (_, i) => offer({ id: `id${offset + i}`, url: `https://www.realingo.cz/prodej/byt-3+1-x${offset + i}/1` }));

  it("sbírá po stránkách až do totalu a skip roste", async () => {
    gqlMock.mockImplementation(async () => {
      const lastArgs = gqlMock.mock.calls[gqlMock.mock.calls.length - 1];
      const query = lastArgs[0] as string;
      if (query.includes("searchOffer")) {
        const vars = lastArgs[2] as { skip: number; first: number };
        const skip = vars.skip;
        const remaining = 250 - skip;
        const size = Math.min(remaining, REALINGO_PAGE_SIZE);
        const items = mk(size, skip);
        return searchResponse(items);
      }
      const ids = (lastArgs[2] as { ids: string[] }).ids;
      return statsResponse(ids);
    });

    const res = await fetchAllRealingoOffers(cfg, { maxItems: 300, timeBudgetMs: 60_000 });
    expect(res.items.length).toBe(250);
    expect(res.complete).toBe(true);
    expect(res.total).toBe(250);
    expect(res.stats.size).toBe(250);
    // skip postupně 0, 100, 200
    const skips = gqlMock.mock.calls
      .filter((c: unknown[]) => String(c[0]).includes("searchOffer"))
      .map((c: unknown[]) => (c[2] as { skip: number }).skip);
    expect(skips).toEqual([0, 100, 200]);
  });

  it("strop maxItems zastaví dříve než total", async () => {
    gqlMock.mockImplementation(async () => {
      const lastArgs = gqlMock.mock.calls[gqlMock.mock.calls.length - 1];
      if (String(lastArgs[0]).includes("searchOffer")) {
        const vars = lastArgs[2] as { skip: number; first: number };
        return searchResponse(mk(vars.first, vars.skip));
      }
      return statsResponse((lastArgs[2] as { ids: string[] }).ids);
    });
    const res = await fetchAllRealingoOffers(cfg, { maxItems: 150, timeBudgetMs: 60_000 });
    expect(res.items.length).toBe(150);
    expect(res.complete).toBe(false);
  });

  it("prázdná stránka = konec", async () => {
    gqlMock.mockImplementation(async () => {
      const lastArgs = gqlMock.mock.calls[gqlMock.mock.calls.length - 1];
      if (String(lastArgs[0]).includes("searchOffer")) return searchResponse([]);
      return statsResponse([]);
    });
    const res = await fetchAllRealingoOffers(cfg, { maxItems: 300 });
    expect(res.items).toEqual([]);
    expect(res.complete).toBe(true);
  });
});
