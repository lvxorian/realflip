import { describe, it, expect } from "vitest";
import { detectPropertyType, matchFilters, isCzechListing, isSaleListing } from "../filters";
import type { RawListing } from "../types";

const baseListing: RawListing = {
  portalName: "sreality",
  url: "https://www.sreality.cz/detail/prodej/byt/3+1/praha-vinohrady/1234",
  title: "Prodej bytu 3+1, Praha Vinohrady",
  price: 5_500_000,
  pricePerSqm: 78_000,
  area: 70,
  rooms: "3+1",
  floor: 3,
  condition: "good",
  buildingType: "brick",
  yearBuilt: 1950,
  address: "Vinohradská 42, Praha 2 - Vinohrady",
  lat: null,
  lng: null,
  contactPhone: null,
  contactName: null,
  contactEmail: null,
  description: null,
  imageUrls: [],
  publishedAt: Date.now(),
  updatedAt: Date.now(),
};

function listing(overrides: Partial<RawListing> = {}): RawListing {
  return { ...baseListing, ...overrides };
}

describe("detectPropertyType", () => {
  it("rozpozná byt z titulku", () => {
    expect(detectPropertyType("Prodej bytu 2+kk, Brno")).toBe("flat");
    expect(detectPropertyType("Garsonka Praha 8")).toBe("flat");
  });

  it("rozpozná dům (bytový dům se nepřeklopí na byt)", () => {
    expect(detectPropertyType("Prodej rodinného domu 4+1, Kladno")).toBe("house");
    expect(detectPropertyType("Prodej bytového domu, Ostrava")).toBe("house");
  });

  it("rozpozná pozemek, garáž a komerci", () => {
    expect(detectPropertyType("Prodej stavebního pozemku 800 m2")).toBe("land");
    expect(detectPropertyType("Prodej garáže Praha 6")).toBe("garage");
    expect(detectPropertyType("Prodej kanceláře 120 m2")).toBe("commercial");
    expect(detectPropertyType("Prodej skladu, Pardubice")).toBe("commercial");
  });

  it("rozpozná byt z dispozice v titulku", () => {
    expect(detectPropertyType("Prodej 2+kk, Liberec")).toBe("flat");
  });

  it("byt má precedenci i s domem/zahradou/garáží v textu (regrese P2-11)", () => {
    expect(detectPropertyType("Prodej bytu 3+1 v rodinném domě, Praha")).toBe("flat");
    expect(detectPropertyType("Prodej bytu 2+kk se zahradou, Brno")).toBe("flat");
    expect(detectPropertyType("Prodej bytu 1+kk s garáží, Plzeň")).toBe("flat");
    // URL s /byt/ má přednost i proti matoucímu titulku
    expect(
      detectPropertyType("Rekonstruovaný dům", "https://www.sreality.cz/detail/prodej/byt/3+1/praha/999")
    ).toBe("flat");
  });

  it("vrátí null bez textu", () => {
    expect(detectPropertyType(null)).toBeNull();
    expect(detectPropertyType("")).toBeNull();
  });
});

describe("matchFilters", () => {
  it("filtruje podle lokality (case-insensitive)", () => {
    expect(matchFilters(listing(), { location: "praha" })).toBe(true);
    expect(matchFilters(listing(), { location: "brno" })).toBe(false);
  });

  it("filtruje podle městské části (district)", () => {
    expect(matchFilters(listing(), { district: "vinohrady" })).toBe(true);
    expect(matchFilters(listing(), { district: "smíchov" })).toBe(false);
  });

  it("filtruje podle typu nemovitosti", () => {
    expect(matchFilters(listing(), { propertyType: "flat" })).toBe(true);
    expect(matchFilters(listing(), { propertyType: "house" })).toBe(false);
  });

  it("nezamítne inzerát, u kterého typ nelze rozpoznat", () => {
    const l = listing({ title: "Super nabídka v centru", url: "https://x.cz/1" });
    expect(matchFilters(l, { propertyType: "house" })).toBe(true);
  });

  it("filtruje podle ceny a plochy", () => {
    expect(matchFilters(listing(), { priceMin: 5_000_000, priceMax: 6_000_000 })).toBe(true);
    expect(matchFilters(listing(), { priceMax: 4_000_000 })).toBe(false);
    expect(matchFilters(listing(), { areaMin: 60, areaMax: 80 })).toBe(true);
    expect(matchFilters(listing(), { areaMin: 100 })).toBe(false);
  });

  it("kombinuje více filtrů", () => {
    expect(
      matchFilters(listing(), {
        location: "praha",
        district: "vinohrady",
        priceMax: 6_000_000,
        propertyType: "flat",
      })
    ).toBe(true);
    expect(
      matchFilters(listing(), { location: "praha", propertyType: "house" })
    ).toBe(false);
  });

  it("projde bez filtrů", () => {
    expect(matchFilters(listing(), {})).toBe(true);
  });
});

describe("isCzechListing", () => {
  it("přijme GPS uvnitř ČR", () => {
    expect(isCzechListing(listing({ lat: 50.083, lng: 14.425 }))).toBe(true);
    expect(isCzechListing(listing({ lat: 49.7, lng: 13.4 }))).toBe(true);
  });

  it("odmítne GPS mimo ČR (Berlín)", () => {
    expect(isCzechListing(listing({ lat: 52.52, lng: 13.405 }))).toBe(false);
    expect(isCzechListing(listing({ lat: 48.1, lng: 17.1 }))).toBe(false);
  });

  it("odmítne zahraniční adresu bez GPS (Berlín/Mnichov)", () => {
    const l = listing({ lat: null, lng: null });
    expect(isCzechListing({ ...l, address: "Finowstrasse 17 Berlin" })).toBe(false);
    expect(isCzechListing({ ...l, address: "München Maxvorstadt, Bayern" })).toBe(false);
    expect(isCzechListing({ ...l, address: "Heßstr. München" })).toBe(false);
  });

  it("odmítne balkánská letoviska bez GPS (Nesebar, Sveti Vlas, Vir)", () => {
    const l = listing({ lat: null, lng: null });
    expect(isCzechListing({ ...l, address: "Nesebar" })).toBe(false);
    expect(isCzechListing({ ...l, address: "Sveti Vlas" })).toBe(false);
    expect(isCzechListing({ ...l, address: "Vir" })).toBe(false);
    expect(isCzechListing({ ...l, address: "Sunny Beach, Varna" })).toBe(false);
    expect(isCzechListing({ ...l, address: "služby Bulharsko, Burgas" })).toBe(false);
    expect(isCzechListing({ ...l, address: "Makarska, Chorvatsko" })).toBe(false);
  });

  it("nezamítne českou adresu bez GPS", () => {
    const l = listing({ lat: null, lng: null });
    expect(isCzechListing({ ...l, address: "Vinohradská 42, Praha 2" })).toBe(true);
    expect(isCzechListing({ ...l, address: "Školní, Meziměstí" })).toBe(true);
    expect(isCzechListing({ ...l, address: "Eduarda Hamburgera, Olomouc" })).toBe(true);
  });

  it("použije GPS přednostně před adresou", () => {
    expect(isCzechListing(listing({ lat: 52.52, lng: 13.405, address: "Praha 1" }))).toBe(false);
    expect(isCzechListing(listing({ lat: 50.083, lng: 14.425, address: "Berlin" }))).toBe(true);
  });
});

describe("isSaleListing", () => {
  it("přijme běžné prodejní inzeráty", () => {
    expect(isSaleListing({ title: "Prodej bytu 2+1, Olomouc", url: "https://x.cz/1" })).toBe(true);
    expect(isSaleListing({ title: "Byt 3+kk na prodej, Brno", url: "https://x.cz/2" })).toBe(true);
    expect(isSaleListing({ title: "Byt ke koupi, Praha", url: "https://x.cz/3" })).toBe(true);
    expect(isSaleListing({ title: "Rodinný dům na prodej", url: "https://x.cz/4" })).toBe(true);
  });

  it("odmítne nákupní poptávky z hyperinzerce", () => {
    expect(isSaleListing({
      title: "Hledáme BYT ke koupi v Praze 6, Nabídněte, Spolehliví",
      url: "https://byty.hyperinzerce.cz/hledam-byt-ke-koupi-poptavka-praha-6",
    })).toBe(false);
    expect(isSaleListing({
      title: "Rodina koupí 2 byty v Praze 6",
      url: "https://hyperinzerce.cz/rodina-koupi-2-byty-poptavka",
    })).toBe(false);
    expect(isSaleListing({
      title: "Byt v Praze 11, 3+1 / KOUPÍM",
      url: "https://hyperinzerce.cz/byt-poptavka",
    })).toBe(false);
    expect(isSaleListing({ title: "Koupím byt kategorie investiční", url: "https://x.cz/5" })).toBe(false);
  });

  it("odmítne pronájmy", () => {
    expect(isSaleListing({ title: "Pronájem bytu 2+kk Praha 9", url: "https://x.cz/6" })).toBe(false);
    expect(isSaleListing({ title: "Podnájem garsonky Brno", url: "https://x.cz/7" })).toBe(false);
    expect(isSaleListing({ title: "Byt 3+1 na pronájem", url: "https://x.cz/8" })).toBe(false);
  });

  it("neplete si „ke koupi“ s poptávkou", () => {
    expect(isSaleListing({ title: "Byt ke koupi, 2+1", url: "https://x.cz/9" })).toBe(true);
    expect(isSaleListing({ title: "Nemovitost k prodeji", url: "https://x.cz/10" })).toBe(true);
  });

  it("nezatratí prodej kvůli marketingu v popisu (poptávka, možnost pronájmu)", () => {
    const l = {
      title: "Prodej bytu 2+kk 60 m², Plzeň",
      url: "https://www.sreality.cz/detail/prodej/byt/2+kk/plzen/123",
      address: "Kovářská, Plzeň",
    };
    expect(isSaleListing({
      ...l,
      description: "Hledáte novostavbu v centru Plzně? Byt je vhodný i k pronájmu, o byt je velká poptávka.",
    })).toBe(true);
    expect(isSaleListing({
      ...l,
      description: "Pro investora dává smysl kombinace dispozice a možnosti pronájmu bytu bez nutnosti řešit vybavení.",
    })).toBe(true);
  });
});
