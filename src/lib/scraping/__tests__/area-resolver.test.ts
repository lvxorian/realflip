import { describe, it, expect } from "vitest";
import { resolveLivingArea, applyAreaResolution } from "../area-resolver";
import type { RawListing } from "../types";

describe("resolveLivingArea", () => {
  it("vrací null, když chybí oba údaje", () => {
    expect(resolveLivingArea(null, null)).toEqual({ area: null, estimatedAccessoryArea: null, flag: null });
    expect(resolveLivingArea(undefined, undefined)).toEqual({ area: null, estimatedAccessoryArea: null, flag: null });
    expect(resolveLivingArea(0, 0)).toEqual({ area: null, estimatedAccessoryArea: null, flag: null });
  });

  it("použije podlahovou plochu, když chybí užitná", () => {
    expect(resolveLivingArea(62, null)).toEqual({ area: 62, estimatedAccessoryArea: null, flag: null });
  });

  it("použije užitnou plochu, když chybí podlahová", () => {
    expect(resolveLivingArea(null, 58)).toEqual({ area: 58, estimatedAccessoryArea: null, flag: null });
  });

  it("vezme podlahovou plochu při malém rozdílu (tloušťka zdí)", () => {
    const r = resolveLivingArea(70, 71);
    expect(r.area).toBe(70); // 1.4% rozdíl ≤ 15%
    expect(r.estimatedAccessoryArea).toBeNull();
    expect(r.flag).toBeNull();
  });

  it("vezme menší plochu při rozdílu přes 15 % a dopočte příslušenství", () => {
    const r = resolveLivingArea(80, 67); // (80-67)/80 = 16,25% > 15%
    expect(r.area).toBe(67);
    expect(r.estimatedAccessoryArea).toBe(13);
    expect(r.flag).toBeNull();
  });

  it("vezme menší plochu při výrazném rozdílu (terasa ve větší)", () => {
    const r = resolveLivingArea(120, 78); // (120-78)/120 = 35%
    expect(r.area).toBe(78);
    expect(r.estimatedAccessoryArea).toBe(42);
    expect(r.flag).toBeNull();
  });

  it("na přesné hranici 15 % vezme podlahovou plochu", () => {
    const r = resolveLivingArea(80, 68); // (80-68)/80 = přesně 15% → ≤15% pravidlo
    expect(r.area).toBe(80);
    expect(r.estimatedAccessoryArea).toBeNull();
    expect(r.flag).toBeNull();
  });

  it("ignoruje podezřele malou plochu (< 15 m²) a použije větší + invalid-small", () => {
    const r = resolveLivingArea(10, 60);
    expect(r.area).toBe(60);
    expect(r.estimatedAccessoryArea).toBeNull();
    expect(r.flag).toBe("invalid-small");
  });

  it("označí extrémní rozdíl (např. 20 vs 150 m²) flagem extreme-diff", () => {
    const r = resolveLivingArea(150, 20);
    expect(r.area).toBe(20);
    expect(r.estimatedAccessoryArea).toBe(130);
    expect(r.flag).toBe("extreme-diff");
  });

  it("neoznačí extreme-diff, když rozdíl není tak extrémní", () => {
    const r = resolveLivingArea(120, 78);
    expect(r.flag).toBeNull();
  });
});

describe("applyAreaResolution", () => {
  const base: RawListing = {
    portalName: "sreality",
    url: "https://example.com/x",
    title: "Prodej bytu",
    price: 6_000_000,
    pricePerSqm: 50_000,
    area: 120,
    rooms: "3+1",
    floor: 3,
    condition: "good",
    buildingType: "brick",
    yearBuilt: 1970,
    address: "Praha",
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

  it("opraví area na menší plochu a přepočte pricePerSqm", () => {
    const listing = { ...base, floorArea: 120, usableArea: 78, area: 120 };
    const { resolved, accessoryArea, flag } = applyAreaResolution(listing);
    expect(resolved.area).toBe(78);
    expect(resolved.pricePerSqm).toBe(Math.round(6_000_000 / 78));
    expect(accessoryArea).toBe(42);
    expect(flag).toBeNull();
  });

  it("použije jedinou dostupnou plochu", () => {
    const listing = { ...base, floorArea: null, usableArea: 60, area: 60 };
    const { resolved, accessoryArea, flag } = applyAreaResolution(listing);
    expect(resolved.area).toBe(60);
    expect(resolved.pricePerSqm).toBe(Math.round(6_000_000 / 60));
    expect(accessoryArea).toBeNull();
    expect(flag).toBeNull();
  });

  it("nechá plochu beze změny, když nejsou žádné údaje", () => {
    const listing = { ...base, floorArea: null, usableArea: null, area: 90 };
    const { resolved, accessoryArea, flag } = applyAreaResolution(listing);
    expect(resolved.area).toBe(90);
    expect(resolved.pricePerSqm).toBe(50_000);
    expect(accessoryArea).toBeNull();
    expect(flag).toBeNull();
  });
});