import { describe, it, expect } from "vitest";
import {
  calculateFlipCosts,
  calculateFlipResults,
  calculateTargetPurchasePrice,
  renovationCostFromPreset,
  calculateItemizedRenovation,
  COST_CONSTANTS,
  RENOVATION_PRESETS,
} from "../analysis/flip-costs";

const defaults = { area: 70, purchasePrice: 3_000_000, arv: 4_200_000, renovationCost: 700_000 };

describe("calculateFlipCosts", () => {
  it("returns correct structure", () => {
    const costs = calculateFlipCosts(defaults.purchasePrice, defaults.arv, defaults.renovationCost, defaults.area);
    expect(costs).toHaveProperty("purchasePrice");
    expect(costs).toHaveProperty("legalFees");
    expect(costs).toHaveProperty("renovationCost");
    expect(costs).toHaveProperty("contingency");
    expect(costs).toHaveProperty("holdingCosts");
    expect(costs).toHaveProperty("sellingCommission");
    expect(costs).toHaveProperty("incomeTax");
    expect(costs).toHaveProperty("totalCost");
  });

  it("computes contingency as 10% of renovation", () => {
    const costs = calculateFlipCosts(defaults.purchasePrice, defaults.arv, 500000, defaults.area);
    expect(costs.contingency).toBe(50000);
  });

  it("includes legal fees", () => {
    const costs = calculateFlipCosts(defaults.purchasePrice, defaults.arv, defaults.renovationCost, defaults.area);
    expect(costs.legalFees).toBe(COST_CONSTANTS.legalFees);
  });

  it("sets selling commission when enabled", () => {
    const costs = calculateFlipCosts(defaults.purchasePrice, defaults.arv, defaults.renovationCost, defaults.area);
    expect(costs.sellingCommission).toBe(Math.round(defaults.arv * COST_CONSTANTS.sellingCommissionRate));
    expect(costs.marketingPhoto).toBe(0);
  });

  it("sets marketing photo when selling commission disabled", () => {
    const costs = calculateFlipCosts(defaults.purchasePrice, defaults.arv, defaults.renovationCost, defaults.area, {
      sellCommission: false,
    });
    expect(costs.sellingCommission).toBe(0);
    expect(costs.marketingPhoto).toBe(COST_CONSTANTS.marketingPhoto);
  });

  it("computes income tax as 0 when gross profit <= 0", () => {
    const costs = calculateFlipCosts(5_000_000, 4_000_000, 500_000, defaults.area);
    expect(costs.incomeTax).toBe(0);
  });

  it("computes holding costs by area and months", () => {
    const costs = calculateFlipCosts(defaults.purchasePrice, defaults.arv, defaults.renovationCost, 100, {
      holdingMonths: 3,
    });
    expect(costs.holdingCosts).toBe(3 * 100 * COST_CONSTANTS.holdingCostPerSqm);
  });

  it("computes mortgage cost", () => {
    const costs = calculateFlipCosts(defaults.purchasePrice, defaults.arv, defaults.renovationCost, defaults.area, {
      hasMortgage: true,
      mortgageAmount: 2_000_000,
      mortgageRate: 5,
      holdingMonths: 6,
    });
    const expected = Math.round(2_000_000 * (5 / 100 / 12) * 6);
    expect(costs.mortgageCost).toBe(expected);
  });

  it("skips mortgage cost when amount is 0", () => {
    const costs = calculateFlipCosts(defaults.purchasePrice, defaults.arv, defaults.renovationCost, defaults.area, {
      hasMortgage: true,
      mortgageAmount: 0,
    });
    expect(costs.mortgageCost).toBe(0);
  });

  it("handles sourcing fee as fixed amount", () => {
    const costs = calculateFlipCosts(defaults.purchasePrice, defaults.arv, defaults.renovationCost, defaults.area, {
      sourcingFee: 100_000,
      sourcingFeeIsPct: false,
    });
    expect(costs.sourcingFee).toBe(100_000);
  });

  it("handles sourcing fee as percentage", () => {
    const costs = calculateFlipCosts(defaults.purchasePrice, defaults.arv, defaults.renovationCost, defaults.area, {
      sourcingFee: 5,
      sourcingFeeIsPct: true,
    });
    expect(costs.sourcingFee).toBe(Math.round(defaults.purchasePrice * 0.05));
  });

  it("always uses 21% income tax rate", () => {
    const costs = calculateFlipCosts(defaults.purchasePrice, defaults.arv, defaults.renovationCost, defaults.area);
    const grossProfit = defaults.arv - (defaults.purchasePrice + defaults.renovationCost + defaults.renovationCost * 0.1 + COST_CONSTANTS.legalFees + COST_CONSTANTS.holdingPeriodMonths * defaults.area * COST_CONSTANTS.holdingCostPerSqm + Math.round(defaults.arv * COST_CONSTANTS.sellingCommissionRate));
    const expectedTax = grossProfit > 0 ? Math.round(grossProfit * 0.21) : 0;
    expect(costs.incomeTax).toBe(expectedTax);
  });

  it("totalCost includes all items plus income tax", () => {
    const costs = calculateFlipCosts(defaults.purchasePrice, defaults.arv, defaults.renovationCost, defaults.area);
    const manual = costs.purchasePrice + costs.legalFees + costs.appraisalFee + costs.renovationCost
      + costs.contingency + costs.holdingCosts + costs.mortgageCost + costs.sellingCommission
      + costs.marketingPhoto + costs.sourcingFee + costs.incomeTax;
    expect(costs.totalCost).toBe(manual);
  });
});

describe("calculateFlipResults", () => {
  it("returns positive ROI for good deal", () => {
    const result = calculateFlipResults(
      2_500_000, 4_200_000, 500_000, 70, 15,
    );
    expect(result.roi).toBeGreaterThan(0);
    expect(result.netProfit).toBeGreaterThan(0);
  });

  it("returns negative ROI for bad deal", () => {
    const result = calculateFlipResults(
      4_000_000, 4_200_000, 500_000, 70, 15,
    );
    expect(result.roi).toBeLessThan(0);
    expect(result.netProfit).toBeLessThan(0);
  });

  it("calculates annualized ROI", () => {
    const result = calculateFlipResults(defaults.purchasePrice, defaults.arv, defaults.renovationCost, defaults.area);
    const expectedAnnualized = (result.roi / 6) * 12;
    expect(result.annualizedRoi).toBe(Math.round(expectedAnnualized * 10) / 10);
  });

  it("calculates target purchase price", () => {
    const result = calculateFlipResults(defaults.purchasePrice, defaults.arv, defaults.renovationCost, defaults.area, 15);
    expect(result.targetPurchasePrice).toBeGreaterThan(0);
    expect(result.targetPurchasePrice).toBeLessThan(defaults.arv);
  });

  it("calculates price reduction needed", () => {
    const result = calculateFlipResults(5_000_000, defaults.arv, defaults.renovationCost, defaults.area, 15);
    expect(result.priceReductionNeeded).toBeGreaterThan(0);
  });

  it("zero price reduction when purchase price equals target", () => {
    const result = calculateFlipResults(defaults.purchasePrice, defaults.arv, defaults.renovationCost, defaults.area, 15);
    if (result.targetPurchasePrice >= defaults.purchasePrice) {
      expect(result.priceReductionNeeded).toBe(0);
    }
  });

  it("cash on cash returns 0 when purchasePrice is 0", () => {
    const result = calculateFlipResults(0, defaults.arv, defaults.renovationCost, defaults.area);
    expect(result.cashOnCash).toBe(0);
  });

  it("annualized ROI is proportional to ROI", () => {
    const result = calculateFlipResults(defaults.purchasePrice, defaults.arv, defaults.renovationCost, defaults.area);
    const expected = Math.round(((defaults.arv - result.costs.totalCost) / result.costs.totalCost * 100) / 6 * 12 * 10) / 10;
    expect(result.annualizedRoi).toBe(expected);
  });

  it("returns 0 ROI when totalCost >= ARV", () => {
    const result = calculateFlipResults(defaults.arv, defaults.arv, 0, defaults.area, 15, { sellCommission: false });
    expect(result.roi).toBeLessThanOrEqual(0);
  });
});

describe("calculateTargetPurchasePrice", () => {
  it("binary search finds price for target ROI", () => {
    const target = calculateTargetPurchasePrice(defaults.arv, defaults.renovationCost, defaults.area, 15);
    expect(target).toBeGreaterThan(0);
    expect(target).toBeLessThan(defaults.arv);
  });

  it("higher target ROI = lower purchase price", () => {
    const t15 = calculateTargetPurchasePrice(defaults.arv, defaults.renovationCost, defaults.area, 15);
    const t20 = calculateTargetPurchasePrice(defaults.arv, defaults.renovationCost, defaults.area, 20);
    expect(t20).toBeLessThanOrEqual(t15);
  });

  it("low renovation = higher target price", () => {
    const highReno = calculateTargetPurchasePrice(defaults.arv, 1_000_000, defaults.area, 15);
    const lowReno = calculateTargetPurchasePrice(defaults.arv, 200_000, defaults.area, 15);
    expect(lowReno).toBeGreaterThan(highReno);
  });

  it("respects config overrides", () => {
    const withComm = calculateTargetPurchasePrice(defaults.arv, defaults.renovationCost, defaults.area, 15);
    const withoutComm = calculateTargetPurchasePrice(defaults.arv, defaults.renovationCost, defaults.area, 15, {
      sellCommission: false,
    });
    expect(withoutComm).toBeGreaterThan(withComm);
  });

  it("returns 0 when ARV is 0", () => {
    const target = calculateTargetPurchasePrice(0, defaults.renovationCost, defaults.area, 15);
    expect(target).toBe(0);
  });
});

describe("renovationCostFromPreset", () => {
  it("light preset adds bathroom + kitchen", () => {
    const cost = renovationCostFromPreset(70, "light");
    const { light } = RENOVATION_PRESETS;
    const expected = Math.round(70 * light.costPerSqm) + 80000 + 60000;
    expect(cost).toBe(expected);
  });

  it("medium preset adds bathroom + kitchen", () => {
    const cost = renovationCostFromPreset(70, "medium");
    const { medium } = RENOVATION_PRESETS;
    const expected = Math.round(70 * medium.costPerSqm) + 180000 + 140000;
    expect(cost).toBe(expected);
  });

  it("full preset adds bathroom + kitchen", () => {
    const cost = renovationCostFromPreset(70, "full");
    const { full } = RENOVATION_PRESETS;
    const expected = Math.round(70 * full.costPerSqm) + 250000 + 200000;
    expect(cost).toBe(expected);
  });

  it("returns 0 for area <= 0", () => {
    expect(renovationCostFromPreset(0, "light")).toBe(0);
    expect(renovationCostFromPreset(-1, "medium")).toBe(0);
  });

  it("scales with area", () => {
    const small = renovationCostFromPreset(40, "medium");
    const large = renovationCostFromPreset(120, "medium");
    expect(large).toBeGreaterThan(small);
  });
});

describe("calculateItemizedRenovation", () => {
  it("returns 8 items", () => {
    const items = calculateItemizedRenovation(70, "good");
    expect(items).toHaveLength(8);
  });

  it("each item has category, cost, note", () => {
    const items = calculateItemizedRenovation(70, "good");
    for (const item of items) {
      expect(item).toHaveProperty("category");
      expect(item).toHaveProperty("estimatedCost");
      expect(item).toHaveProperty("note");
      expect(item.estimatedCost).toBeGreaterThan(0);
    }
  });

  it("dilapidated has higher costs than renovated", () => {
    const dilap = calculateItemizedRenovation(70, "dilapidated");
    const renovated = calculateItemizedRenovation(70, "renovated");
    const dilapTotal = dilap.reduce((s, i) => s + i.estimatedCost, 0);
    const renovTotal = renovated.reduce((s, i) => s + i.estimatedCost, 0);
    expect(dilapTotal).toBeGreaterThan(renovTotal);
  });

  it("new condition has lowest costs", () => {
    const newItems = calculateItemizedRenovation(70, "new");
    const goodItems = calculateItemizedRenovation(70, "good");
    const newTotal = newItems.reduce((s, i) => s + i.estimatedCost, 0);
    const goodTotal = goodItems.reduce((s, i) => s + i.estimatedCost, 0);
    expect(newTotal).toBeLessThan(goodTotal);
  });
});
