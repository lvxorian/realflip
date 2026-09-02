import { describe, it, expect } from "vitest";
import { RATING_META, ratingMeta, ratingBadgeVariant, normalizeRatingLabel, TIER_LABEL } from "../rating";

describe("rating mapa (slovník webu Realinga)", () => {
  it("zná web labels i legacy API slova (tier 1 = Vynikající i Velmi dobrá)", () => {
    for (const label of ["Vynikající cena", "Velmi dobrá cena", "Dobrá cena", "Férová cena", "Vyšší cena", "Vysoká cena"]) {
      expect(RATING_META[label], label).toBeDefined();
      expect(ratingMeta(label)?.meter.bar, label).toBeTruthy();
      expect(ratingMeta(label)?.meter.text, label).toBeTruthy();
    }
    expect(ratingMeta("Vynikající cena")?.tier).toBe(1);
    expect(ratingMeta("Velmi dobrá cena")?.tier).toBe(1); // legacy alias
  });

  it("seřazení tier 1..5 odpovídá přísnosti", () => {
    const tiers = ["Vynikající cena", "Dobrá cena", "Férová cena", "Vyšší cena", "Vysoká cena"].map(
      (l) => ratingMeta(l)!.tier
    );
    expect(tiers).toEqual([1, 2, 3, 4, 5]);
  });

  it("meter dílky: nejlepší = plný 5/5, ubývá po jedné až 1/5", () => {
    const filled = ["Vynikající cena", "Dobrá cena", "Férová cena", "Vyšší cena", "Vysoká cena"].map(
      (l) => ratingMeta(l)!.meter.filled
    );
    expect(filled).toEqual([5, 4, 3, 2, 1]);
    // legacy alias tier 1 má stejný plný bar
    expect(ratingMeta("Velmi dobrá cena")?.meter.filled).toBe(5);
  });

  it("barva meteru jde zelená → červená s klesající kvalitou", () => {
    const bars = ["Vynikající cena", "Dobrá cena", "Férová cena", "Vyšší cena", "Vysoká cena"].map(
      (l) => ratingMeta(l)!.meter.bar
    );
    expect(bars).toEqual([
      "bg-emerald-500",
      "bg-green-500",
      "bg-lime-500",
      "bg-amber-500",
      "bg-red-500",
    ]);
  });

  it("neznámý/prázdný label → null / default badge (UI nespadne)", () => {
    expect(ratingMeta("Extrémní cena")).toBeNull();
    expect(ratingMeta(null)).toBeNull();
    expect(ratingMeta("  Férová cena  ")?.tier).toBe(3); // trim tolerance
    expect(ratingBadgeVariant("neznámá")).toBe("default");
  });
});

describe("normalizeRatingLabel — web slovník z tieru", () => {
  it("přepíše API label na slovo webu podle tieru", () => {
    expect(normalizeRatingLabel("Velmi dobrá cena", "1")).toBe("Vynikající cena");
    expect(normalizeRatingLabel("Velmi dobrá cena", 2)).toBe("Dobrá cena");
    expect(normalizeRatingLabel(null, "5")).toBe("Vysoká cena");
  });

  it("bez tieru ponechá API label; neznámý tier + nic → null", () => {
    expect(normalizeRatingLabel("Férová cena", null)).toBe("Férová cena");
    expect(normalizeRatingLabel("Vynikající cena", "9")).toBe("Vynikající cena");
    expect(normalizeRatingLabel(null, "9")).toBeNull();
    expect(normalizeRatingLabel("  ", "0")).toBeNull();
  });

  it("TIER_LABEL pokrývá 1..5", () => {
    expect(Object.keys(TIER_LABEL)).toEqual(["1", "2", "3", "4", "5"]);
  });
});
