import { describe, it, expect } from "vitest";
import { extractSrealityHashId } from "../scraping/sreality-detail";
import { matchQuarterToSreality } from "../locality/quarter-map";

describe("sreality detail helpers", () => {
  it("extractSrealityHashId extrahuje hash_id z URL", () => {
    expect(extractSrealityHashId("https://www.sreality.cz/detail/prodej/byt/2+kk/plzen-plzen-cechova/3935207500")).toBe("3935207500");
    expect(extractSrealityHashId("https://www.sreality.cz/detail/prodej/byt/12345")).toBe("12345");
    expect(extractSrealityHashId("https://www.bezrealitky.cz/nemovitosti/123")).toBeNull();
    expect(extractSrealityHashId(null)).toBeNull();
    expect(extractSrealityHashId("https://www.sreality.cz/detail/prodej/byt/abc")).toBeNull();
  });
});

describe("quarter-map", () => {
  it("přiřadí název čtvrti k sreality quarter_id", () => {
    const m = matchQuarterToSreality("Plzeň 3", "plzen");
    expect(m?.quarterId).toBe(6);
    expect(m?.label).toBe("Plzeň 3");
  });

  it("přiřadí čtvrť z Nominatim (suburb) i bez diakritiky", () => {
    const m = matchQuarterToSreality("Jižní Předměstí", "plzen");
    expect(m?.quarterId).toBe(6);
  });

  it("vrátí null pro neznámou čtvrť", () => {
    expect(matchQuarterToSreality("Nějaká Neexistující Vesnice", "plzen")).toBeNull();
    expect(matchQuarterToSreality(null, "plzen")).toBeNull();
  });

  it("district_id odpovídá reálným sreality okresům (POI filtr)", () => {
    // Ověřeno na sreality search API (locality_district_id vrací výsledky jen s těmito ID)
    expect(matchQuarterToSreality("Brno-střed", "brno")?.districtId).toBe(72);
    expect(matchQuarterToSreality("Ostrava", "ostrava")?.districtId).toBe(65);
    expect(matchQuarterToSreality("Ústí nad Labem", "usti")?.districtId).toBe(27);
    expect(matchQuarterToSreality("Olomouc", "olomouc")?.districtId).toBe(42);
    expect(matchQuarterToSreality("Karlovy Vary", "karlovy_vary")?.districtId).toBe(10);
    expect(matchQuarterToSreality("Cheb", "cheb")?.districtId).toBe(9);
    expect(matchQuarterToSreality("Plzeň 3", "plzen")?.districtId).toBe(12);
  });

  it("Praha má district_id per správní obvod", () => {
    expect(matchQuarterToSreality("Praha 1", "praha")?.districtId).toBe(5001);
    expect(matchQuarterToSreality("Praha 3", "praha")?.districtId).toBe(5003);
    expect(matchQuarterToSreality("Praha 9", "praha")?.districtId).toBe(5009);
    expect(matchQuarterToSreality("Praha 11", "praha")?.districtId).toBe(5004);
    expect(matchQuarterToSreality("Praha 16", "praha")?.districtId).toBe(5005);
    expect(matchQuarterToSreality("Praha 20", "praha")?.districtId).toBe(5009);
    expect(matchQuarterToSreality("Praha 22", "praha")?.districtId).toBe(5010);
  });

  it("nová města mapují čtvrť → sreality district_id", () => {
    expect(matchQuarterToSreality("Liberec", "liberec")?.districtId).toBe(22);
    expect(matchQuarterToSreality("Pardubice", "pardubice")?.districtId).toBe(32);
    expect(matchQuarterToSreality("Hradec Králové", "hradec")?.districtId).toBe(28);
    expect(matchQuarterToSreality("Zlín", "zlin")?.districtId).toBe(38);
    expect(matchQuarterToSreality("Jihlava", "jihlava")?.districtId).toBe(67);
    expect(matchQuarterToSreality("České Budějovice", "ceske_budejovice")?.districtId).toBe(1);
  });
});
