import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../rate-limiter", () => ({
  RateLimiter: {
    getInstance: () => ({ wait: vi.fn(() => Promise.resolve()) }),
  },
}));

import { parseRealityMixDetail } from "../realitymix-parser";
import { RealityMixAdapter } from "../adapters/realitymix";

function detailHtml(overrides: {
  price?: string;
  title?: string;
  address?: string;
  params?: [string, string][];
  withGps?: boolean;
} = {}): string {
  const price = overrides.price ?? "4\u00a0789\u00a0781\u00a0Kč";
  const title = overrides.title ?? "Prodej bytu, 2+kk, 50,62 m²";
  const address = overrides.address ?? " 9. května, Blansko ";
  const params = overrides.params ?? [
    ["Dispozice bytu", "2+kk"],
    ["Číslo podlaží v domě", "1"],
    ["Celková podlahová plocha", "50.62 m²"],
    ["Stav objektu", "velmi dobrý"],
    ["Druh objektu", "cihlová"],
  ];
  const gps = overrides.withGps === false ? "" : `data-gps-lon="16.653283333333" data-gps-lat="49.357794444444"`;

  return `<html><head><meta property="og:description" content="Prodej bytu v Blansku" /></head><body>
  <div class="advert-detail-heading">
    <h1 class="advert-detail-heading__title">${title}</h1>
    <p class="advert-detail-heading__address">${address}</p>
    <div class="advert-detail-heading__price">
      <span class="advert-detail-heading__price-value">${price}</span>
    </div>
  </div>
  <ul class="detail-information__data">
    ${params
      .map(
        ([k, v]) =>
          `<li class="detail-information__data-item"><span>${k}:</span><span>${v}</span></li>`
      )
      .join("")}
  </ul>
  <div class="advert-description__text"><div class="advert-description__text-inner">Pěkný byt v Blansku, cihla.</div></div>
  <div class="gallery__main-img"><a class="gallery__main-img-inner" data-gallery data-src="https://st.realitymix.cz/i/66674185/8611583/nab_491615925.jpg"></a></div>
  <div id="print-map" data-address="${address.trim()}" ${gps}></div>
  <div class="offer-detail-sidebar__agent">
    <p><a class="text-secondary" href="/profil-realitniho-maklere/zakaznicka-linka-1821786">Zákaznická Linka</a></p>
    <div class="offer-detail-sidebar__agent-show-info">
      <p><a rel="nofollow" href="/trackredir/8619648/call/detail">800 100 164</a></p>
      <p><a href="mailto:realityspolu@bcas.cz">realityspolu@bcas.cz</a></p>
    </div>
  </div>
</body></html>`;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseRealityMixDetail", () => {
  it("parse detail — cena, lokalita, parametry, kontakt, GPS", () => {
    const listing = parseRealityMixDetail(detailHtml(), "https://realitymix.cz/detail/blansko/prodej-byt-id-2561583.html");

    expect(listing.portalName).toBe("realitymix");
    expect(listing.title).toBe("Prodej bytu, 2+kk, 50,62 m²");
    expect(listing.price).toBe(4789781);
    expect(listing.address).toBe("9. května, Blansko");
    expect(listing.rooms).toBe("2+kk");
    expect(listing.area).toBe(50.62);
    expect(listing.floorArea).toBe(50.62);
    expect(listing.floor).toBe(1);
    expect(listing.condition).toBe("good");
    expect(listing.buildingType).toBe("brick");
    expect(listing.lat).toBeCloseTo(49.357794444444);
    expect(listing.lng).toBeCloseTo(16.653283333333);
    expect(listing.imageUrls).toEqual([
      "https://st.realitymix.cz/i/66674185/8611583/nab_491615925.jpg",
    ]);
    expect(listing.description).toContain("Pěkný byt v Blansku");
  });

  it("užitná plocha jako fallback pro area", () => {
    const html = detailHtml({
      title: "Prodej bytu, 3+kk, 72,4 m²",
      params: [
        ["Dispozice bytu", "3+kk"],
        ["Užitná plocha", "72.4 m²"],
        ["Stav objektu", "po rekonstrukci"],
      ],
    });
    const listing = parseRealityMixDetail(html, "https://realitymix.cz/detail/x.html");
    expect(listing.area).toBe(72.4);
    expect(listing.usableArea).toBe(72.4);
    expect(listing.rooms).toBe("3+kk");
    expect(listing.condition).toBe("renovated");
  });

  it("Cena na vyžádání → price 0", () => {
    const listing = parseRealityMixDetail(
      detailHtml({ price: "Cena na vyžádání" }),
      "https://realitymix.cz/detail/brezova-olesko/prodej-rd-385.html"
    );
    expect(listing.price).toBe(0);
    expect(listing.pricePerSqm).toBeNull();
  });

  it("prázdné GPS souřadnice i parametry → null / area z titulku", () => {
    const html = detailHtml({ withGps: false, params: [] });
    const listing = parseRealityMixDetail(html, "https://realitymix.cz/detail/x/prodej-bytu-485.html");
    expect(listing.lat).toBeNull();
    expect(listing.lng).toBeNull();
    expect(listing.area).toBe(50.62);
  });

  it("kontakt — tel, e-mail a jméno makléře", () => {
    const listing = parseRealityMixDetail(detailHtml(), "https://realitymix.cz/detail/blansko/x-164.html");
    expect(listing.contactName).toBe("Zákaznická Linka");
    expect(listing.contactEmail).toBe("realityspolu@bcas.cz");
    expect(listing.contactPhone).toBe("800100164");
  });
});

describe("RealityMixAdapter", () => {
  const searchHtml = (cards: string[]) => `<html><head><link rel="next" href="https://realitymix.cz/reality/byty/prodej?stranka=2" /></head><body>
    <ul data-list-container>${cards.join("")}</ul>
  </body></html>`;

  const card = (overrides: { title?: string; price?: string; priceSuffix?: string; href?: string } = {}) => {
    const title = overrides.title ?? "Prodej bytu, 2+kk, 50,62 m²";
    const price = overrides.price ?? "4\u00a0789\u00a0781\u00a0Kč";
    const href = overrides.href ?? "https://realitymix.cz/detail/blansko/prodej-bytu-25815634.html";
    return `<li class="w-full advert-item">
      <div class="advert-item__content">
        <div class="advert-item__content-carousel-wrapper">
          <div class="swiper h-full"><div class="swiper-wrapper">
            <div class="swiper-slide aspect-[320/230]">
              <a href="${href}" class="absolute inset-0 w-full h-full">
                <img class="absolute inset-0 w-full h-full object-cover" loading="lazy" src="https://st.realitymix.cz/i/66674185/8611583/nab_491615925_detail.jpg" alt="${title}" />
              </a>
            </div>
          </div></div>
        </div>
        <div class="advert-item__content-data">
          <div class="mb-3">
            <h2 class="text-lg sm:text-xl font-extrabold"><a href="${href}" class="flex text-secondary items-center mb-1 hover:underline"><span>${title}</span></a></h2>
            <p class="text-sm sm:text-base text-body-light"> 9. května, Blansko </p>
          </div>
          <div class="text-xl font-extrabold mb-2.5"><span>${price}</span>${overrides.priceSuffix ?? ""}</div>
        </div>
      </div>
    </li>`;
  };

  it("parse karty, vynechá pronájmy, zastaví se na prázdné stránce", async () => {
    const page1 = searchHtml([
      card(),
      card({ title: "Prodej bytu, 1+kk, 39 m²", href: "https://realitymix.cz/detail/decin/x-542.html" }),
      card({
        title: "Pronájem bytu, 1+1, 70 m²",
        price: "15\u00a0000\u00a0Kč",
        priceSuffix: '<span class="text-xs text-body-light">(za měsíc)</span>',
        href: "https://realitymix.cz/detail/decin/pronajem-bytu-87.html",
      }),
    ]);

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const u = String(input);
      let body = page1;
      if (u.includes("stranka=")) body = "";
      if (u.includes("/detail/")) {
        body = detailHtml(
          u.includes("542")
            ? { title: "Prodej bytu, 1+kk, 39 m²" }
            : {}
        );
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve(body),
      } as unknown as Response;
    });

    const adapter = new RealityMixAdapter();
    const listings = await adapter.crawlListings();

    expect(listings).toHaveLength(2);
    expect(listings[0].portalName).toBe("realitymix");
    expect(listings[0].title).toBe("Prodej bytu, 2+kk, 50,62 m²");
    expect(listings[0].price).toBe(4789781);
    expect(listings[0].rooms).toBe("2+kk");
    expect(listings[0].area).toBe(50.62);
    expect(listings[0].address).toBe("9. května, Blansko");
    expect(listings[0].imageUrls).toEqual([
      "https://st.realitymix.cz/i/66674185/8611583/nab_491615925.jpg",
    ]);
    expect(listings[1].title).toBe("Prodej bytu, 1+kk, 39 m²");
    expect(listings[1].price).toBe(4789781);
  });

  it("extractContact z detail stránky", () => {
    const contact = new RealityMixAdapter().extractContact(detailHtml());
    expect(contact.name).toBe("Zákaznická Linka");
    expect(contact.phone).toBe("800100164");
    expect(contact.email).toBe("realityspolu@bcas.cz");
  });
});
