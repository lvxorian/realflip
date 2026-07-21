import { describe, it, expect } from "vitest";
import {
  formatPrice,
  formatCompactPrice,
  formatPercent,
  formatDate,
  formatRelative,
  daysAgo,
  slugify,
  truncate,
  getInitials,
  generateId,
  safeJsonParse,
  clamp,
  formatPhone,
  investmentScoreColor,
  investmentScoreBg,
  recommendationLabel,
  recommendationColor,
  conditionLabel,
  buildingTypeLabel,
  occupancyLabel,
  locationCategoryLabel,
  portalLabel,
} from "../utils";

describe("formatPrice", () => {
  it("formats in CZK with no decimals", () => {
    const result = formatPrice(1234567);
    expect(result).toContain("1");
    expect(result).toContain("Kč");
  });

  it("handles zero", () => {
    expect(formatPrice(0)).toContain("0");
  });

  it("handles negative", () => {
    const result = formatPrice(-50000);
    expect(result).toContain("-");
  });
});

describe("formatCompactPrice", () => {
  it("formats millions", () => {
    expect(formatCompactPrice(2_500_000)).toBe("2.5 mil. Kč");
  });

  it("formats thousands", () => {
    expect(formatCompactPrice(750_000)).toBe("750 tis. Kč");
  });

  it("formats small amounts", () => {
    expect(formatCompactPrice(500)).toBe("500 Kč");
  });

  it("rounds millions properly", () => {
    expect(formatCompactPrice(3_200_000)).toBe("3.2 mil. Kč");
  });
});

describe("formatPercent", () => {
  it("adds plus for positive", () => {
    expect(formatPercent(15.5)).toBe("+15.5%");
  });

  it("uses minus for negative", () => {
    expect(formatPercent(-5.2)).toBe("-5.2%");
  });

  it("handles zero", () => {
    expect(formatPercent(0)).toBe("+0.0%");
  });
});

describe("formatDate", () => {
  it("formats Date object", () => {
    const result = formatDate(new Date(2024, 0, 15));
    expect(result).toContain("2024");
  });

  it("formats string date", () => {
    const result = formatDate("2024-03-01");
    expect(result).toContain("2024");
  });

  it("formats timestamp", () => {
    const result = formatDate(1700000000000);
    expect(typeof result).toBe("string");
  });
});

describe("slugify", () => {
  it("converts to lowercase dashed", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("removes special chars", () => {
    expect(slugify("Test! @property #1")).toBe("test-property-1");
  });

  it("collapses multiple dashes", () => {
    expect(slugify("a  b---c")).toBe("a-b-c");
  });

  it("handles empty", () => {
    expect(slugify("")).toBe("");
  });
});

describe("truncate", () => {
  it("keeps short text", () => {
    expect(truncate("ahoj", 10)).toBe("ahoj");
  });

  it("truncates long text with ellipsis", () => {
    const result = truncate("Hello World Long Text", 10);
    expect(result).toBe("Hello Worl...");
  });
});

describe("getInitials", () => {
  it("extracts initials from full name", () => {
    expect(getInitials("John Doe")).toBe("JD");
  });

  it("limits to 2 chars", () => {
    expect(getInitials("John Michael Doe")).toBe("JM");
  });

  it("handles single name", () => {
    expect(getInitials("John")).toBe("J");
  });
});

describe("generateId", () => {
  it("returns 12 char string", () => {
    const id = generateId();
    expect(id).toHaveLength(12);
  });
});

describe("safeJsonParse", () => {
  it("parses valid JSON", () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
  });

  it("returns fallback for invalid JSON", () => {
    expect(safeJsonParse("not json", { fallback: true })).toEqual({ fallback: true });
  });

  it("returns fallback for null/undefined", () => {
    expect(safeJsonParse(null, "x")).toBe("x");
    expect(safeJsonParse(undefined, "x")).toBe("x");
  });
});

describe("clamp", () => {
  it("clamps below min", () => expect(clamp(-5, 0, 10)).toBe(0));
  it("clamps above max", () => expect(clamp(15, 0, 10)).toBe(10));
  it("stays in range", () => expect(clamp(5, 0, 10)).toBe(5));
});

describe("formatPhone", () => {
  it("formats international with +420", () => {
    expect(formatPhone("+420608033397")).toBe("+420 608 033 397");
  });

  it("formats local 9-digit", () => {
    expect(formatPhone("608033397")).toBe("608 033 397");
  });

  it("strips existing spaces", () => {
    expect(formatPhone("+420 608 033 397")).toBe("+420 608 033 397");
  });

  it("returns empty for null", () => {
    expect(formatPhone(null)).toBe("");
  });

  it("returns empty for empty string", () => {
    expect(formatPhone("")).toBe("");
  });

  it("returns as-is for unrecognized format", () => {
    expect(formatPhone("123")).toBe("123");
  });
});

describe("investmentScoreColor", () => {
  it("returns emerald for 80+", () => expect(investmentScoreColor(85)).toContain("emerald"));
  it("returns green for 60-79", () => expect(investmentScoreColor(65)).toContain("green"));
  it("returns yellow for 40-59", () => expect(investmentScoreColor(45)).toContain("yellow"));
  it("returns orange for 20-39", () => expect(investmentScoreColor(25)).toContain("orange"));
  it("returns red for <20", () => expect(investmentScoreColor(10)).toContain("red"));
});

describe("investmentScoreBg", () => {
  it("returns emerald bg for 80+", () => expect(investmentScoreBg(85)).toContain("emerald"));
  it("returns green bg for 60-79", () => expect(investmentScoreBg(65)).toContain("green"));
  it("returns yellow bg for 40-59", () => expect(investmentScoreBg(45)).toContain("yellow"));
  it("returns orange bg for 20-39", () => expect(investmentScoreBg(25)).toContain("orange"));
  it("returns red bg for <20", () => expect(investmentScoreBg(10)).toContain("red"));
});

describe("recommendationLabel", () => {
  it("returns KOUPIT for 70+", () => expect(recommendationLabel(80)).toBe("KOUPIT"));
  it("returns ZVÁŽIT for 40-69", () => expect(recommendationLabel(55)).toBe("ZVÁŽIT"));
  it("returns PŘESKOČIT for <40", () => expect(recommendationLabel(20)).toBe("PŘESKOČIT"));
});

describe("recommendationColor", () => {
  it("returns emerald for 70+", () => expect(recommendationColor(80)).toContain("emerald"));
  it("returns yellow for 40-69", () => expect(recommendationColor(55)).toContain("yellow"));
  it("returns red for <40", () => expect(recommendationColor(20)).toContain("red"));
});

describe("conditionLabel", () => {
  it("maps known conditions", () => {
    expect(conditionLabel("new")).toBe("Novostavba");
    expect(conditionLabel("renovated")).toBe("Po rekonstrukci");
    expect(conditionLabel("good")).toBe("Dobrý");
    expect(conditionLabel("original")).toBe("Původní");
    expect(conditionLabel("dilapidated")).toBe("Zchátralý");
    expect(conditionLabel("project")).toBe("Projekt");
  });

  it("returns em dash for null", () => {
    expect(conditionLabel(null)).toBe("—");
  });

  it("passes through unknown", () => {
    expect(conditionLabel("unknown")).toBe("unknown");
  });
});

describe("buildingTypeLabel", () => {
  it("maps known types", () => {
    expect(buildingTypeLabel("brick")).toBe("Cihlový");
    expect(buildingTypeLabel("panel")).toBe("Panelový");
    expect(buildingTypeLabel("new")).toBe("Novostavba");
    expect(buildingTypeLabel("mixed")).toBe("Smíšený");
  });

  it("returns em dash for null", () => {
    expect(buildingTypeLabel(null)).toBe("—");
  });
});

describe("occupancyLabel", () => {
  it("maps known statuses", () => {
    expect(occupancyLabel("tenant")).toBe("Nájemník");
    expect(occupancyLabel("owner")).toBe("Majitel");
    expect(occupancyLabel("vacant")).toBe("Prázdný");
  });

  it("returns em dash for null", () => {
    expect(occupancyLabel(null)).toBe("—");
  });
});

describe("locationCategoryLabel", () => {
  it("maps known categories", () => {
    expect(locationCategoryLabel("best")).toBe("Nejlepší");
    expect(locationCategoryLabel("good")).toBe("Dobrá");
    expect(locationCategoryLabel("ok")).toBe("Průměrná");
  });

  it("returns em dash for null", () => {
    expect(locationCategoryLabel(null)).toBe("—");
  });
});

describe("portalLabel", () => {
  it("maps known portals", () => {
    expect(portalLabel("sreality")).toBe("Sreality");
    expect(portalLabel("bazos")).toBe("Bazos");
    expect(portalLabel("reality-cz")).toBe("Reality.cz");
  });

  it("returns em dash for null", () => {
    expect(portalLabel(null)).toBe("—");
  });

  it("capitalizes unknown", () => {
    expect(portalLabel("newportal")).toBe("Newportal");
  });
});
