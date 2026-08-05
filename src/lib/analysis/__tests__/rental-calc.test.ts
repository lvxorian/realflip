import { describe, it, expect } from "vitest";
import {
  calculateRentalResults,
  estimateMonthlyRent,
  rentalVerdict,
  RENTAL_DEFAULTS,
} from "../rental-calc";
import { rentPerSqm } from "../market-data";

describe("estimateMonthlyRent", () => {
  it("uses city-aware rate per m²", () => {
    expect(estimateMonthlyRent(70, "praha", "premium")).toBe(70 * 420);
    expect(estimateMonthlyRent(70, "praha", "stable")).toBe(70 * 350);
    expect(estimateMonthlyRent(70, "brno", "risky")).toBe(70 * 230);
  });

  it("falls back to 250 Kč/m² for unknown city", () => {
    expect(estimateMonthlyRent(70, "neznama", null)).toBe(70 * 250);
    expect(estimateMonthlyRent(70, null, null)).toBe(70 * 250);
  });

  it("returns 0 for non-positive area", () => {
    expect(estimateMonthlyRent(0, "praha", "premium")).toBe(0);
  });

  it("rentPerSqm defaults to stable category for unknown categories", () => {
    expect(rentPerSqm("praha", "unknown")).toBe(350);
  });
});

describe("calculateRentalResults — base case", () => {
  const base = {
    ...RENTAL_DEFAULTS,
    monthlyRent: 24_500,
  };

  it("computes gross and net yield correctly", () => {
    const r = calculateRentalResults(4_000_000, 70, 0, base);
    // hrubý nájem 294 000 / rok
    expect(r.grossRentAnnual).toBe(294_000);
    // efektivní nájem po 5% neobsazenosti
    expect(r.effectiveRentAnnual).toBe(Math.round(294_000 * 0.95));
    // opex: 13 % z efektivního nájmu + pojištění 4000 + daň 3000
    const opex = Math.round(294_000 * 0.95 * 0.13) + 4000 + 3000;
    expect(r.operatingCostsAnnual).toBe(opex);
    const noi = r.effectiveRentAnnual - opex;
    expect(r.noiAnnual).toBe(noi);
    // čistý výnos = NOI / cena
    expect(r.netYield).toBe(Math.round((noi / 4_000_000) * 100 * 10) / 10);
    expect(r.grossYield).toBe(Math.round((294_000 / 4_000_000) * 100 * 10) / 10);
  });

  it("break-even rent recovers costs at zero cash flow", () => {
    const r = calculateRentalResults(4_000_000, 70, 0, base);
    const cfg = { ...base, monthlyRent: r.breakEvenRent };
    const atBreakEven = calculateRentalResults(4_000_000, 70, 0, cfg);
    expect(atBreakEven.cashFlowMonthly).toBeLessThanOrEqual(1);
    expect(atBreakEven.cashFlowMonthly).toBeGreaterThanOrEqual(-1);
  });

  it("target purchase price yields target net yield", () => {
    const r = calculateRentalResults(4_000_000, 70, 0, base);
    const tp = r.targetPurchasePrice;
    const atTarget = calculateRentalResults(tp, 70, 0, base);
    expect(atTarget.netYield).toBeCloseTo(base.targetYield, 0);
  });

  it("verdict thresholds", () => {
    expect(rentalVerdict(6.2).level).toBe("rentalStrongBuy");
    expect(rentalVerdict(5).level).toBe("rentalBuy");
    expect(rentalVerdict(3.5).level).toBe("rentalConsider");
    expect(rentalVerdict(2).level).toBe("rentalDontBuy");
  });
});

describe("calculateRentalResults — financing and costs", () => {
  const base = {
    ...RENTAL_DEFAULTS,
    monthlyRent: 24_500,
  };

  it("mortgage reduces cash flow", () => {
    const r0 = calculateRentalResults(4_000_000, 70, 0, base);
    const r1 = calculateRentalResults(4_000_000, 70, 0, {
      ...base,
      hasMortgage: true,
      mortgageAmount: 3_000_000,
      mortgageRate: 5,
      mortgageTermYears: 30,
    });
    expect(r1.cashFlowMonthly).toBeLessThan(r0.cashFlowMonthly);
    expect(r1.cashOnCash).toBeLessThan(r0.cashOnCash);
    // zůstatek úvěru po 10 letech < půjčka
    expect(r1.mortgageBalance).toBeGreaterThan(0);
    expect(r1.mortgageBalance).toBeLessThan(3_000_000);
  });

  it("sourcing fee (Kč) adds to acquisition costs", () => {
    const r0 = calculateRentalResults(4_000_000, 70, 0, base);
    const r1 = calculateRentalResults(4_000_000, 70, 0, {
      ...base,
      sourcingEnabled: true,
      sourcingFee: 100_000,
      sourcingFeeIsPct: false,
    });
    expect(r1.acquisitionCosts).toBe(r0.acquisitionCosts + 100_000);
    expect(r1.totalInvested).toBe(r0.totalInvested + 100_000);
  });

  it("sourcing fee (pct) scales with purchase price", () => {
    const r = calculateRentalResults(4_000_000, 70, 0, {
      ...base,
      sourcingEnabled: true,
      sourcingFee: 5,
      sourcingFeeIsPct: true,
    });
    expect(r.acquisitionCosts).toBe(base.legalFee + Math.round(4_000_000 * 0.05));
  });

  it("renovation before rent increases investment", () => {
    const r0 = calculateRentalResults(4_000_000, 70, 0, base);
    const r1 = calculateRentalResults(4_000_000, 70, 300_000, {
      ...base,
      renovationBeforeRent: true,
    });
    expect(r1.totalInvested).toBe(r0.totalInvested + 300_000);
  });

  it("vacancy reduces effective rent", () => {
    const r0 = calculateRentalResults(4_000_000, 70, 0, base);
    const r1 = calculateRentalResults(4_000_000, 70, 0, { ...base, vacancyPct: 15 });
    expect(r1.effectiveRentAnnual).toBeLessThan(r0.effectiveRentAnnual);
  });

  it("exit after 10 years is tax-free (exemption), shorter holding pays tax", () => {
    const r10 = calculateRentalResults(4_000_000, 70, 0, { ...base, holdingYears: 10 });
    const r5 = calculateRentalResults(4_000_000, 70, 0, { ...base, holdingYears: 5 });
    expect(r10.exitTax).toBe(0);
    expect(r5.exitTax).toBeGreaterThan(0);
  });

  it("higher rent growth increases cumulative cash flow", () => {
    const r0 = calculateRentalResults(4_000_000, 70, 0, base);
    const r2 = calculateRentalResults(4_000_000, 70, 0, { ...base, rentGrowthPct: 5 });
    expect(r2.cumulativeCashFlow).toBeGreaterThan(r0.cumulativeCashFlow);
  });
});
