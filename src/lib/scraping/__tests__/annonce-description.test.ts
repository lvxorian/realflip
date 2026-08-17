import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../rate-limiter", () => ({
  RateLimiter: {
    getInstance: () => ({ wait: vi.fn(() => Promise.resolve()) }),
  },
}));

import { AnnonceAdapter } from "../adapters/annonce";

afterEach(() => {
  vi.restoreAllMocks();
});

// Detailní stránka annonce.cz podle aktuální struktury (2026):
// popis je v <span class="ad-detail-desc-container"> uvnitř <p class="ad-desc">,
// sekce „Popis" v <div class="padded">. Starý div.popisdetail už neexistuje.
const detailHtml = `<html><body>
  <div class="x w290">
    <div class="padded">
      <h2>Popis</h2>
      <div>
        <p class="ad-desc">
          <span class="ad-detail-desc-container">Nabízíme k prodeji světlý byt 2+kk s balkonem, kompletně zrekonstruovaný, ve 2. patře zatepleného domu v Praze.</span>
        </p>
      </div>
    </div>
  </div>
  <meta name="description" content="Inzerát v kategorii Byty na prodej: Prodej bytu 2+kk, Praha (TESTID)">
  <div id="contact-container" class="box shiny closed">
    <h2>Kontaktní informace</h2>
    <div class="mrg-top"><strong>Telefon:</strong> <a href="tel:+420777123456" class="phone-link" rel="nofollow">777&nbsp;123&nbsp;456</a></div>
  </div>
</body></html>`;

const listHtml = `<html><body>
  <div class="box q ext-item">
    <h2><a href="/inzerat/prodej-bytu-2-kk-praha-TESTID.html">Prodej bytu 2+kk, Praha</a></h2>
    <strong class="mini-sticker"><span>5 970 000 Kč</span></strong>
    <table class="attrs">
      <tr><th>Dispozice</th><td><a>2+kk</a></td></tr>
      <tr><th>Plocha</th><td>53 m²</td></tr>
    </table>
    <p class="ad-desc"><a>Krátký popis ze seznamu.</a></p>
    <a class="thumbnail"><img src="/foto/thumb1.jpg"></a>
    <div class="ad-date">17. 8. 2026</div>
  </div>
</body></html>`;

describe("AnnonceAdapter — popis z detailní stránky", () => {
  it("použije aktuální selektor popisu (ad-detail-desc-container) místo boilerplate meta description", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const u = String(input);
      const body = u.includes("/inzerat/") ? detailHtml : listHtml;
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve(body),
      } as unknown as Response;
    });

    const adapter = new AnnonceAdapter(1);
    const listings = await adapter.crawlListings();

    expect(listings).toHaveLength(1);
    // Plný popis z detailu, ne boilerplate „Inzerát v kategorii…"
    expect(listings[0].description).toContain("světlý byt 2+kk s balkonem");
    expect(listings[0].description).not.toContain("Inzerát v kategorii");
  });

  it("když detail nemá žádný popisový kontejner, neuloží meta description (boilerplate)", async () => {
    const brokenDetail = `<html><body>
      <div class="x w290"><div class="padded"><h2>Popis</h2><div><p>Prázdno.</p></div></div></div>
      <meta name="description" content="Inzerát v kategorii Byty na prodej: Prodej bytu 2+kk, Praha (TESTID)">
    </body></html>`;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const u = String(input);
      const body = u.includes("/inzerat/") ? brokenDetail : listHtml;
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve(body),
      } as unknown as Response;
    });

    const adapter = new AnnonceAdapter(1);
    const listings = await adapter.crawlListings();

    expect(listings).toHaveLength(1);
    // Zůstane popis ze seznamu (krátký náhled) — žádný boilerplate z meta
    expect(listings[0].description).not.toContain("Inzerát v kategorii");
  });
});
