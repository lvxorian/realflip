import { describe, it, expect, vi } from "vitest";

vi.mock("@/db", () => ({ db: {}, schema: {} }));

import { filterToWriteWindow, radarWriteCutoff } from "../radar-store";

const NOW = new Date("2026-08-01T00:00:00Z");

describe("radar delta zápisu (60 měsíců)", () => {
  it("radarWriteCutoff vrací periodu ~60 měsíců zpět", () => {
    expect(radarWriteCutoff(NOW)).toBe("2021-09");
  });

  it("filterToWriteWindow ponechá jen recentní body", () => {
    const points: [string, number][] = [
      ["2019-01", 1],
      ["2021-08", 2],
      ["2021-09", 3],
      ["2022-12", 4],
      ["2026-07", 5],
    ];
    const out = filterToWriteWindow(points, NOW);
    expect(out).toEqual([
      ["2021-09", 3],
      ["2022-12", 4],
      ["2026-07", 5],
    ]);
  });

  it("prázdný vstup zůstává prázdný", () => {
    expect(filterToWriteWindow([], NOW)).toEqual([]);
  });

  it("všechny body starší než okno → prázdno (nic se nezapisuje)", () => {
    const points: [string, number][] = [
      ["2019-01", 1],
      ["2021-08", 2],
    ];
    expect(filterToWriteWindow(points, NOW)).toEqual([]);
  });
});
