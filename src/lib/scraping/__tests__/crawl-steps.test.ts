import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../rate-limiter", () => ({
  RateLimiter: {
    getInstance: () => ({ wait: vi.fn(() => Promise.resolve()) }),
  },
}));

import { PortalAdapter, CrawlStep } from "../adapters/base";
import { RawListing } from "../types";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      ({
        ok: true,
        status: 200,
        text: () => Promise.resolve("<html></html>"),
      }) as unknown as Response
    )
  );
});

/**
 * Jednoduchý adaptér pro testování krokování (forPages + enrichBatch s ctx).
 * fetch je mockovaný — testujeme jen řízení kroků a deadline.
 */
class TestAdapter extends PortalAdapter {
  constructor() {
    super("bazos");
  }

  async crawlListings(
    _filters?: never,
    ctx?: CrawlStep,
    enrich: (l: RawListing) => Promise<RawListing> = (l) => Promise.resolve(l),
  ): Promise<RawListing[]> {
    const all: RawListing[] = [];
    await this.forPages(ctx, 5, async (page) => {
      await this.fetch(`https://bazos.cz/page/${page}`);
      all.push({
        portalName: "bazos",
        url: `https://bazos.cz/item/${page}`,
        title: `Item ${page}`,
        price: 1000000,
        pricePerSqm: 20000,
        area: 50,
        rooms: null,
        floor: null,
        condition: null,
        buildingType: null,
        yearBuilt: null,
        address: null,
        lat: null,
        lng: null,
        contactPhone: null,
        contactName: null,
        contactEmail: null,
        description: null,
        imageUrls: [],
        publishedAt: Date.now(),
        updatedAt: Date.now(),
      });
      return 1;
    });
    return this.enrichBatch(all, enrich, 2, ctx);
  }

  extractContact() {
    return { phone: null, name: null, email: null };
  }
}

describe("PortalAdapter — krokový crawl (forPages + enrichBatch s ctx)", () => {
  it("bez ctx proleze všechny stránky a nic nehlásí", async () => {
    const adapter = new TestAdapter();
    const listings = await adapter.crawlListings();
    expect(listings).toHaveLength(5);
  });

  it("s ctx přeskočí dokončené stránky (startStep) a hlásí kroky", async () => {
    const adapter = new TestAdapter();
    const done: number[] = [];
    const ctx: CrawlStep = {
      startStep: 2, // stránky 1–2 už proběhly v předchozím běhu
      deadlineMs: Date.now() + 60000,
      completed: true,
      onStepDone: (s) => done.push(s),
    };
    const listings = await adapter.crawlListings(undefined, ctx);

    // Přeskočily se stránky 1 a 2 → zbyly 3, 4, 5.
    expect(listings.map((l) => l.url)).toEqual([
      "https://bazos.cz/item/3",
      "https://bazos.cz/item/4",
      "https://bazos.cz/item/5",
    ]);
    // Hlášené kroky odpovídají skutečně proběhlým stránkám.
    expect(done).toEqual([2, 3, 4]);
    expect(ctx.completed).toBe(true);
  });

  it("vypršený deadline zastaví stránky i dávky a označí běh jako neúplný", async () => {
    const adapter = new TestAdapter();
    const ctx: CrawlStep = {
      startStep: 0,
      deadlineMs: Date.now(), // už vypršel
      completed: true,
      onStepDone: () => {},
    };
    const listings = await adapter.crawlListings(undefined, ctx);
    expect(listings).toHaveLength(0);
    expect(ctx.completed).toBe(false);
  });

  it("deadline uprostřed stránkování přeruší běh a hlásí dosavadní kroky", async () => {
    const adapter = new TestAdapter();
    const done: number[] = [];
    const ctx: CrawlStep = {
      startStep: 0,
      deadlineMs: null,
      completed: true,
      onStepDone: (s) => done.push(s),
    };
    // Simulace: stránka 3 nastaví deadline do minulosti (jako by běh trval dlouho).
    const originalFetch = adapter["fetch"].bind(adapter);
    adapter["fetch"] = (async (url: string) => {
      if (url.includes("page/3")) ctx.deadlineMs = Date.now() - 1;
      return originalFetch(url);
    }) as typeof adapter["fetch"];

    const listings = await adapter.crawlListings(undefined, ctx);

    // Stránky 1–3 proběhly, stránka 4 už ne (deadline). Nacrawlené list
    // inzeráty se nezahodí — vrátí se bez detail fetchů (enrichBatch cut).
    expect(listings.map((l) => l.url)).toEqual([
      "https://bazos.cz/item/1",
      "https://bazos.cz/item/2",
      "https://bazos.cz/item/3",
    ]);
    expect(done).toEqual([0, 1, 2]);
    expect(ctx.completed).toBe(false);
  });

  it("známé URL z DB se v enrichBatch přeskočí (skipDetailForUrls)", async () => {
    const adapter = new TestAdapter();
    adapter.skipDetailForUrls = new Set(["https://bazos.cz/item/3"]);
    const enrich = vi.fn(async (l: RawListing) => l);
    const listings = await adapter.crawlListings(undefined, undefined, enrich);

    // Item 3 se neenrichoval (známý z DB) — enrich voláno jen pro 1, 2, 4, 5.
    const enrichedUrls = enrich.mock.calls.map((c) => (c[0] as RawListing).url);
    expect(enrichedUrls).not.toContain("https://bazos.cz/item/3");
    expect(enrichedUrls).toHaveLength(4);
    expect(listings).toHaveLength(5);
  });
});