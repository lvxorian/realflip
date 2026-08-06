import { describe, it, expect } from "vitest";
import { isValidEmail, normalizeEmail } from "../validate";

describe("isValidEmail", () => {
  it("accepts regular addresses", () => {
    expect(isValidEmail("jan@example.cz")).toBe(true);
    expect(isValidEmail("jan.novak+tag@example.com")).toBe(true);
  });

  it("rejects invalid addresses", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("jan")).toBe(false);
    expect(isValidEmail("jan@example")).toBe(false);
    expect(isValidEmail("@example.cz")).toBe(false);
    expect(isValidEmail("jan example.cz")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(123)).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Jan@Example.cz ")).toBe("jan@example.cz");
  });

  it("returns null for invalid input", () => {
    expect(normalizeEmail("nonsense")).toBeNull();
  });
});
