import { describe, it, expect } from "vitest";
import { closedDealPrefill, isTerminalStage } from "../pipeline-modal";

describe("closedDealPrefill", () => {
  it("přednost má nabídnutá cena (offer.amount)", () => {
    expect(
      closedDealPrefill({
        stageData: { offer: { amount: 2_500_000 } },
        analysisTargetPurchasePrice: 2_400_000,
        propertyPrice: 2_900_000,
      })
    ).toBe(2_500_000);
  });

  it("bez nabídky → cílová nákupní cena z analýzy", () => {
    expect(
      closedDealPrefill({
        stageData: null,
        analysisTargetPurchasePrice: 2_300_000,
        propertyPrice: 2_600_000,
      })
    ).toBe(2_300_000);
  });

  it("bez nabídky i analýzy → cenovka nemovitosti", () => {
    expect(
      closedDealPrefill({
        stageData: null,
        analysisTargetPurchasePrice: null,
        propertyPrice: 2_600_000,
      })
    ).toBe(2_600_000);
  });

  it("neplatné / záporné hodnoty se ignorují; 0, když nic není", () => {
    expect(closedDealPrefill({ stageData: { offer: { amount: 0 } }, propertyPrice: -5 })).toBe(0);
    expect(closedDealPrefill({ stageData: { offer: { amount: -1 } }, analysisTargetPurchasePrice: 0 })).toBe(0);
    expect(closedDealPrefill({ stageData: null, analysisTargetPurchasePrice: null, propertyPrice: null })).toBe(0);
  });
});

describe("isTerminalStage", () => {
  it("closed a lost jsou terminální", () => {
    expect(isTerminalStage("closed")).toBe(true);
    expect(isTerminalStage("lost")).toBe(true);
  });

  it("aktivní fáze a neznámé hodnoty ne", () => {
    expect(isTerminalStage("new")).toBe(false);
    expect(isTerminalStage("negotiation")).toBe(false);
    expect(isTerminalStage(null)).toBe(false);
    expect(isTerminalStage(undefined)).toBe(false);
  });
});