import { describe, it, expect } from "vitest";
import { classifyLocation } from "../analysis/location";

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
