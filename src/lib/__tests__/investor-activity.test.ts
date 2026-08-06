import { describe, it, expect } from "vitest";
import { ACTIVE_WINDOW_MS, isInvestorActive } from "../investor-activity";

const now = 1_700_000_000_000;

describe("isInvestorActive", () => {
  it("returns true within the active window", () => {
    expect(isInvestorActive(now - 60_000, now)).toBe(true);
    expect(isInvestorActive(now, now)).toBe(true);
  });

  it("returns true at the exact boundary (inclusive) and false after", () => {
    expect(isInvestorActive(now - ACTIVE_WINDOW_MS, now)).toBe(true);
    expect(isInvestorActive(now - ACTIVE_WINDOW_MS - 1, now)).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isInvestorActive(null, now)).toBe(false);
    expect(isInvestorActive(undefined, now)).toBe(false);
  });
});
