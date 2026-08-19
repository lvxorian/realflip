import { describe, it, expect } from "vitest";
import {
  calculateRentalResults,
  computeIrr,
  estimateMonthlyRent,
  mortgageRateSensitivity,
  rentalVerdict,
  RENTAL_DEFAULTS,
  MORTGAGE_SENSITIVITY_RATES,
  svjEstimatePerSqm,
  svjEstimateMonthly,
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
    svjFeeMonthly: 0,
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
    expect(atBreakEven.cashFlowMonthly).toBeLessThanOrEqual(2);
    expect(atBreakEven.cashFlowMonthly).toBeGreaterThanOrEqual(-2);
  });

  it("target purchase price yields target net yield", () => {
    const r = calculateRentalResults(4_000_000, 70, 0, base);
    const tp = r.targetPurchasePrice;
    const atTarget = calculateRentalResults(tp, 70, 0, base);
    expect(atTarget.netYield).toBeCloseTo(base.targetYield, 0);
  });

  it("verdict thresholds are relative to target yield", () => {
    expect(rentalVerdict(6).level).toBe("rentalStrongBuy");
    expect(rentalVerdict(5).level).toBe("rentalBuy");
    expect(rentalVerdict(4.5).level).toBe("rentalBuy");
    expect(rentalVerdict(4).level).toBe("rentalConsider");
    expect(rentalVerdict(2).level).toBe("rentalDontBuy");
    expect(rentalVerdict(8, 6.5).level).toBe("rentalStrongBuy");
    expect(rentalVerdict(5.9, 6.5).level).toBe("rentalConsider");
  });

  it("defaults follow CZ market assumptions", () => {
    expect(RENTAL_DEFAULTS.targetYield).toBe(4.5);
    expect(RENTAL_DEFAULTS.expenseGrowthPct).toBe(2);
    expect(RENTAL_DEFAULTS.rentalIncomeTax).toBe(true);
    expect(RENTAL_DEFAULTS.rentGrowthPct).toBe(2);
  });
});

describe("calculateRentalResults — CZ realism (expenses, tax)", () => {
  const base = {
    ...RENTAL_DEFAULTS,
    monthlyRent: 24_500,
    svjFeeMonthly: 0,
  };

  it("income tax (15 % with 30 % paušál) reduces yearly cash flow", () => {
    const r0 = calculateRentalResults(4_000_000, 70, 0, base);
    const rNoTax = calculateRentalResults(4_000_000, 70, 0, { ...base, rentalIncomeTax: false });
    const taxYear1 = rNoTax.rows[0].cashFlow - r0.rows[0].cashFlow;
    expect(taxYear1).toBeGreaterThan(0);
    expect(r0.rows[0].cashFlow).toBe(rNoTax.rows[0].cashFlow - taxYear1);
    expect(r0.cashFlowAnnual).toBe(rNoTax.cashFlowAnnual - taxYear1);
    expect(r0.netYieldAfterTax).toBeLessThan(r0.netYield);
  });

  it("expense growth applies to fixed costs only in later years", () => {
    const r = calculateRentalResults(4_000_000, 70, 0, { ...base, expenseGrowthPct: 2 });
    const year1 = r.rows[0];
    const year2 = r.rows[1];
    expect(year1.operatingCosts).toBe(Math.round(year1.effectiveRent * 0.13) + 4000 + 3000);
    const fixedYear2 = Math.round(4000 * 1.02) + Math.round(3000 * 1.02);
    expect(year2.operatingCosts).toBe(Math.round(year2.effectiveRent * 0.13) + fixedYear2);
  });

  it("no expense growth keeps fixed costs flat", () => {
    const r = calculateRentalResults(4_000_000, 70, 0, { ...base, expenseGrowthPct: 0 });
    const fixed1 = Math.round(r.rows[0].effectiveRent * 0.13) + 7000;
    const fixed2 = Math.round(r.rows[1].effectiveRent * 0.13) + 7000;
    expect(r.rows[0].operatingCosts).toBe(fixed1);
    expect(r.rows[1].operatingCosts).toBe(fixed2);
  });

  it("higher expense growth reduces cumulative cash flow", () => {
    const r0 = calculateRentalResults(4_000_000, 70, 0, base);
    const rHigh = calculateRentalResults(4_000_000, 70, 0, { ...base, expenseGrowthPct: 9 });
    expect(rHigh.cumulativeCashFlow).toBeLessThan(r0.cumulativeCashFlow);
  });

  it("computes a consistent IRR for known cash-flow series", () => {
    // náklad 1000, 10 let po 100, terminál 1000 → IRR 10 %
    const flows = Array(10).fill(100);
    expect(computeIrr(1000, flows, 1000)).toBe(10);
  });

  it("includes IRR in results", () => {
    const r = calculateRentalResults(4_000_000, 70, 0, base);
    expect(typeof r.irr).toBe("number");
    expect(r.irr).toBeGreaterThan(-100);
  });
});

describe("calculateRentalResults — financing and costs", () => {
  const base = {
    ...RENTAL_DEFAULTS,
    monthlyRent: 24_500,
    svjFeeMonthly: 0,
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

describe("calculateRentalResults — professional validation metrics", () => {
  const base = {
    ...RENTAL_DEFAULTS,
    monthlyRent: 24_500,
    svjFeeMonthly: 0,
  };

  it("cap rate = NOI ÷ purchase price (no acquisition in denominator)", () => {
    const r = calculateRentalResults(4_000_000, 70, 0, base);
    expect(r.capRate).toBe(Math.round((r.noiAnnual / 4_000_000) * 100 * 10) / 10);
  });

  it("yield on investment includes acquisition costs → lower than cap rate", () => {
    const r = calculateRentalResults(4_000_000, 70, 0, {
      ...base,
      sourcingEnabled: true,
      sourcingFee: 100_000,
      sourcingFeeIsPct: false,
    });
    expect(r.yieldOnInvestment).toBe(Math.round((r.noiAnnual / (4_000_000 + r.acquisitionCosts)) * 100 * 10) / 10);
    expect(r.yieldOnInvestment).toBeLessThan(r.capRate);
    expect(r.yieldOnInvestment).toBeGreaterThan(0);
  });

  it("higher acquisition costs lower the yield on investment", () => {
    const r0 = calculateRentalResults(4_000_000, 70, 0, base);
    const r1 = calculateRentalResults(4_000_000, 70, 0, {
      ...base,
      sourcingEnabled: true,
      sourcingFee: 100_000,
      sourcingFeeIsPct: false,
    });
    expect(r1.yieldOnInvestment).toBeLessThan(r0.yieldOnInvestment);
  });

  it("DSCR = NOI ÷ annual debt service; null without mortgage", () => {
    const r0 = calculateRentalResults(4_000_000, 70, 0, base);
    expect(r0.dscr).toBeNull();
    const r1 = calculateRentalResults(4_000_000, 70, 0, {
      ...base,
      hasMortgage: true,
      mortgageAmount: 3_000_000,
      mortgageRate: 5,
      mortgageTermYears: 30,
    });
    const pmt = (3_000_000 * (0.05 / 12)) / (1 - Math.pow(1 + 0.05 / 12, -360));
    expect(r1.dscr).not.toBeNull();
    expect(r1.dscr).toBeCloseTo(r1.noiAnnual / (pmt * 12), 2);
    expect(r1.dscr).toBeGreaterThan(0);
  });

  it("higher mortgage amount lowers DSCR toward the danger zone", () => {
    const rLow = calculateRentalResults(4_000_000, 70, 0, {
      ...base,
      hasMortgage: true,
      mortgageAmount: 2_000_000,
      mortgageRate: 5,
      mortgageTermYears: 30,
    });
    const rHigh = calculateRentalResults(4_000_000, 70, 0, {
      ...base,
      hasMortgage: true,
      mortgageAmount: 3_500_000,
      mortgageRate: 5,
      mortgageTermYears: 30,
    });
    expect(rHigh.dscr).not.toBeNull();
    expect(rHigh.dscr as number).toBeLessThan(rLow.dscr as number);
  });

  it("max affordable loan lets NOI − tax cover the full annual payment", () => {
    const r = calculateRentalResults(4_000_000, 70, 0, { ...base });
    const debtMonthly = Math.max(0, Math.round((r.noiAnnual - r.incomeTaxAnnual) / 12));
    expect(r.maxAffordableDebtMonthly).toBe(debtMonthly);
    const pmt = (r.maxAffordableLoan * (0.05 / 12)) / (1 - Math.pow(1 + 0.05 / 12, -360));
    expect(pmt * 12).toBeLessThanOrEqual(r.noiAnnual - r.incomeTaxAnnual + 1);
  });

  it("income tax uses 30 % paušál capped at 600 000 Kč/year", () => {
    const r = calculateRentalResults(4_000_000, 70, 0, base);
    const taxFactorLow = 0.15 * (1 - Math.min(0.3, 600_000 / r.effectiveRentAnnual));
    expect(r.incomeTaxAnnual).toBe(Math.round(r.effectiveRentAnnual * taxFactorLow));
    expect(Math.min(0.3, 600_000 / r.effectiveRentAnnual)).toBe(0.3);
    const rHigh = calculateRentalResults(4_000_000, 70, 0, { ...base, monthlyRent: 250_000 });
    const taxFactorHigh = 0.15 * (1 - Math.min(0.3, 600_000 / rHigh.effectiveRentAnnual));
    expect(taxFactorHigh).toBeGreaterThan(0.15 * 0.7);
    expect(rHigh.incomeTaxAnnual).toBe(Math.round(rHigh.effectiveRentAnnual * taxFactorHigh));
    expect(rHigh.incomeTaxAnnual / rHigh.effectiveRentAnnual).toBeGreaterThan(0.15 * 0.7);
  });

  it("annualized ROI (total return) is geometric", () => {
    const r = calculateRentalResults(4_000_000, 70, 0, base);
    expect(r.annualizedRoi).not.toBeNull();
    const years = RENTAL_DEFAULTS.holdingYears;
    const expected = Math.pow(1 + r.totalRoi / 100, 1 / years) - 1;
    if (r.annualizedRoi !== null) {
      expect(Math.abs(r.annualizedRoi / 100 - expected)).toBeLessThan(0.012);
    }
  });

  it("annualized return is null when total return ≤ −100 % (negative equity flip)", () => {
    const r = calculateRentalResults(20_000_000, 70, 0, {
      ...base,
      monthlyRent: 5_000,
      appreciationPct: 0,
      hasMortgage: true,
      mortgageAmount: 19_000_000,
      mortgageRate: 6,
      mortgageTermYears: 30,
    });
    expect(r.annualizedRoi).toBeNull();
    expect(r.totalRoi).toBeLessThan(-100);
  });
});

describe("calculateRentalResults — LTV and cumulative payback", () => {
  const base = {
    ...RENTAL_DEFAULTS,
    monthlyRent: 24_500,
    svjFeeMonthly: 0,
  };

  it("LTV = loan ÷ purchase price, capped loan at price", () => {
    const r = calculateRentalResults(4_000_000, 70, 0, {
      ...base,
      hasMortgage: true,
      mortgageAmount: 3_000_000,
      mortgageRate: 5,
      mortgageTermYears: 30,
    });
    expect(r.ltv).toBe(Math.round((3_000_000 / 4_000_000) * 100));
    const rCapped = calculateRentalResults(4_000_000, 70, 0, {
      ...base,
      hasMortgage: true,
      mortgageAmount: 5_000_000,
      mortgageRate: 5,
      mortgageTermYears: 30,
    });
    expect(rCapped.ltv).toBe(100);
  });

  it("LTV is 0 without mortgage", () => {
    const r = calculateRentalResults(4_000_000, 70, 0, base);
    expect(r.ltv).toBe(0);
  });

  it("cumulative payback year = first year cumulative CF covers invested capital", () => {
    const r = calculateRentalResults(4_000_000, 70, 0, {
      ...base,
      sourcingEnabled: true,
      sourcingFee: 100_000,
      sourcingFeeIsPct: false,
    });
    const expected = r.rows.find((row) => row.cumulativeCashFlow >= r.totalInvested)?.year ?? null;
    expect(r.cumulativePaybackYear).toBe(expected);
    if (r.cumulativePaybackYear !== null) {
      expect(r.rows[r.cumulativePaybackYear - 1].cumulativeCashFlow).toBeGreaterThanOrEqual(r.totalInvested);
      if (r.cumulativePaybackYear > 1) {
        expect(r.rows[r.cumulativePaybackYear - 2].cumulativeCashFlow).toBeLessThan(r.totalInvested);
      }
    }
  });

  it("cumulative payback is null when cash flow never covers the investment", () => {
    const r = calculateRentalResults(4_000_000, 70, 0, {
      ...base,
      monthlyRent: 5_000,
      hasMortgage: true,
      mortgageAmount: 3_500_000,
      mortgageRate: 6,
      mortgageTermYears: 30,
    });
    expect(r.cumulativePaybackYear).toBeNull();
  });
});

describe("mortgageRateSensitivity", () => {
  const base = {
    ...RENTAL_DEFAULTS,
    monthlyRent: 24_500,
    svjFeeMonthly: 0,
  };

  it("returns rows for standard rates with payment, cash flow and CoC", () => {
    const r = calculateRentalResults(4_000_000, 70, 0, {
      ...base,
      hasMortgage: true,
      mortgageAmount: 3_000_000,
      mortgageRate: 5,
      mortgageTermYears: 30,
    });
    const rows = mortgageRateSensitivity(3_000_000, r.noiAnnual - r.incomeTaxAnnual, 30, r.totalInvested);
    expect(rows.length).toBe(MORTGAGE_SENSITIVITY_RATES.length);
    expect(rows.map((row) => row.rate)).toEqual(MORTGAGE_SENSITIVITY_RATES);
    rows.forEach((row) => {
      expect(row.paymentMonthly).toBeGreaterThan(0);
      expect(row.cashOnCash).not.toBeNull();
      if (row.rate > rows[0].rate) {
        const prev = rows[rows.indexOf(row) - 1];
        expect(row.paymentMonthly).toBeGreaterThan(prev.paymentMonthly);
      }
    });
  });

  it("returns empty array without loan or income", () => {
    expect(mortgageRateSensitivity(0, 100_000, 30, 1_000_000)).toEqual([]);
    expect(mortgageRateSensitivity(1_000_000, 0, 30, 1_000_000)).toEqual([]);
  });
});

describe("fond oprav SVJ (svjFeeMonthly)", () => {
  const base = {
    ...RENTAL_DEFAULTS,
    monthlyRent: 24_500,
    svjFeeMonthly: 0,
  };

  it("svjEstimatePerSqm follows building type with fallback", () => {
    expect(svjEstimatePerSqm("new")).toBe(20);
    expect(svjEstimatePerSqm("panel")).toBe(40);
    expect(svjEstimatePerSqm("mixed")).toBe(45);
    expect(svjEstimatePerSqm("brick")).toBe(50);
    expect(svjEstimatePerSqm(null)).toBe(35);
    expect(svjEstimatePerSqm("unknown")).toBe(35);
    expect(svjEstimateMonthly(70, "panel")).toBe(2_800);
  });

  it("auto-estimate (null) flows into OPEX and lowers yield — panel 70 m²", () => {
    const r0 = calculateRentalResults(4_000_000, 70, 0, base);
    const rAuto = calculateRentalResults(4_000_000, 70, 0, { ...base, svjFeeMonthly: null, buildingType: "panel" });
    expect(rAuto.svjMonthly).toBe(2_800);
    expect(rAuto.svjIsEstimate).toBe(true);
    expect(rAuto.operatingCostsAnnual).toBe(r0.operatingCostsAnnual + 2_800 * 12);
    expect(rAuto.noiAnnual).toBeLessThan(r0.noiAnnual);
    expect(rAuto.netYield).toBeLessThan(r0.netYield);
    expect(rAuto.targetPurchasePrice).toBeLessThan(r0.targetPurchasePrice);
  });

  it("exact value overrides the estimate; 0 disables it", () => {
    const rManual = calculateRentalResults(4_000_000, 70, 0, {
      ...base,
      svjFeeMonthly: 3_000,
      buildingType: "panel",
    });
    expect(rManual.svjMonthly).toBe(3_000);
    expect(rManual.svjIsEstimate).toBe(false);
    const rZero = calculateRentalResults(4_000_000, 70, 0, {
      ...base,
      svjFeeMonthly: 0,
      buildingType: "panel",
    });
    expect(rZero.svjMonthly).toBe(0);
    expect(rZero.svjIsEstimate).toBe(false);
  });

  it("break-even rent covers the fond oprav", () => {
    const r0 = calculateRentalResults(4_000_000, 70, 0, base);
    const r1 = calculateRentalResults(4_000_000, 70, 0, {
      ...base,
      svjFeeMonthly: 2_450,
    });
    const atBreakEven = calculateRentalResults(4_000_000, 70, 0, { ...base, svjFeeMonthly: 2_450, monthlyRent: r1.breakEvenRent });
    expect(atBreakEven.cashFlowMonthly).toBeLessThanOrEqual(2);
    expect(atBreakEven.cashFlowMonthly).toBeGreaterThanOrEqual(-2);
    expect(r1.breakEvenRent).toBeGreaterThan(r0.breakEvenRent);
  });

  it("fond oprav grows with expense growth in later years", () => {
    const r = calculateRentalResults(4_000_000, 70, 0, {
      ...base,
      svjFeeMonthly: 2_450,
      expenseGrowthPct: 2,
    });
    const y2 = r.rows[1];
    const fixedYear2 = Math.round(4_000 * 1.02) + Math.round(3_000 * 1.02) + Math.round(2_450 * 12 * 1.02);
    expect(y2.operatingCosts).toBe(Math.round(y2.effectiveRent * 0.13) + fixedYear2);
  });
});
