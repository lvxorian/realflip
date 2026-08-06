import { describe, it, expect } from "vitest";
import {
  listingMatches,
  normalizeText,
  tokenize,
  roomsEqual,
  areasWithin,
  type NewListingLike,
  type RelistCandidate,
} from "../relisting";

const listing = (over: Partial<NewListingLike> = {}): NewListingLike => ({
  portalName: "sreality",
  title: "Prodej bytu 2+1 89 m², Baranova 26, Praha 3 - Žižkov",
  address: "Baranova 26, Praha 3 - Žižkov",
  rooms: "2+1",
  area: 89,
  ...over,
});

const candidate = (over: Partial<RelistCandidate> = {}): RelistCandidate => ({
  id: "prop-1",
  portalName: "sreality",
  title: "Byt 2+1 89 m² Baranova, Praha 3",
  address: "Praha 3 - Žižkov, Baranova",
  rooms: "2+1",
  area: 89,
  ...over,
});

describe("normalizeText / tokenize", () => {
  it("strips diacritics and punctuation", () => {
    expect(normalizeText("Žižkov, Praha 3 — Byt")).toBe("zizkov praha 3 byt");
  });

  it("tokenizes meaningful words", () => {
    expect(tokenize("Praha 3 - Žižkov, Baranova 26")).toEqual(["praha", "zizkov", "baranova"]);
  });
});

describe("roomsEqual", () => {
  it("matches same disposition with different variants", () => {
    expect(roomsEqual("2+1", "2+kk")).toBe(true);
    expect(roomsEqual("3", "3+1")).toBe(true);
  });

  it("rejects different dispositions", () => {
    expect(roomsEqual("2+1", "3+1")).toBe(false);
  });

  it("rejects unparsable values", () => {
    expect(roomsEqual(null, "2+1")).toBe(false);
    expect(roomsEqual("garzona", "garsonka")).toBe(false);
  });
});

describe("areasWithin", () => {
  it("accepts within 10%", () => {
    expect(areasWithin(89, 94)).toBe(true);
    expect(areasWithin(89, 89)).toBe(true);
  });

  it("rejects outside 10%", () => {
    expect(areasWithin(89, 110)).toBe(false);
  });

  it("returns null when not comparable", () => {
    expect(areasWithin(null, 89)).toBeNull();
    expect(areasWithin(89, null)).toBeNull();
  });
});

describe("listingMatches", () => {
  it("matches strong address + rooms + area", () => {
    expect(listingMatches(listing(), candidate())).toBe(true);
  });

  it("matches with area tolerance", () => {
    expect(listingMatches(listing({ area: 94 }), candidate({ area: 89 }))).toBe(true);
  });

  it("matches when area is unknown on both sides but address is strong", () => {
    expect(listingMatches(listing({ area: null }), candidate({ area: null, rooms: "2+1" }))).toBe(true);
  });

  it("rejects different rooms on strong address", () => {
    expect(listingMatches(listing({ rooms: "3+1" }), candidate())).toBe(false);
  });

  it("rejects area outside tolerance on strong address", () => {
    expect(listingMatches(listing({ area: 130 }), candidate({ area: 89 }))).toBe(false);
  });

  it("matches weak address only when rooms AND area agree", () => {
    const weakListing = listing({ address: "Baranova 26, Praha 3" });
    const weakCandidate = candidate({ address: "Praha 3" });
    expect(listingMatches(weakListing, weakCandidate)).toBe(true);
    expect(listingMatches(weakListing, candidate({ address: "Praha 3", area: null }))).toBe(false);
    expect(listingMatches(weakListing, candidate({ address: "Praha 3", rooms: "4+1" }))).toBe(false);
  });

  it("falls back to title overlap when address is missing", () => {
    const noAddress = candidate({ address: null, title: "Byt 2+1 Baranova Praha Žižkov" });
    expect(listingMatches(listing({ address: null, title: "Prodej bytu Baranova Praha Žižkov 2+1" }), noAddress)).toBe(true);
  });

  it("rejects different portals even with identical data", () => {
    expect(listingMatches(listing(), candidate({ portalName: "bezrealitky" }))).toBe(false);
  });

  it("rejects unrelated listing in same city", () => {
    const unrelated = candidate({ address: "Praha 3 - Vinohrady, Italská", title: "Prodej bytu 2+1 78 m², Italská", area: 78 });
    expect(listingMatches(listing({ address: "Italská 12, Praha 3" }), unrelated)).toBe(false);
  });

  it("rejects when nothing overlaps", () => {
    expect(listingMatches(listing({ address: null, title: "Prodej bytu 2+1 89 m2 Baranova" }), candidate({ address: null, title: "Prodej garaze v Brne" }))).toBe(false);
  });
});