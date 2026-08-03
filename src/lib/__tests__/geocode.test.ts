import { describe, it, expect, vi, afterEach } from "vitest";
import { cityKeyToName, reverseGeocode } from "../geocode";

function fakeNominatim(suburb: string, displayName: string, city = "Plzeň") {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        address: { suburb, city },
        display_name: displayName,
      }),
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it("reverseGeocode extrahuje čtvrť z display_name (přesnější než suburb)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        fakeNominatim("Jižní Předměstí", "Jižní Předměstí, Plzeň 3, Plzeň, okres Plzeň-město, Plzeňský kraj, Česko")
      )
    );
    const result = await reverseGeocode(49.7336, 13.3644);
    expect(result.quarter).toBe("Plzeň 3");
    expect(result.suburb).toBe("Jižní Předměstí");
    expect(result.city).toBe("Plzeň");
  });

  it("reverseGeocode fallback na suburb, když display_name nemá městskou část", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        fakeNominatim("Vesnička", "Vesnička, Liberec, okres Liberec, Liberecký kraj, Česko", "Liberec")
      )
    );
    const result = await reverseGeocode(50.77, 15.05);
    expect(result.quarter).toBe("Vesnička");
    expect(result.suburb).toBe("Vesnička");
  });
});
