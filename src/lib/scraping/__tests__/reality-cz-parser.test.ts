import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../rate-limiter", () => ({
  RateLimiter: {
    getInstance: () => ({ wait: vi.fn(() => Promise.resolve()) }),
  },
}));

import { RealityCzAdapter } from "../adapters/reality-cz";
import { parseCzkPrice } from "../types";

// Seznamová stránka reality.cz — ceny s tečkou jako oddělovačem tisíců,
// odkaz na detail ve formátu „L00-006956/?c=…".
const listHtml = `<html><body>
  <div id="idl00006956" class="xvypis vypismd ui-corner-all gpsx49.471019 gpsy17.089156">
    <div class="thumbnail"><a href="L00-006956/?c=1_48902557"><img src="/thumb/1786705596/l00006956_0.jpg" alt=""></a></div>
    <div class="obaltextu">
      <p class="vypisnaz"><a href="L00-006956/?c=1_48902557">Belgická, Prostějov</a></p>
      <p class="lokalita mb10">byt 2+1, 44 m², panel, osobní</p>
      <p class="vypiscena"><span class=""><strong>4.390.000 Kč</strong></span></p>
    </div>
  </div>
  <div id="idl00006957" class="xvypis vypismd ui-corner-all">
    <div class="thumbnail"><a href="L00-006957/"><img src="/thumb/1786705597/l00006957_0.jpg" alt=""></a></div>
    <div class="obaltextu">
      <p class="vypisnaz"><a href="L00-006957/">Míšovická, Praha Zličín</a></p>
      <p class="lokalita mb10">byt 3+kk, 78 m², cihlová, osobní</p>
      <p class="vypiscena"><span class=""><strong>6 490 000 Kč</strong></span></p>
    </div>
  </div>
</body></html>`;

function detailHtml(title: string, price: string): string {
  return `<html><body>
  <h2 id="znazev">${title}</h2>
  <span class="detcena">${price}</span>
  <div id="popis"><div class="pr10">Prosluněný byt po kompletní rekonstrukci – ${title}. Nabízíme světlý byt ve 2. patře zatepleného domu.</div></div>
  <table class="detailbytu">
    <tr><th>Velikost</th><td>2+1</td></tr>
    <tr><th>Užitná plocha</th><td>44 m²</td></tr>
    <tr><th>Podlaží</th><td>2.</td></tr>
  </table>
  <div id="galerie"><a href="/photo/1.jpg"></a><a href="/photo/2.jpg"></a></div>
</body></html>`;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseCzkPrice — české ceny s tečkami tisíců", () => {
  it("převede tečky tisíců (4.390.000 → 4390000)", () => {
    expect(parseCzkPrice("4.390.000 Kč")).toBe(4390000);
    expect(parseCzkPrice("4.390.000")).toBe(4390000);
  });

  it("zpracuje mezery, nestandardní znaky i bez měny", () => {
    expect(parseCzkPrice("6 490 000 Kč")).toBe(6490000);
    expect(parseCzkPrice("6490000")).toBe(6490000);
    expect(parseCzkPrice("5\u00a0750\u00a0000")).toBe(5750000);
  });

  it("desetinnou tečku nerozbije a neplatné vrátí 0", () => {
    expect(parseCzkPrice("abc")).toBe(0);
    expect(parseCzkPrice("")).toBe(0);
  });
});

describe("RealityCzAdapter", () => {
  it("parsuje ceny s tečkami tisíců a staví správné URL detailu (L00-…)", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const u = String(input);
      let body = listHtml;
      if (u.includes("/L00-006956")) body = detailHtml("Belgická, Prostějov", "4.390.000 Kč");
      else if (u.includes("/L00-006957")) body = detailHtml("Míšovická, Praha Zličín", "6 490 000 Kč");
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve(body),
      } as unknown as Response;
    });

    const adapter = new RealityCzAdapter(1);
    const listings = await adapter.crawlListings();

    expect(listings).toHaveLength(2);
    expect(listings[0].price).toBe(4390000);
    expect(listings[1].price).toBe(6490000);
    // URL detailu z href odkazu (velká písmena L00-…)
    expect(listings[0].url).toBe("https://www.reality.cz/L00-006956/?c=1_48902557");
    // Popis z detailní stránky
    expect(listings[0].description).toContain("kompletní rekonstrukci");
    expect(listings[0].imageUrls.length).toBeGreaterThan(0);
  });
});
