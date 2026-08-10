import { describe, it, expect } from "vitest";
import {
  listingMatchesCrossPortal,
  bestMatchCandidate,
  parseAltPortals,
  appendAltPortal,
  hasAltUrl,
  altUrlsOf,
  toDbAltPortals,
  type MatchCandidate,
} from "../property-match";

function candidate(overrides: Partial<MatchCandidate> = {}): MatchCandidate {
  return {
    id: "c1",
    portalName: "sreality",
    title: "Prodej bytu 3+1 78 m²",
    address: "Revoluční 12, Praha",
    rooms: "3+1",
    area: 78,
    lastSeen: 1_700_000_000_000,
    isActive: 1,
    ...overrides,
  };
}

describe("listingMatchesCrossPortal", () => {
  it("matches the same property on another portal (shared address tokens)", () => {
    const listing = {
      portalName: "remax",
      title: "Prodej bytu 3+1 78 m² Praha",
      address: "Revoluční 12, Praha",
      rooms: "3+1",
      area: 78,
    };
    expect(listingMatchesCrossPortal(listing, candidate())).toBe(true);
  });

  it("matches with slightly different address wording", () => {
    const listing = {
      portalName: "bazos",
      title: "Prodám byt 3+1 Praha Revoluční",
      address: "Revoluční 12, Praha 1",
      rooms: "3+1",
      area: 78,
    };
    expect(listingMatchesCrossPortal(listing, candidate())).toBe(true);
  });

  it("matches via a single specific token when rooms and area match exactly", () => {
    const listing = {
      portalName: "annonce",
      title: "Byt k prodeji Praha",
      address: "Revoluční",
      rooms: "3+1",
      area: 78,
    };
    expect(listingMatchesCrossPortal(listing, candidate())).toBe(true);
  });

  it("rejects different rooms", () => {
    const listing = {
      portalName: "remax",
      title: "Prodej bytu 2+1",
      address: "Revoluční 12, Praha",
      rooms: "2+1",
      area: 78,
    };
    expect(listingMatchesCrossPortal(listing, candidate())).toBe(false);
  });

  it("rejects area deviation above 10%", () => {
    const listing = {
      portalName: "remax",
      title: "Prodej bytu 3+1",
      address: "Revoluční 12, Praha",
      rooms: "3+1",
      area: 95,
    };
    expect(listingMatchesCrossPortal(listing, candidate())).toBe(false);
  });

  it("rejects generic title-only fallback (no address tokens)", () => {
    const listing = {
      portalName: "bazos",
      title: "Prodej bytu 3+1 78 m² Praha",
      address: "Praha 5 - Smíchov",
      rooms: "3+1",
      area: 78,
    };
    expect(listingMatchesCrossPortal(listing, candidate())).toBe(false);
  });

  it("rejects empty rooms with no area confidence", () => {
    const listing = {
      portalName: "remax",
      title: "Prodej bytu",
      address: "Revoluční 12, Praha",
      rooms: null,
      area: null,
    };
    expect(listingMatchesCrossPortal(listing, candidate())).toBe(false);
  });

  it("rejects same city, different streets (town token is generic)", () => {
    const listing = {
      portalName: "idnes-reality",
      title: "prodej bytu 3+1 60 m²",
      address: "Májová, Cheb",
      rooms: "3+1",
      area: 60,
    };
    expect(listingMatchesCrossPortal(listing, candidate({ address: "Valdštejnova, Cheb" }))).toBe(false);
  });

  it("rejects same street with different house numbers", () => {
    const listing = {
      portalName: "sreality",
      title: "Prodej bytu 3+1 76 m²",
      address: "Hrnčířská 1 Cheb",
      rooms: "3+1",
      area: 76,
      price: 3_300_000,
    };
    expect(listingMatchesCrossPortal(listing, candidate({ address: "Hrnčířská 5 Cheb", price: 3_300_000 }))).toBe(false);
  });

  it("matches same street and house number across portals", () => {
    const listing = {
      portalName: "sreality",
      title: "Prodej bytu 3+1 76 m²",
      address: "Kasární náměstí 11 Cheb",
      rooms: "3+1",
      area: 76,
      price: 3_300_000,
    };
    expect(listingMatchesCrossPortal(listing, candidate({ address: "Kasární náměstí, Cheb 11", price: 3_300_000 }))).toBe(true);
  });

  it("rejects large price divergence on street-only match", () => {
    const listing = {
      portalName: "idnes-reality",
      title: "prodej bytu 3+1 60 m²",
      address: "Lesní, Cheb",
      rooms: "3+1",
      area: 60,
      price: 3_200_000,
    };
    expect(listingMatchesCrossPortal(listing, candidate({ address: "Lesní Cheb", price: 2_000_000 }))).toBe(false);
  });

  it("rejects same street name in a different city", () => {
    const listing = {
      portalName: "idnes-reality",
      title: "prodej bytu 2+kk 56 m²",
      address: "Edvarda Beneše, Olomouc - Řepčín",
      rooms: "2+kk",
      area: 56,
      price: 6_690_000,
    };
    expect(
      listingMatchesCrossPortal(
        listing,
        candidate({ address: "Edvarda Beneše Plzeň", rooms: "2+kk", area: 56, price: 6_690_000, isActive: 0 })
      )
    ).toBe(false);
  });

  it("street-only match passes when city unknown on one side", () => {
    const listing = {
      portalName: "idnes-reality",
      title: "prodej bytu 3+1 60 m²",
      address: "Lesní, Cheb",
      rooms: "3+1",
      area: 60,
      price: 3_200_000,
    };
    expect(listingMatchesCrossPortal(listing, candidate({ address: "Lesní 17", area: 60, price: 3_200_000 }))).toBe(true);
  });
});

describe("bestMatchCandidate", () => {
  const active = candidate({ id: "a", isActive: 1, lastSeen: 1_700_000_000_000 });
  const inactive = candidate({ id: "i", isActive: 0, lastSeen: 1_700_000_000_000 });
  const listing = {
    portalName: "remax",
    title: "Prodej bytu 3+1 78 m² Praha",
    address: "Revoluční 12, Praha",
    rooms: "3+1",
    area: 78,
  };

  it("prefers an active record over an inactive one", () => {
    expect(bestMatchCandidate(listing, [inactive, active])?.id).toBe("a");
  });

  it("prefers the most recently seen among inactive", () => {
    const old = candidate({ id: "o", isActive: 0, lastSeen: 1_000_000_000_000 });
    expect(bestMatchCandidate(listing, [old, inactive])?.id).toBe("i");
  });

  it("returns null when nothing matches", () => {
    expect(bestMatchCandidate(listing, [candidate({ address: "Jindřišská 25, Brno", rooms: "4+1" })])).toBeNull();
  });
});

describe("alt_portals helpers", () => {
  it("parses a JSON string", () => {
    expect(parseAltPortals('[{"portalName":"bazos","url":"https://bazos.cz/x"}]')).toEqual([
      { portalName: "bazos", url: "https://bazos.cz/x" },
    ]);
  });

  it("parses an already-parsed array", () => {
    expect(parseAltPortals([{ portalName: "remax", url: "https://remax.cz/y" }])).toEqual([
      { portalName: "remax", url: "https://remax.cz/y" },
    ]);
  });

  it("returns [] for null / garbage", () => {
    expect(parseAltPortals(null)).toEqual([]);
    expect(parseAltPortals("not-json")).toEqual([]);
    expect(parseAltPortals("{}")).toEqual([]);
  });

  it("appends without duplicates by url", () => {
    const base = [{ portalName: "bazos", url: "https://bazos.cz/x" }];
    const once = appendAltPortal(base, "remax", "https://remax.cz/y");
    const twice = appendAltPortal(base, "remax", "https://remax.cz/y");
    expect(once).toHaveLength(2);
    expect(twice).toHaveLength(2);
  });

  it("hasAltUrl and altUrlsOf", () => {
    const raw = '[{"portalName":"bazos","url":"https://bazos.cz/x"}]';
    expect(hasAltUrl(raw, "https://bazos.cz/x")).toBe(true);
    expect(hasAltUrl(raw, "https://elsewhere.cz")).toBe(false);
    expect(altUrlsOf(raw)).toEqual(["https://bazos.cz/x"]);
  });

  it("toDbAltPortals serializes to JSON string", () => {
    expect(toDbAltPortals([{ portalName: "bazos", url: "https://bazos.cz/x" }])).toBe(
      '[{"portalName":"bazos","url":"https://bazos.cz/x"}]'
    );
  });
});