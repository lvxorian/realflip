import { describe, it, expect } from "vitest";
import { RATING_META, ratingMeta, ratingBadgeVariant } from "../rating";

describe("rating mapa (Realingo labels verbatim)", () => {
  it("zná všech 5 labelů z Realingo/Valuo", () => {
    for (const label of ["Velmi dobrá cena", "Dobrá cena", "Férová cena", "Vyšší cena", "Vysoká cena"]) {
      expect(RATING_META[label], label).toBeDefined();
      expect(ratingMeta(label)?.strip, label).toBeTruthy();
    }
  });

  it("seřazení tier 1..5 odpovídá přísnosti", () => {
    const tiers = ["Velmi dobrá cena", "Dobrá cena", "Férová cena", "Vyšší cena", "Vysoká cena"].map(
      (l) => ratingMeta(l)!.tier
    );
    expect(tiers).toEqual([1, 2, 3, 4, 5]);
  });

  it("neznámý/ prázdný label → null / default badge (UI nespadne)", () => {
    expect(ratingMeta("Extrémní cena")).toBeNull();
    expect(ratingMeta(null)).toBeNull();
    expect(ratingMeta("  Férová cena  ")?.tier).toBe(3); // trim tolerance
    expect(ratingBadgeVariant("neznámá")).toBe("default");
  });
});
