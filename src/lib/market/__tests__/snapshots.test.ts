import { describe, it, expect, vi, afterEach } from "vitest";
import {
  annualizeFlats,
  cpiVsRealWages,
  lastValue,
  supplyVsPopulation,
  yieldGap,
} from "../snapshots";
import type { SeriesPoint } from "../radar-store";

afterEach(() => vi.useRealTimers());

describe("yieldGap", () => {
  it("spočítá rozdíl hypoteční − repo na společných periodách", () => {
    const mortgage: SeriesPoint[] = [
      ["2026-01", 5.1],
      ["2026-02", 4.9],
    ];
    const repo: SeriesPoint[] = [
      ["2026-01", 3.5],
      ["2026-02", 3.25],
      ["2026-03", 3.0],
    ];
    const gaps = yieldGap(mortgage, repo, "1y");
    expect(gaps).toEqual([
      { period: "2026-01", mortgage: 5.1, repo: 3.5, gap: 1.6 },
      { period: "2026-02", mortgage: 4.9, repo: 3.25, gap: 1.65 },
    ]);
  });

  it("oreže periody mimo rozsah (lexikograficky)", () => {
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));
    const mortgage: SeriesPoint[] = [
      ["2025-06", 4.5],
      ["2026-06", 4.9],
    ];
    const repo: SeriesPoint[] = [
      ["2025-06", 2.5],
      ["2026-06", 3.5],
    ];
    const gaps = yieldGap(mortgage, repo, "3y");
    expect(gaps.map((g) => g.period)).toEqual(["2025-06", "2026-06"]);
  });
});

describe("cpiVsRealWages", () => {
  it("páruje CPI a reálné mzdy ve stejných periodách", () => {
    const cpi: SeriesPoint[] = [
      ["2026-03", 1.7],
      ["2026-06", 1.5],
    ];
    const real: SeriesPoint[] = [
      ["2026-03", 6.25],
      ["2026-06", 5.9],
      ["2026-09", 4.1],
    ];
    const out = cpiVsRealWages(cpi, real, "1y");
    expect(out).toEqual([
      { period: "2026-03", cpi: 1.7, realWage: 6.25 },
      { period: "2026-06", cpi: 1.5, realWage: 5.9 },
    ]);
  });
});

describe("annualizeFlats", () => {
  it("sečte měsíční byty po rocích", () => {
    const flats: SeriesPoint[] = [
      ["2024-01", 100],
      ["2024-12", 50],
      ["2025-01", 75],
    ];
    expect([...annualizeFlats(flats).entries()]).toEqual([
      [2024, 150],
      [2025, 75],
    ]);
  });
});

describe("supplyVsPopulation", () => {
  it("páruje roční součet zahájených bytů s růstem obyvatel stejného roku", () => {
    const flats: Record<string, SeriesPoint[]> = {
      cr: [
        ["2024-01", 100],
        ["2024-12", 50],
        ["2025-01", 75],
      ],
    };
    const pop: Record<string, SeriesPoint[]> = {
      cr: [
        ["2024-12", 0.3],
        ["2025-12", 0.1],
      ],
    };
    const out = supplyVsPopulation(flats, pop);
    expect(out).toEqual([{ regionKey: "cr", year: 2025, started: 75, popGrowth: 0.1 }]);
  });

  it("přeskočí region bez shodného roku", () => {
    const flats: Record<string, SeriesPoint[]> = { cr: [["2024-01", 10]] };
    const pop: Record<string, SeriesPoint[]> = { cr: [["2025-12", 0.2]] };
    expect(supplyVsPopulation(flats, pop)).toEqual([]);
  });
});

describe("lastValue", () => {
  it("vrátí poslední bod", () => {
    expect(lastValue([["2026-01", 1], ["2026-02", 2]])).toEqual({ period: "2026-02", value: 2 });
  });

  it("vrátí null pro prázdnou řadu", () => {
    expect(lastValue([])).toBeNull();
  });
});