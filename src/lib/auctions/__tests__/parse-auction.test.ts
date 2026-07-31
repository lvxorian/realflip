import { describe, it, expect } from "vitest";
import { extractAreaFromDescription, extractSlug } from "../parse-auction";

describe("extractAreaFromDescription", () => {
  it("extracts area from 'užitná plocha ... X m²'", () => {
    expect(
      extractAreaFromDescription("Jedná se o bytovou jednotku 1+1 o užitné ploše 38,2 m² ve 4. NP.")
    ).toBe(38);
  });

  it("extracts integer area", () => {
    expect(
      extractAreaFromDescription("Užitná plocha jednotky je 38 m2.")
    ).toBe(38);
  });

  it("extracts area when number precedes keyword", () => {
    expect(
      extractAreaFromDescription("Byt 45 m2 užitné plochy v cihle.")
    ).toBe(45);
  });

  it("extracts generic plocha pattern", () => {
    expect(
      extractAreaFromDescription("Plocha nemovitosti je 82 m2.")
    ).toBe(82);
  });

  it("ignores too-large values (building totals)", () => {
    // Plocha pozemku 3700 m² by neměla být použita jako plocha jednotky
    expect(
      extractAreaFromDescription("Celková plocha pozemku je 3700 m2. Užitná plocha jednotky je 38 m2.")
    ).toBe(38);
  });

  it("returns null when no area present", () => {
    expect(extractAreaFromDescription("Nemovitost v dobrém stavu, cihlová konstrukce.")).toBeNull();
  });

  it("returns null on empty input", () => {
    expect(extractAreaFromDescription(null)).toBeNull();
    expect(extractAreaFromDescription("")).toBeNull();
  });
});

describe("extractSlug", () => {
  it("extracts slug from /drazba/ URL", () => {
    expect(extractSlug("https://www.portaldrazeb.cz/drazba/146ex887-23-112-poner")).toBe("146ex887-23-112-poner");
  });

  it("extracts slug from /detail/ URL", () => {
    expect(extractSlug("https://www.portaldrazeb.cz/detail/abc123")).toBe("abc123");
  });

  it("returns null for invalid URL", () => {
    expect(extractSlug("https://example.com/other")).toBeNull();
  });
});
