import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../rate-limiter", () => ({
  RateLimiter: {
    getInstance: () => ({ wait: vi.fn(() => Promise.resolve()) }),
  },
}));

import { RemaxAdapter } from "../adapters/remax";

function cardHtml(overrides: Record<string, string> = {}): string {
  const attrs = {
    "data-title": "Prodej bytu 3+kk v osobním vlastnictví 91 m², Frymburk",
    "data-url": "/reality/detail/445375/prodej-bytu-3-kk-v-osobnim-vlastnictvi-91-m2-frymburk",
    "data-price": "5\u00a0750\u00a0000\u00a0Kč (za nemovitost)",
    "data-display-address": "Frymburk, Jihočeský kraj",
    "data-gps": "50°01&#039;37.3&quot;N,13°51&#039;60&quot;E",
    "data-img": "https://mlsf.remax-czech.cz/data/zs/445375/3387970_th350.jpg",
    ...overrides,
  };
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
  return `<div class="pl-items__item" ${attrStr}><a class="pl-items__link" href="${attrs["data-url"]}"><div class="pl-items__images"><img data-src="${attrs["data-img"]}" /></div></a></div>`;
}

const html = `<html><body>
${cardHtml()}
${cardHtml({ "data-title": "Prodej domu 112 m², Pardubice", "data-url": "/reality/detail/445366/prodej-domu-112-m2-pardubice" })}
${cardHtml({ "data-title": "Prodej pozemku 4139 m², Ploskovice", "data-url": "/reality/detail/445309/prodej-pozemku-4139-m2-ploskovice" })}
</body></html>`;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RemaxAdapter", () => {
  it("parse kartičky na RawListing (jen byty), DMS GPS → decimální", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const u = String(input);
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve(u.includes("stranka=2") ? "" : html),
      } as unknown as Response;
    });

    const adapter = new RemaxAdapter(2);
    const listings = await adapter.crawlListings();

    // 1 byt + stránka 2 prázdná → jen byt, ne dům/pozemek
    expect(listings).toHaveLength(1);
    const l = listings[0];
    expect(l.portalName).toBe("remax");
    expect(l.title).toContain("3+kk");
    expect(l.price).toBe(5750000);
    expect(l.area).toBe(91);
    expect(l.rooms).toBe("3+kk");
    expect(l.pricePerSqm).toBe(Math.round(5750000 / 91));
    expect(l.url).toBe("https://www.remax-czech.cz/reality/detail/445375/prodej-bytu-3-kk-v-osobnim-vlastnictvi-91-m2-frymburk");
    // 50°01'37.3"N → 50.0270
    expect(l.lat).toBeCloseTo(50.0270, 3);
    expect(l.imageUrls).toHaveLength(1);
  });

  it("přeskočí kartičky bez ceny / ne-bytů", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => ({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          `<html><body>
            ${cardHtml({ "data-price": "", "data-url": "/reality/detail/1/x" })}
            ${cardHtml({ "data-title": "Prodej ubytovacího zařízení 750 m², X", "data-url": "/reality/detail/2/y" })}
          </body></html>`
        ),
    }) as unknown as Promise<Response>);

    const adapter = new RemaxAdapter(1);
    const listings = await adapter.crawlListings();
    expect(listings).toHaveLength(0);
  });
});
