import { describe, it, expect, vi, afterEach } from "vitest";
import { cityKeyToName, reverseGeocode, suggestAddresses, clearSuggestCache } from "../geocode";

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
  clearSuggestCache();
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

describe("suggestAddresses — autocomplete adres", () => {
  it("normalizuje Nominatim návrh s GPS a hinty na čtvrť", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            lat: "50.0836707",
            lon: "14.5549525",
            display_name: "Travná 1290, Kyje, Praha 14, Praha, Hlavní město Praha, Česko",
            address: {
              road: "Travná",
              house_number: "1290",
              suburb: "Kyje",
              quarter: "Praha 14",
              city: "Praha",
            },
          },
        ],
      })
    );

    const r = await suggestAddresses("Travná", "praha");
    expect(r).toHaveLength(1);
    expect(r[0].label).toBe("Travná 1290, Kyje, Praha");
    expect(r[0].address).toBe("Travná 1290, Kyje, Praha");
    expect(r[0].lat).toBeCloseTo(50.0836707, 5);
    expect(r[0].lng).toBeCloseTo(14.5549525, 5);
    expect(r[0].city).toBe("Praha");
    // quarter + suburb → ward matching (Kyje se najde přes seoName)
    expect(r[0].wardHints).toEqual(["Praha 14", "Kyje"]);
  });

  it("krátký dotaz (< 3 znaky) vrátí prázdno bez fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await suggestAddresses("a")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("selhání Nominatim → prázdný seznam (ruční zadání zůstává)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await suggestAddresses("Neexistující ulice")).toEqual([]);
  });

  it("vyřadí položky bez platných souřadnic", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { lat: "abc", lon: "xyz", address: { road: "Špatná", city: "Praha" } },
          { lat: "50.1", lon: "14.4", address: { road: "Dobrá", city: "Praha" } },
        ],
      })
    );
    const r = await suggestAddresses("Dobrá");
    expect(r).toHaveLength(1);
    expect(r[0].address).toBe("Dobrá, Praha");
  });

  it("duplicitní dotaz použije cache (jeden fetch)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { lat: "50.1", lon: "14.4", address: { road: "Cache", city: "Praha" } },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);
    await suggestAddresses("Cache ulice");
    await suggestAddresses("CACHE ULICE");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
