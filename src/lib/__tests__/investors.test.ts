import { describe, it, expect } from "vitest";
import { formatInvestorBudget, budgetCovers } from "../investors";

describe("formatInvestorBudget", () => {
  it("neomezeno", () => {
    expect(formatInvestorBudget(5_000_000, 1)).toBe("Neomezeno");
    expect(formatInvestorBudget(null, 1)).toBe("Neomezeno");
  });

  it("miliony → mil. Kč", () => {
    expect(formatInvestorBudget(5_000_000, 0)).toBe("5 mil. Kč");
    expect(formatInvestorBudget(5_500_000, 0)).toBe("5.5 mil. Kč");
  });

  it("tisíce → tis. Kč", () => {
    expect(formatInvestorBudget(500_000, 0)).toBe("500 tis. Kč");
  });

  it("malé částky → Kč", () => {
    expect(formatInvestorBudget(800, 0)).toBe("800 Kč");
  });

  it("null budget bez unlimited → Neuveden", () => {
    expect(formatInvestorBudget(null, 0)).toBe("Neuveden");
  });
});

describe("budgetCovers", () => {
  it("neomezeno pokryje cokoliv", () => {
    expect(budgetCovers(1_000_000, 1, 50_000_000)).toBe(true);
  });

  it("ohraničený budget pokryje částku v limitu", () => {
    expect(budgetCovers(5_000_000, 0, 4_000_000)).toBe(true);
    expect(budgetCovers(5_000_000, 0, 5_000_000)).toBe(true);
  });

  it("ohraničený budget nepokryje částku nad limit", () => {
    expect(budgetCovers(5_000_000, 0, 6_000_000)).toBe(false);
  });

  it("null budget bez unlimited → false", () => {
    expect(budgetCovers(null, 0, 1_000_000)).toBe(false);
  });
});
