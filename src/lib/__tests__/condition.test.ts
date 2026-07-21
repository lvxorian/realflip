import { describe, it, expect } from "vitest";
import { inferConditionFromText, normalizeCondition } from "../analysis/condition";

describe("inferConditionFromText", () => {
  it("detects novostavba", () => {
    expect(inferConditionFromText("Novostavba s garáží")).toBe("new");
  });

  it("detects dilapidated", () => {
    expect(inferConditionFromText("Dům v dezolátním stavu")).toBe("dilapidated");
  });

  it("detects renovated", () => {
    expect(inferConditionFromText("Po kompletní rekonstrukci")).toBe("renovated");
  });

  it("detects original", () => {
    expect(inferConditionFromText("Byt v původním stavu")).toBe("original");
  });

  it("detects good", () => {
    expect(inferConditionFromText("Velmi dobrý stav")).toBe("good");
  });

  it("returns null for empty", () => {
    expect(inferConditionFromText()).toBeNull();
  });

  it("returns null for unknown description", () => {
    expect(inferConditionFromText("Krásný byt 3+1")).toBeNull();
  });

  it("new wins over others when strong match", () => {
    expect(inferConditionFromText("Novostavba, původní stav")).toBe("new");
  });

  it("dilapidated wins with strong match", () => {
    expect(inferConditionFromText("K demolici, po rekonstrukci")).toBe("dilapidated");
  });

  it("good when original >= 5 and renovated >= 2", () => {
    const text = "původní stav k rekonstrukci nová koupelna";
    expect(inferConditionFromText(text)).toBe("good");
  });

  it("handles multiple texts", () => {
    expect(inferConditionFromText("Byt", "po rekonstrukci")).toBe("renovated");
  });
});

describe("normalizeCondition", () => {
  it("passes through valid values", () => {
    expect(normalizeCondition("new")).toBe("new");
    expect(normalizeCondition("renovated")).toBe("renovated");
    expect(normalizeCondition("good")).toBe("good");
    expect(normalizeCondition("original")).toBe("original");
    expect(normalizeCondition("dilapidated")).toBe("dilapidated");
  });

  it("maps project to original", () => {
    expect(normalizeCondition("project")).toBe("original");
  });

  it("infers from description when not a direct value", () => {
    expect(normalizeCondition("Novostavba s terasou")).toBe("new");
  });

  it("returns null for null/empty", () => {
    expect(normalizeCondition(null)).toBeNull();
  });
});
