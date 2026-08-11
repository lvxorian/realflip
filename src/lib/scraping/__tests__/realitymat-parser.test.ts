import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../rate-limiter", () => ({
  RateLimiter: {
    getInstance: () => ({ wait: vi.fn(() => Promise.resolve()) }),
  },
}));

import { parseRealityMatDetail } from "../realitymat-parser";
import { RealityMatAdapter } from "../adapters/realitymat";

/**
 * HTML věrně podle živé stránky https://www.realitymat.cz/detail/2244756/...
 * (načteno 11. 8. 2026): h1 s "(ID: …)", cena v span.h2, adresa s
 * fa-map-marker-alt, parametry #detail-information row.mb-2, popis, carousel
 * a kontakt (makléř + #seller-modal).
 */
function detailHtml(
  overrides: {
    title?: string;
    address?: string;
    price?: string;
    priceBlock?: boolean;
    params?: [string, string][];
    description?: string;
    withH1?: boolean;
  } = {}
): string {
  const title =
    overrides.title ??
    "Prodej bytu 3+1, Kašperské Hory, Vimperská, 72 m2 (ID: 2244756)";
  const address = overrides.address ?? "Vimperská, Kašperské Hory";
  const price = overrides.price ?? "4\u00a0650\u00a0000\u00a0Kč";
  const params = overrides.params ?? [
    ["Cena", `${price} /za nemovitost Spočítat hypotéku`],
    ["Aktualizováno", "11. 8. 2026"],
    ["Adresa", address],
    ["Stavba", "Cihlová"],
    ["Stav objektu", "Velmi dobrý"],
    ["Patro", "2."],
    ["Vlastnictví", "Osobní"],
    ["Užitná plocha", "72 m2"],
  ];
  const description =
    overrides.description ??
    "Nabízím k prodeji útulný byt o dispozici 3+1 a užitné ploše 72 m², nacházející se ve 2. patře menšího cihlového domu v Kašperských Horách.";

  return `<html><head>
    <meta property="og:title" content="Prodej bytu 3+1, Kašperské Hory (ID: 2244756)" />
    <meta property="og:description" content="Prodej bytu v Kašperských Horách" />
  </head><body>
    ${overrides.withH1 === false ? "" : `<h1>${title}</h1>`}
    <p class="text-muted mb-2"><i class="fas fa-map-marker-alt"></i> ${address}</p>
    ${
      overrides.priceBlock === false
        ? ""
        : `<div class="d-inline-block mb-2"><span class="h2">${price}</span></div>`
    }
    <div id="detail-information">
      ${params
        .map(
          ([k, v]) =>
            `<div class="row mb-2">
              <div class="col font-weight-bolder">${k}</div>
              <div class="col"><span>${v}</span></div>
            </div>`
        )
        .join("\n      ")}
    </div>
    <div class="col-lg-6 text-justify"><p class="text-break">${description}</p></div>
    <div id="carousel-photo">
      <div class="carousel-item"><img data-src="https://img4.realitymat.cz/resize/832x468/4347623/82643090.webp" /></div>
      <div class="carousel-item"><img data-src="https://img4.realitymat.cz/resize/832x468/4347623/82643091.webp" /></div>
      <div class="carousel-item"><img data-src="https://img2.realitymat.cz/resize/832x468/4347623/82643092.webp" /></div>
    </div>
    <a href="/realitni-makleri/denisa-winterova">Bc. Denisa Winterová</a>
    <div id="seller-modal">
      <p>Kontaktovat makléře</p>
      <div class="media-body"><p>Bc. Denisa Winterová</p></div>
      <p>+420 734 134 826</p>
      <a href="mailto:denisa@example.cz">denisa@example.cz</a>
    </div>
  </body></html>`;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseRealityMatDetail", () => {
  it("parse detail — cena, adresa, parametry, plocha, kontakt, fotky", () => {
    const listing = parseRealityMatDetail(
      detailHtml(),
      "https://www.realitymat.cz/detail/2244756/prodej-bytu-3-1-kasperske-hory-vimperska-72m2"
    );

    expect(listing.portalName).toBe("realitymat");
    expect(listing.title).toBe("Prodej bytu 3+1, Kašperské Hory, Vimperská, 72 m2 (ID: 2244756)");
    expect(listing.price).toBe(4650000);
    expect(listing.pricePerSqm).toBe(Math.round(4650000 / 72));
    expect(listing.address).toBe("Vimperská, Kašperské Hory");
    expect(listing.area).toBe(72);
    expect(listing.usableArea).toBe(72);
    expect(listing.rooms).toBe("3+1");
    expect(listing.floor).toBe(2);
    expect(listing.condition).toBe("good"); // "Velmi dobrý"
    expect(listing.buildingType).toBe("brick"); // "Cihlová"
    expect(listing.description).toContain("cihlového domu");
    expect(listing.imageUrls).toEqual([
      "https://img4.realitymat.cz/resize/832x468/4347623/82643090.webp",
      "https://img4.realitymat.cz/resize/832x468/4347623/82643091.webp",
      "https://img2.realitymat.cz/resize/832x468/4347623/82643092.webp",
    ]);
    expect(listing.contactName).toBe("Bc. Denisa Winterová");
    expect(listing.contactPhone).toBe("+420734134826");
    expect(listing.contactEmail).toBe("denisa@example.cz");
  });

  it("cena fallback z prvního řádku #detail-information, když chybí span.h2", () => {
    const listing = parseRealityMatDetail(
      detailHtml({ priceBlock: false }),
      "https://www.realitymat.cz/detail/x.html"
    );
    expect(listing.price).toBe(4650000);
  });

  it("plocha fallback z titulku h1, když chybí parametr plochy", () => {
    const html = detailHtml({
      params: [
        ["Cena", "4 650 000 Kč"],
        ["Stavba", "Cihlová"],
      ],
    });
    const listing = parseRealityMatDetail(html, "https://www.realitymat.cz/detail/x.html");
    expect(listing.area).toBe(72);
    expect(listing.usableArea).toBeNull();
    expect(listing.pricePerSqm).toBe(Math.round(4650000 / 72));
  });

  it("Cena na vyžádání → price 0 a pricePerSqm null", () => {
    const listing = parseRealityMatDetail(
      detailHtml({ price: "Cena na vyžádání" }),
      "https://www.realitymat.cz/detail/brezova-olesko/prodej-rd-385.html"
    );
    expect(listing.price).toBe(0);
    expect(listing.pricePerSqm).toBeNull();
  });

  it("title fallback na og:title, když chybí h1", () => {
    const listing = parseRealityMatDetail(
      detailHtml({ withH1: false }),
      "https://www.realitymat.cz/detail/x.html"
    );
    expect(listing.title).toBe("Prodej bytu 3+1, Kašperské Hory (ID: 2244756)");
  });

  it("stav objektu fallback z popisu, když chybí parametr", () => {
    const html = detailHtml({
      params: [
        ["Cena", "4 650 000 Kč"],
        ["Užitná plocha", "72 m2"],
      ],
      description: "Byt po kompletní rekonstrukci s novou kuchyní.",
    });
    const listing = parseRealityMatDetail(html, "https://www.realitymat.cz/detail/x.html");
    expect(listing.condition).toBe("renovated");
  });

  it("detail bez #seller-modal → kontakt jen z odkazu makléře, bez crash", () => {
    const html =
      detailHtml().split('<div id="seller-modal">')[0] + "</body></html>";
    const listing = parseRealityMatDetail(html, "https://www.realitymat.cz/detail/x.html");
    expect(listing.contactName).toBe("Bc. Denisa Winterová"); // z a[href^='/realitni-makleri/']
    expect(listing.contactPhone).toBeNull();
    expect(listing.contactEmail).toBeNull();
    expect(listing.price).toBe(4650000);
    expect(listing.area).toBe(72);
  });

  it("mapování staveb a stavů (panelová → panel, po rekonstrukci → renovated)", () => {
    const html = detailHtml({
      params: [
        ["Cena", "4 650 000 Kč"],
        ["Stavba", "Panelová"],
        ["Stav objektu", "Po rekonstrukci"],
        ["Užitná plocha", "72 m2"],
      ],
    });
    const listing = parseRealityMatDetail(html, "https://www.realitymat.cz/detail/x.html");
    expect(listing.buildingType).toBe("panel");
    expect(listing.condition).toBe("renovated");
  });
});

describe("RealityMatAdapter", () => {
  // Karta věrně podle živé search stránky https://www.realitymat.cz/prodej/byty
  // (načteno 11. 8. 2026): div.mb-4[data-key], a.stretched-link, div.lead.
  const card = (
    overrides: {
      title?: string;
      price?: string;
      address?: string;
      href?: string;
      isRental?: boolean;
    } = {}
  ): string => {
    const title = overrides.title ?? "Prodej bytu 3+1, Kašperské Hory, Vimperská, 72 m2";
    const price = overrides.price ?? "4&nbsp;650&nbsp;000&nbsp;Kč";
    const address = overrides.address ?? "Vimperská, Kašperské Hory";
    const href = overrides.href ?? "/detail/2244756/prodej-bytu-3-1-kasperske-hory-vimperska-72m2";
    const suffix = overrides.isRental
      ? '<small class="text-muted">/za měsíc</small>'
      : '<small class="text-muted">/za nemovitost</small>';
    return `<div class="mb-4" data-key="2244756"><div class="card shadow-sm">
      <div class="row no-gutters position-relative">
        <div class="col-md-3">
          <img class="card-img img-fluid" src="https://img4.realitymat.cz/crop/212x159/4347623/82643090.webp" alt="${title}" loading="lazy" />
        </div>
        <div class="col-md-9 position-static">
          <div class="card-body p-3">
            <h2 class="h4">
              <a class="stretched-link" title="${title}" href="${href}">${title}</a>
            </h2>
            <p>${address}</p>
            <div class="lead font-weight-bold mt-auto">${price}${suffix}</div>
          </div>
        </div>
      </div>
    </div></div>`;
  };

  it("parse karet, vynechá pronájmy, enrich z detailu", async () => {
    const page1 = `<html><body><div id="w1">
      ${card()}
      ${card({
        title: "Prodej bytu 1+1, Hluboká nad Vltavou, Nerudova, 33 m2",
        href: "/detail/2244756/prodej-bytu-1-1-hluboka-nad-vltavou-33m2",
      })}
      ${card({
        title: "Pronájem bytu 2+1, Praha, 60 m2",
        price: "15&nbsp;000&nbsp;Kč",
        href: "/detail/2244756/pronajem-bytu-2-1-praha-60m2",
        isRental: true,
      })}
    </div></body></html>`;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const u = String(input);
      let body = page1;
      if (u.includes("?page=")) body = "";
      if (u.includes("/detail/")) {
        body = detailHtml({
          title: u.includes("hluboka")
            ? "Prodej bytu 1+1, Hluboká nad Vltavou, Nerudova, 33 m2 (ID: 2244756)"
            : "Prodej bytu 3+1, Kašperské Hory, Vimperská, 72 m2 (ID: 2244756)",
        });
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve(body),
      } as unknown as Response;
    });

    const adapter = new RealityMatAdapter();
    const listings = await adapter.crawlListings();

    // Pronájem se vynechá — zůstanou 2 prodeje.
    expect(listings).toHaveLength(2);
    expect(listings[0].portalName).toBe("realitymat");
    expect(listings[0].title).toBe("Prodej bytu 3+1, Kašperské Hory, Vimperská, 72 m2 (ID: 2244756)");
    expect(listings[0].price).toBe(4650000);
    expect(listings[0].area).toBe(72);
    expect(listings[0].rooms).toBe("3+1");
    expect(listings[0].address).toBe("Vimperská, Kašperské Hory");
    expect(listings[1].title).toBe("Prodej bytu 1+1, Hluboká nad Vltavou, Nerudova, 33 m2 (ID: 2244756)");
  });

  it("extractContact z detail stránky", () => {
    const contact = new RealityMatAdapter().extractContact(detailHtml());
    expect(contact.name).toBe("Bc. Denisa Winterová");
    expect(contact.phone).toBe("+420734134826");
    expect(contact.email).toBe("denisa@example.cz");
  });
});
