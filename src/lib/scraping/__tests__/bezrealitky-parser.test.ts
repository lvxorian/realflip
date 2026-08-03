import { describe, it, expect } from "vitest";
import { parseBezrealitkyAdvert, parseBezrealitkySearch, BEZREALITKY_DISPOSITION } from "../bezrealitky-parser";

describe("parseBezrealitkyAdvert", () => {
  it("převádí prodejní byt s refs na obrazy", () => {
    const cache: Record<string, Record<string, unknown>> = {
      "Image:100": { 'url({"filter":"RECORD_MAIN"})': "https://api.bezrealitky.cz/media/cache/record_main/photo.jpg" },
      "Image:101": { 'url({"filter":"RECORD_MAIN"})': "https://api.bezrealitky.cz/media/cache/record_main/photo2.jpg" },
    };
    const advert = {
      __typename: "Advert",
      id: "12345",
      uri: "12345-nabidka-prodej-bytu-praha",
      estateType: "BYT",
      offerType: "PRODEJ",
      disposition: "DISP_3_KK",
      surface: 65,
      price: 5_500_000,
      address: "Vinohradská 42, Praha 2 - Vinohrady",
      gps: { lat: 50.07, lng: 14.45 },
      publicImages: [{ __ref: "Image:100" }, { __ref: "Image:101" }],
    };

    const listing = parseBezrealitkyAdvert(advert, cache, "https://www.bezrealitky.cz/nemovitosti-byty-domy/12345-nabidka-prodej-bytu-praha");

    expect(listing.portalName).toBe("bezrealitky");
    expect(listing.price).toBe(5_500_000);
    expect(listing.area).toBe(65);
    expect(listing.rooms).toBe("3+kk");
    expect(listing.pricePerSqm).toBe(Math.round(5_500_000 / 65));
    expect(listing.lat).toBe(50.07);
    expect(listing.lng).toBe(14.45);
    expect(listing.imageUrls).toContain("https://api.bezrealitky.cz/media/cache/record_main/photo.jpg");
  });

  it("bez fotografií → prázdné imageUrls", () => {
    const advert = { estateType: "BYT", offerType: "PRODEJ", price: 3_000_000, surface: 50 };
    const listing = parseBezrealitkyAdvert(advert, {}, "https://x.cz/1");
    expect(listing.imageUrls).toEqual([]);
  });

  it("dispozice mapuje BEZREALITKY_DISPOSITION", () => {
    expect(BEZREALITKY_DISPOSITION.DISP_2_1).toBe("2+1");
    expect(BEZREALITKY_DISPOSITION.DISP_4_KK).toBe("4+kk");
    expect(BEZREALITKY_DISPOSITION.GARSONKA).toBe("1+kk");
  });
});

describe("parseBezrealitkySearch", () => {
  it("vyčte listAdverts z __NEXT_DATA__ a postaví detail URL", () => {
    const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          apolloCache: {
            ROOT_QUERY: {
              'listAdverts({"construction":[],"currency":"CZK","limit":15,"offset":0,"order":"TIMEORDER_DESC","regionOsmIds":[]})': {
                list: [{ __ref: "Advert:100" }],
                totalCount: 1234,
              },
            },
            "Advert:100": {
              __typename: "Advert",
              id: "100",
              uri: "100-nabidka-prodej-bytu-praha",
              estateType: "BYT",
              offerType: "PRODEJ",
              disposition: "DISP_2_KK",
              surface: 55,
              price: 4_200_000,
              address: "Praha 4",
            },
          },
        },
      },
    })}</script></html>`;

    const { listings, totalCount } = parseBezrealitkySearch(html, "https://www.bezrealitky.cz/vyhledat");
    expect(totalCount).toBe(1234);
    expect(listings).toHaveLength(1);
    expect(listings[0].price).toBe(4_200_000);
    expect(listings[0].rooms).toBe("2+kk");
    expect(listings[0].url).toBe("https://www.bezrealitky.cz/nemovitosti-byty-domy/100-nabidka-prodej-bytu-praha");
  });

  it("bez listAdverts → prázdný seznam", () => {
    const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { apolloCache: {} } } })}</script></html>`;
    const { listings, totalCount } = parseBezrealitkySearch(html, "https://x.cz");
    expect(listings).toEqual([]);
    expect(totalCount).toBe(0);
  });
});
