import { describe, it, expect } from "vitest";
import {
  calculateAuctionResults,
  calculateCeilingPrice,
  calculateBreakEvenPrice,
  AUCTION_DEFAULTS,
  TAX_RATE,
} from "../auction-flip-costs";

const base = {
  asIsTmv: 3_500_000,
  td: 1_500_000,
  tc: 75_000,
  np: 2_300_000,
  arv: 4_200_000,
  renovationCost: 600_000,
  area: 70,
  discount: 30,
};

describe("calculateAuctionResults", () => {
  it("computes TBP as 70% of AsIs TMV by default discount", () => {
    const r = calculateAuctionResults(base);
    expect(r.tbp).toBe(Math.round(base.asIsTmv * 0.7));
  });

  it("computes NCO = TBP - TD - TC", () => {
    const r = calculateAuctionResults(base);
    expect(r.nco).toBe(r.tbp - base.td - base.tc);
  });

  it("is feasible when NCO > 0", () => {
    const r = calculateAuctionResults(base);
    expect(r.feasible).toBe(true);
  });

  it("is infeasible when debts exceed TBP", () => {
    const r = calculateAuctionResults({ ...base, td: 2_600_000 });
    expect(r.nco).toBeLessThanOrEqual(0);
    expect(r.feasible).toBe(false);
  });

  it("computes auction payout as NP - TD", () => {
    const r = calculateAuctionResults(base);
    expect(r.auctionPayout).toBe(base.np - base.td);
  });

  it("computes negotiation advantage vs auction", () => {
    const r = calculateAuctionResults(base);
    expect(r.negotiationAdvantage).toBe(r.nco - r.auctionPayout);
  });

  it("excludes appraisal and mortgage from costs", () => {
    const r = calculateAuctionResults(base);
    expect(r.costs.appraisalFee).toBe(0);
    expect(r.costs.mortgageCost).toBe(0);
  });

  it("computes positive profit and ROI for a good deal", () => {
    const r = calculateAuctionResults(base);
    expect(r.netProfit).toBeGreaterThan(0);
    expect(r.roi).toBeGreaterThan(0);
  });

  it("applies 21% income tax on gross profit", () => {
    const r = calculateAuctionResults(base);
    const gross = base.arv - (r.costs.totalCost - r.costs.incomeTax);
    const expectedTax = gross > 0 ? Math.round(gross * TAX_RATE) : 0;
    expect(r.costs.incomeTax).toBe(expectedTax);
  });

  it("default strategy is fifty-fifty (sourcing disabled)", () => {
    const r = calculateAuctionResults(base);
    expect(r.strategy).toBe("fifty-fifty");
    expect(r.investorProfit).toBe(Math.round(r.netProfit / 2));
    expect(r.dealmakerProfit).toBe(Math.round(r.netProfit / 2));
  });

  it("sourcing fee strategy keeps all profit for investor + fee for dealmaker", () => {
    const rSf = calculateAuctionResults({
      ...base,
      config: { sourcingEnabled: true, sourcingFee: 100_000, sourcingFeeIsPct: false },
    });
    expect(rSf.strategy).toBe("sourcing-fee");
    expect(rSf.sourcingFee).toBe(100_000);
    expect(rSf.dealmakerProfit).toBe(100_000);
    expect(rSf.investorProfit).toBe(rSf.netProfit);
  });

  it("sourcing fee as percentage of TBP", () => {
    const rSf = calculateAuctionResults({
      ...base,
      config: { sourcingEnabled: true, sourcingFee: 5, sourcingFeeIsPct: true },
    });
    const r = calculateAuctionResults(base);
    expect(rSf.sourcingFee).toBe(Math.round(r.tbp * 0.05));
  });

  it("annualized ROI scales with holding months", () => {
    const r = calculateAuctionResults(base, 15);
    const expected = (r.roi / AUCTION_DEFAULTS.holdingMonths) * 12;
    expect(r.annualizedRoi).toBe(Math.round(expected * 10) / 10);
  });
});

describe("calculateCeilingPrice", () => {
  it("returns a price below ARV for target ROI", () => {
    const ceiling = calculateCeilingPrice(base, 15);
    expect(ceiling).toBeGreaterThan(0);
    expect(ceiling).toBeLessThan(base.arv);
  });

  it("higher target ROI = lower ceiling", () => {
    const c15 = calculateCeilingPrice(base, 15);
    const c20 = calculateCeilingPrice(base, 20);
    expect(c20).toBeLessThanOrEqual(c15);
  });

  it("returns 0 when ARV is 0", () => {
    expect(calculateCeilingPrice({ ...base, arv: 0 }, 15)).toBe(0);
  });
});

describe("calculateBreakEvenPrice", () => {
  it("is at least the ceiling price", () => {
    const ceiling = calculateCeilingPrice(base, 15);
    const breakeven = calculateBreakEvenPrice(base);
    expect(breakeven).toBeGreaterThanOrEqual(ceiling);
  });

  it("returns positive value for viable deal", () => {
    const breakeven = calculateBreakEvenPrice(base);
    expect(breakeven).toBeGreaterThan(0);
  });
});
