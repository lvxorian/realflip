import { describe, it, expect } from "vitest";
import { toRealizedSale, REALIZED_SALE_TTL_MS } from "../sold-pairing";

const property = {
  id: "prop123",
  url: "https://sreality.cz/detail/123",
  portalName: "sreality",
  title: "Byt 2+kk Praha",
  price: 3_600_000,
  area: 60,
  rooms: "2+kk",
  condition: "good",
  buildingType: "brick",
  address: "Ulice 1, Praha 3",
  lat: 50.08,
  lng: 14.44,
  removedAt: 1_800_000_000_000,
};

describe("toRealizedSale", () => {
  it("převede zmizelý inzerát na realizovaný prodej", () => {
    const sale = toRealizedSale(property, 1_800_000_100_000);
    expect(sale).not.toBeNull();
    expect(sale!.propertyId).toBe("prop123");
    expect(sale!.price).toBe(3_600_000);
    expect(sale!.pricePerSqm).toBe(60_000);
    expect(sale!.area).toBe(60);
    expect(sale!.soldAt).toBe(1_800_000_000_000); // removedAt jako proxy data prodeje
    expect(sale!.createdAt).toBe(1_800_000_100_000);
    expect(sale!.condition).toBe("good");
    expect(sale!.address).toBe("Ulice 1, Praha 3");
  });

  it("spočítá Kč/m² vždy z ceny a plochy (autoritativní pole)", () => {
    const sale = toRealizedSale(property);
    expect(sale!.pricePerSqm).toBe(60_000);
  });

  it("bez ceny → null (nelze párovat)", () => {
    expect(toRealizedSale({ ...property, price: 0 })).toBeNull();
    expect(toRealizedSale({ ...property, price: -100 })).toBeNull();
  });

  it("bez plochy → null (bez Kč/m² by zkazil komparace)", () => {
    expect(toRealizedSale({ ...property, area: null })).toBeNull();
    expect(toRealizedSale({ ...property, area: 0 })).toBeNull();
  });

  it("nereálné Kč/m² (podíly, dražby) → null", () => {
    expect(toRealizedSale({ ...property, price: 100_000, area: 60 })).toBeNull(); // 1666 Kč/m²
    expect(toRealizedSale({ ...property, price: 50_000_000, area: 60 })).toBeNull(); // 833k Kč/m²
  });

  it("soldAt fallback na now, když není removedAt", () => {
    const sale = toRealizedSale({ ...property, removedAt: null }, 1_800_000_200_000);
    expect(sale!.soldAt).toBe(1_800_000_200_000);
  });
});

describe("REALIZED_SALE_TTL_MS", () => {
  it("je 12 měsíců", () => {
    expect(REALIZED_SALE_TTL_MS).toBe(365 * 24 * 60 * 60 * 1000);
  });
});
