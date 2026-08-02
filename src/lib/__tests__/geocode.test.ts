import { describe, it, expect } from "vitest";
import { cityKeyToName } from "../geocode";

describe("geocode helpers", () => {
  it("cityKeyToName převede cityKey na lidský název města", () => {
    expect(cityKeyToName("cheb")).toBe("Cheb");
    expect(cityKeyToName("plzen")).toBe("Plzeň");
    expect(cityKeyToName("praha")).toBe("Praha");
    expect(cityKeyToName("brno")).toBe("Brno");
    expect(cityKeyToName("usti")).toBe("Ústí nad labem");
    expect(cityKeyToName("ceske_budejovice")).toBe("České budějovice");
    expect(cityKeyToName("zlin")).toBe("Zlín");
  });

  it("cityKeyToName vrátí null pro neznámou/neplatnou lokalitu", () => {
    expect(cityKeyToName(null)).toBeNull();
    expect(cityKeyToName(undefined)).toBeNull();
    expect(cityKeyToName("Neznámá")).toBeNull();
    expect(cityKeyToName("unknown")).toBeNull();
  });
});
