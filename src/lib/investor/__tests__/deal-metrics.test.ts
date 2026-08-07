import { describe, it, expect } from "vitest";
import { computeFlipDeal, computeRentalDeal, costsBreakdownForDeal } from "../deal-metrics";

describe("computeFlipDeal", () => {
  it("returns nulls for invalid price/arv", () => {
    const r = computeFlipDeal({ price: 0, arv: 5_200_000 });
    expect(r.netProfit).toBeNull();
    expect(r.roi).toBeNull();
    expect(r.annualizedRoi).toBeNull();
  });

  it("returns nulls when arv missing", () => {
    const r = computeFlipDeal({ price: 3_200_000, arv: null });
    expect(r.netProfit).toBeNull();
  });

  it("computes profit, roi and annualizedRoi from negotiated price", () => {
    const r = computeFlipDeal({ price: 3_200_000, arv: 5_200_000, renovationCost: 700_000, area: 74 });
    expect(r.netProfit).toBe(704_459);
    expect(r.roi).toBe(15.7);
    expect(r.annualizedRoi).toBe(31.3);
    expect(r.arv).toBe(5_200_000);
  });

  it("recomputes different result for a different negotiated price", () => {
    const r = computeFlipDeal({ price: 4_500_000, arv: 5_200_000, renovationCost: 700_000, area: 74 });
    expect(r.netProfit).toBeLessThan(704_459);
    expect(r.roi).toBeLessThan(15.7);
  });

  it("honors custom holding months config for annualization", () => {
    const r = computeFlipDeal({ price: 3_200_000, arv: 5_200_000, renovationCost: 700_000, area: 74, config: { holdingMonths: 3 } });
    expect(r.annualizedRoi).toBeCloseTo(r.roi! * 4, 0);
  });
});

describe("computeRentalDeal", () => {
  it("returns nulls for invalid price", () => {
    const r = computeRentalDeal({ price: 0, monthlyRent: 18_000, area: 74 });
    expect(r.netYield).toBeNull();
    expect(r.cashFlowMonthly).toBeNull();
  });

  it("computes yield and cash-flow from monthly rent", () => {
    const r = computeRentalDeal({ price: 3_200_000, monthlyRent: 18_000, area: 74 });
    expect(r.grossYield).toBe(6.8);
    expect(r.netYield).toBe(5.4);
    expect(r.netYieldAfterTax).toBe(4.7);
    expect(r.capRate).toBe(5.4);
    expect(r.cashFlowMonthly).toBe(12_498);
  });

  it("does not expose flip ROI fields", () => {
    const r = computeRentalDeal({ price: 3_200_000, monthlyRent: 18_000, area: 74 });
    expect(r).not.toHaveProperty("roi");
    expect(r).not.toHaveProperty("netProfit");
  });
});

describe("costsBreakdownForDeal", () => {
  it("returns null when arv missing", () => {
    expect(costsBreakdownForDeal(3_200_000, null, 700_000, 74)).toBeNull();
  });

  it("sums to totalCost", () => {
    const b = costsBreakdownForDeal(3_200_000, 5_200_000, 700_000, 74);
    expect(b).not.toBeNull();
    if (!b) return;
    const parts = b.purchasePrice + b.legalFees + b.renovationCost + b.contingency + b.holdingCosts + b.sellingCommission + b.incomeTax;
    expect(b.totalCost).toBe(parts);
  });
});