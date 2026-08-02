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
});
