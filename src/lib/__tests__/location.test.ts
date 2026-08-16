import { describe, it, expect } from "vitest";
import { classifyLocation, findCityKey, cityNamesFor, cityDisplayName, addressMatchesCity } from "../analysis/location";

describe("classifyLocation", () => {
  it("classifies Prague premium district", () => {
    const loc = classifyLocation("praha", "Vinohrady");
    expect(loc.city).toBe("praha");
    expect(loc.category).toBe("premium");
    expect(loc.segments).not.toBeNull();
  });

  it("classifies Prague stable district", () => {
    const loc = classifyLocation("praha", "Žižkov");
    expect(loc.category).toBe("stable");
  });

  it("classifies Prague risky district", () => {
    const loc = classifyLocation("praha", "Háje");
    expect(loc.category).toBe("risky");
  });

  it("classifies by city when district unknown", () => {
    const loc = classifyLocation("brno", null);
    expect(loc.category).toBe("stable");
    expect(loc.segments).not.toBeNull();
  });

  it("returns unknown for unlisted city without district", () => {
    const loc = classifyLocation("neexistujemesto", null);
    expect(loc.category).toBe("unknown");
    expect(loc.segments).toBeNull();
  });

  it("returns unknown for unlisted city with district", () => {
    const loc = classifyLocation("neexistujemesto", "Kdekde");
    expect(loc.category).toBe("unknown");
  });

  it("handles case-insensitive city matching", () => {
    const loc = classifyLocation("Praha", "Vinohrady");
    expect(loc.city).toBe("praha");
    expect(loc.category).toBe("premium");
  });

  it("handles city aliases", () => {
    const loc = classifyLocation("cb", null);
    expect(loc.city).toBe("ceske_budejovice");
  });

  it("classifies Ostrava district", () => {
    const loc = classifyLocation("ostrava", "Poruba");
    expect(loc.category).toBe("premium");
  });

  it("uses city default category when district not found", () => {
    const loc = classifyLocation("ostrava", "NeznámáČtvrť");
    expect(loc.category).toBe("stable");
  });

  it("returns district name when matched", () => {
    const loc = classifyLocation("praha", "karlín");
    expect(loc.district?.toLowerCase()).toBe("karlín");
  });

  it("returns null when district not matched", () => {
    const loc = classifyLocation("praha", "SomeUnknownDistrict");
    expect(loc.district).toBeNull();
  });
});

describe("findCityKey", () => {
  it("resolves display name to city key", () => {
    expect(findCityKey("Brno")).toBe("brno");
    expect(findCityKey("Mladá Boleslav")).toBe("mlada_boleslav");
    expect(findCityKey("karlovy vary")).toBe("karlovy_vary");
    expect(findCityKey("Ústí nad Labem")).toBe("usti");
    expect(findCityKey("Most")).toBe("most");
  });

  it("returns null for unknown city", () => {
    expect(findCityKey("NekdeUprostredNic")).toBeNull();
    expect(findCityKey(null)).toBeNull();
  });
});

describe("cityNamesFor + addressMatchesCity", () => {
  it("matches Sreality locality city names", () => {
    expect(addressMatchesCity("Brno", cityNamesFor("brno"))).toBe(true);
    expect(addressMatchesCity("Brno-město", cityNamesFor("brno"))).toBe(true);
    expect(addressMatchesCity("Praha", cityNamesFor("brno"))).toBe(false);
    expect(addressMatchesCity("Prague", cityNamesFor("praha"))).toBe(true);
    expect(addressMatchesCity("Plzeň", cityNamesFor("plzen"))).toBe(true);
  });
});

describe("cityDisplayName", () => {
  it("maps slugs to proper Czech display names", () => {
    expect(cityDisplayName("praha")).toBe("Praha");
    expect(cityDisplayName("olomouc")).toBe("Olomouc");
    expect(cityDisplayName("plzen")).toBe("Plzeň");
    expect(cityDisplayName("ceske_budejovice")).toBe("České Budějovice");
    expect(cityDisplayName("usti")).toBe("Ústí nad Labem");
    expect(cityDisplayName("hradec")).toBe("Hradec Králové");
    expect(cityDisplayName("mlada_boleslav")).toBe("Mladá Boleslav");
    expect(cityDisplayName("havlickuv_brod")).toBe("Havlíčkův Brod");
    expect(cityDisplayName("karlovy_vary")).toBe("Karlovy Vary");
    expect(cityDisplayName("zlin")).toBe("Zlín");
    expect(cityDisplayName("trinec")).toBe("Třinec");
  });

  it("is case-insensitive for slug input", () => {
    expect(cityDisplayName("Praha")).toBe("Praha");
    expect(cityDisplayName("PRAHA")).toBe("Praha");
    expect(cityDisplayName("Mladá Boleslav")).toBe("Mladá Boleslav");
  });

  it("passes unknown values through verbatim", () => {
    expect(cityDisplayName("Praha 5")).toBe("Praha 5");
    expect(cityDisplayName("Někde v Čechách")).toBe("Někde v Čechách");
  });

  it("returns null for missing/unknown sentinels", () => {
    expect(cityDisplayName(null)).toBeNull();
    expect(cityDisplayName(undefined)).toBeNull();
    expect(cityDisplayName("Neznámá")).toBeNull();
    expect(cityDisplayName("unknown")).toBeNull();
  });
});
